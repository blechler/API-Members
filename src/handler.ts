import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { MemberService } from './services/memberService.js';
import { ImageService } from './services/imageService.js';
import { checkMemberAuthorization, checkCharacterAccess } from './services/authService.js';
import { 
  sanitizeCreateMemberRequest, 
  sanitizeUpdateMemberRequest, 
  convertServiceResponse, 
  getPathSegments 
} from './utils/mappingUtils.js';
import Busboy from 'busboy';

/**
 * Main AWS Lambda handler for the Members API
 * 
 * Processes HTTP requests for member CRUD operations, character management, and resource retrieval.
 * Supports GET, POST, PUT methods with proper CORS headers and error handling.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;
  console.log(`${httpMethod} ${event.path}`);
  
  let response: APIGatewayProxyResult = {
    statusCode: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    },
    body: ''
  };

  try {
    const memberService = new MemberService();
    let result: { statusCode: number; body: any };

    switch (httpMethod) {
      case 'POST':
        result = await handlePost(event, memberService);
        break;
      case 'GET':
        result = await handleGet(event, memberService);
        break;
      case 'PUT':
        result = await handlePut(event, memberService);
        break;
      case 'DELETE':
        result = await handleDelete(event, memberService);
        break;
      case 'OPTIONS':
        result = { statusCode: 200, body: { message: 'OK' } };
        break;
      default:
        result = { statusCode: 405, body: { message: 'Method not allowed' } };
        break;
    }

    response.statusCode = result.statusCode;
    response.body = JSON.stringify(result.body);

  } catch (error) {
    console.error('Error in handler:', error);
    response.statusCode = 500;
    response.body = JSON.stringify({ message: (error as Error).message });
  }

  return response;
};

/**
 * Handle POST requests for member creation
 */
async function handlePost(event: APIGatewayProxyEvent, memberService: MemberService): Promise<{ statusCode: number; body: any }> {
  const pathSegments = getPathSegments(event.path);
  
  // Check authentication
  const authResult = checkMemberAuthorization(event);
  if (authResult.statusCode !== 200) {
    return { statusCode: authResult.statusCode, body: { message: authResult.message || 'Unauthorized' }  };
  }

  if (pathSegments.length === 2 && pathSegments[0] === 'members' && pathSegments[1] === 'member') {
    // POST /members/member - create single member
    return await createMember(event, memberService);
  }

  return { statusCode: 400, body: { message: 'Invalid route' } };
}

/**
 * Handle GET requests for member and resource retrieval
 * All endpoints require authentication via API Gateway
 */
async function handleGet(event: APIGatewayProxyEvent, memberService: MemberService): Promise<{ statusCode: number; body: any }> {
  const pathSegments = getPathSegments(event.path);

  if (pathSegments.length === 0 || (pathSegments[0] !== 'members' && pathSegments[0] !== 'members-v2')) {
    return { statusCode: 400, body: { message: 'Invalid route' } };
  }

  if (pathSegments.length === 1 && (pathSegments[0] === 'members' || pathSegments[0] === 'members-v2')) {
    // GET /members - get all members
    const serviceResponse = await memberService.getAllMembers();
    return convertServiceResponse(serviceResponse);
  }

  // Handle all endpoints
  switch (pathSegments[1]) {
    case 'classes':
      const classesResponse = await memberService.getClasses();
      return convertServiceResponse(classesResponse);
    case 'races':
      const racesResponse = await memberService.getRaces();
      return convertServiceResponse(racesResponse);
    case 'auras':
      const aurasResponse = await memberService.getAuras();
      return convertServiceResponse(aurasResponse);
    case 'groups':
      const groupsResponse = await memberService.getGroups();
      return convertServiceResponse(groupsResponse);
    case 'member':
      return await handleGetMember(event, memberService, pathSegments);
    case 'characters':
      return await handleGetCharacters(event, memberService);
    case 'sessions':
      return await handleGetSessions(event, memberService, pathSegments);
  }

  return { statusCode: 400, body: { message: 'Invalid route' } };
}

/**
 * Handle GET requests for individual members
 */
async function handleGetMember(_event: APIGatewayProxyEvent, memberService: MemberService, pathSegments: string[]): Promise<{ statusCode: number; body: any }> {
  // GET /members/member/{id} - get member by ID
  const memberId = pathSegments[2];
  if (!memberId) {
    return { statusCode: 400, body: { message: 'Member ID is required' } };
  }
  const serviceResponse = await memberService.getMemberById(memberId);
  return convertServiceResponse(serviceResponse);
}

/**
 * Handle GET requests for member characters
 */
async function handleGetCharacters(event: APIGatewayProxyEvent, memberService: MemberService): Promise<{ statusCode: number; body: any }> {
  // GET /members/characters - get characters for user
  const authResult = checkCharacterAccess(event, event.pathParameters?.sub);
  if (authResult.statusCode !== 200) {
    return { statusCode: authResult.statusCode, body: { message: authResult.message || 'Unauthorized' } };
  }

  const authClaims = event.requestContext?.authorizer?.claims;
  const requestedSub = event.pathParameters?.sub;
  const currentUserSub = authClaims?.sub;
  const sub = requestedSub || currentUserSub;
  
  if (!sub) {
    return { statusCode: 400, body: { message: 'User ID required' } };
  }

  const serviceResponse = await memberService.getMembersByOwner(sub);
  return convertServiceResponse(serviceResponse);
}

/**
 * Handle GET requests for member sessions
 */
async function handleGetSessions(event: APIGatewayProxyEvent, memberService: MemberService, pathSegments: string[]): Promise<{ statusCode: number; body: any }> {
  // GET /members/sessions/{memberId} or /members/sessions/{memberId}/count
  const memberId = event.pathParameters?.id;
  if (!memberId) {
    return { statusCode: 400, body: { error: "Member ID is required" } };
  }
  
  if (pathSegments.length === 4 && pathSegments[3] === 'count') {
    const serviceResponse = await memberService.countSessionsByMemberId(memberId);
    return convertServiceResponse(serviceResponse);
  } else {
    const serviceResponse = await memberService.getSessionsByMemberId(memberId);
    return convertServiceResponse(serviceResponse);
  }
}

/**
 * Handle PUT requests for member updates
 */
async function handlePut(event: APIGatewayProxyEvent, memberService: MemberService): Promise<{ statusCode: number; body: any }> {
  const pathSegments = getPathSegments(event.path);
  
  // Check authentication
  const authResult = checkMemberAuthorization(event);
  if (authResult.statusCode !== 200) {
    return { statusCode: authResult.statusCode, body: { message: authResult.message || 'Unauthorized' } };
  }

  if (pathSegments.length >= 3 && (pathSegments[0] === 'members' || pathSegments[0] === 'members-v2')) {
    if (pathSegments[1] === 'member') {
      const memberId = pathSegments[2];
      
      if (pathSegments.length === 3) {
        // PUT /members/member/{id} - update member
        return await updateMember(event, memberService, memberId);
      } else if (pathSegments.length === 4 && pathSegments[3] === 'image') {
        // PUT /members/member/{id}/image - update member image
        return await updateMemberImage(event, memberService, memberId);
      }
    }
  }

  return { statusCode: 400, body: { message: 'Invalid route' } };
}

/**
 * Handle DELETE requests for member deletion
 */
async function handleDelete(event: APIGatewayProxyEvent, memberService: MemberService): Promise<{ statusCode: number; body: any }> {
  const pathSegments = getPathSegments(event.path);
  
  // Check authentication
  const authResult = checkMemberAuthorization(event);
  if (authResult.statusCode !== 200) {
    return { statusCode: authResult.statusCode, body: { message: authResult.message || 'Unauthorized' } };
  }

  if (pathSegments.length === 3 && pathSegments[0] === 'members' && pathSegments[1] === 'member') {
    // DELETE /members/member/{id} - delete member
    const memberId = pathSegments[2];
    if (!memberId) {
      return { statusCode: 400, body: { message: 'Member ID is required' } };
    }
    return await deleteMember(event, memberService, memberId);
  }

  return { statusCode: 400, body: { message: 'Invalid route' } };
}

/**
 * Delete a member
 */
async function deleteMember(_event: APIGatewayProxyEvent, memberService: MemberService, memberId: string): Promise<{ statusCode: number; body: any }> {
  try {
    const serviceResponse = await memberService.deleteMember(memberId);
    return convertServiceResponse(serviceResponse);
  } catch (error) {
    console.error('Error in deleteMember:', error);
    return { statusCode: 500, body: { message: 'Failed to delete member' } };
  }
}

/**
 * Create a new member with image upload support
 */
async function createMember(event: APIGatewayProxyEvent, memberService: MemberService): Promise<{ statusCode: number; body: any }> {
  try {
    let memberData: any;
    let imageS3Key: string | undefined = undefined;
    let imageValidationError: string | undefined = undefined;

    // Check if this is a multipart form (with image)
    const contentType = event.headers['Content-Type'] || event.headers['content-type'];
    
    if (contentType && contentType.startsWith('multipart/form-data')) {
      // Handle multipart form with image upload
      const formData = await parseMultipartForm(event);
      
      const imageFile = formData['image'] as any;
      memberData = JSON.parse(formData['data'] as string);
      
      if (imageFile && imageFile.content) {
        const imageService = new ImageService();
        const uploadResult = await imageService.validateAndUploadImageToS3(imageFile.content, imageFile.filename);
        
        if (uploadResult.success) {
          imageS3Key = uploadResult.imageUrl;
        } else {
          imageValidationError = uploadResult.error;
        }
      }
    } else {
      // Handle JSON request
      memberData = JSON.parse(event.body || '{}');
    }

    const requestData = sanitizeCreateMemberRequest(memberData);
    
    if (imageS3Key) {
      requestData.image = imageS3Key;
    }

    const serviceResponse = await memberService.createMember(requestData);
    
    if (serviceResponse.success) {
      const responseBody: any = serviceResponse.data;
      
      if (imageValidationError) {
        responseBody.warning = `Member created successfully, but image was not uploaded: ${imageValidationError}`;
      }
      
      return { statusCode: 201, body: responseBody };
    } else {
      return convertServiceResponse(serviceResponse);
    }
  } catch (error) {
    console.error('Error in createMember:', error);
    return { statusCode: 400, body: { message: 'Invalid request data' } };
  }
}

/**
 * Update an existing member
 */
async function updateMember(event: APIGatewayProxyEvent, memberService: MemberService, memberId: string): Promise<{ statusCode: number; body: any }> {
  try {
    let memberData: any;
    let imageS3Key: string | undefined = undefined;
    let imageValidationError: string | undefined = undefined;

    // Check if this is a multipart form (with image)
    const contentType = event.headers['Content-Type'] || event.headers['content-type'];
    
    if (contentType && contentType.startsWith('multipart/form-data')) {
      // Handle multipart form with image upload
      const formData = await parseMultipartForm(event);
      
      const imageFile = formData['image'] as any;
      memberData = JSON.parse(formData['data'] as string);
      
      if (imageFile && imageFile.content) {
        const imageService = new ImageService();
        const uploadResult = await imageService.validateAndUploadImageToS3(imageFile.content, imageFile.filename);
        
        if (uploadResult.success) {
          imageS3Key = uploadResult.imageUrl;
        } else {
          imageValidationError = uploadResult.error;
        }
      }
    } else {
      // Handle JSON request
      memberData = JSON.parse(event.body || '{}');
    }

    if (!memberData.id) {
      return { statusCode: 400, body: { message: "Missing member ID" } };
    }

    const updates = sanitizeUpdateMemberRequest(memberData);
    
    // Add image key to updates if a new image was uploaded
    if (imageS3Key) {
      updates.image = imageS3Key;
    }

    const serviceResponse = await memberService.updateMember(memberId, updates);
    
    if (serviceResponse.success) {
      const responseBody: any = serviceResponse.data;
      
      if (imageValidationError) {
        responseBody.warning = `Member updated successfully, but image was not uploaded: ${imageValidationError}`;
      }
      
      return { statusCode: 200, body: responseBody };
    } else {
      return convertServiceResponse(serviceResponse);
    }
  } catch (error) {
    console.error('Error in updateMember:', error);
    return { statusCode: 400, body: { message: 'Invalid request data' } };
  }
}

/**
 * Update member image
 */
async function updateMemberImage(event: APIGatewayProxyEvent, memberService: MemberService, memberId: string): Promise<{ statusCode: number; body: any }> {
  try {
    // Get existing member to check for existing image
    const memberResponse = await memberService.getMemberById(memberId);
    if (!memberResponse.success) {
      return convertServiceResponse(memberResponse);
    }

    const member = memberResponse.data!;
    if (!member.image) {
      return { statusCode: 400, body: { message: 'Member has no existing image to update' } };
    }

    const formData = await parseMultipartForm(event);
    const imageFile = formData['image'] as any;
    
    if (!imageFile || !imageFile.content) {
      return { statusCode: 400, body: { message: 'No image file provided' } };
    }

    const imageService = new ImageService();
    const uploadResult = await imageService.updateImageInS3(imageFile.content, member.image, memberId);
    
    if (uploadResult.success) {
      return { statusCode: 200, body: { image: uploadResult.imageUrl } };
    } else {
      return { statusCode: 500, body: { message: uploadResult.error } };
    }
  } catch (error) {
    console.error('Error in updateMemberImage:', error);
    return { statusCode: 500, body: { message: 'Failed to update image' } };
  }
}

/**
 * Parse multipart form data
 */
async function parseMultipartForm(event: APIGatewayProxyEvent): Promise<Record<string, any>> {
  const { headers } = event;
  const contentType = headers['Content-Type'] || headers['content-type'];

  if (!contentType || !contentType.startsWith('multipart/form-data')) {
    throw new Error('Invalid content-type, expected multipart/form-data');
  }

  const busboy = Busboy({ headers });
  const formData: Record<string, any> = {};

  await new Promise<void>((resolve, reject) => {
    busboy.on('file', (name: string, file: NodeJS.ReadableStream, info: any) => {
      const { filename, mimeType } = info;
      const fileChunks: Buffer[] = [];

      file.on('data', (data: Buffer) => {
        fileChunks.push(data);
      });

      file.on('close', () => {
        formData[name] = {
          filename,
          content: Buffer.concat(fileChunks),
          contentType: mimeType,
        };
      });
    });

    busboy.on('field', (name: string, val: string) => {
      formData[name] = val;
    });

    busboy.on('finish', () => {
      resolve();
    });

    busboy.on('error', reject);

    if (event.isBase64Encoded) {
      busboy.end(Buffer.from(event.body || '', 'base64'));
    } else {
      busboy.end(event.body);
    }
  });

  return formData;
}