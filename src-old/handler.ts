import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { getAuras } from './ddb/auras.js';
import { getGroups } from './ddb/groups.js';
import { getClasses } from './ddb/classes.js';
import { getMemberById, getMembers, getMembersByOwner, putMemberById, postMember } from './ddb/member.js';
import { getRaces } from './ddb/races.js';
import { updateImage, uploadImage } from './s3/s3.js';

const client = new DynamoDBClient({ region: 'ca-central-1' });
const ddbDocClient = DynamoDBDocument.from(client);

interface ApiResponse {
    statusCode: number;
    body: any;
}


/**
 * Main AWS Lambda handler for the Members API
 * 
 * Processes HTTP requests for member CRUD operations, character management, and resource retrieval.
 * Supports GET, POST, PUT methods with proper CORS headers and error handling.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const httpMethod = event.httpMethod;
    console.log(`${httpMethod} ${event.path}`);

    let objOut: APIGatewayProxyResult = {
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

    let objResponse: ApiResponse = { statusCode: 200, body: {} };
    
    let arPath = event.path.split('/');
    arPath.shift();
    console.log('httpMethod:', httpMethod);

    try {
        switch(httpMethod) {
            case "GET":
                objResponse = await handleGet(event);
                break;
            case "PUT":
                objResponse = await handlePut(event);
                break;
            case "POST":
                objResponse = await handlePost(event);
                break;
            case "OPTIONS":
                objResponse = { statusCode: 200, body: { message: 'OK' } };
                break;
            default:
                objOut.statusCode = 405;
                objResponse = { statusCode: 405, body: { message: 'Method not allowed' } };
                break;
        }
    } catch (error) {
        console.error('Error in handler:', error);
        objResponse = { 
            statusCode: 500, 
            body: { message: (error as Error).message } 
        };
    }
     
    objOut = { ...objOut, ...objResponse };
    objOut.body = JSON.stringify(objResponse.body);
    return objOut;
};

/**
 * Handle POST requests for member creation
 */
const handlePost = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    const userGroups = extractUserGroups(event);
    const requiredGroups = ['MemberEditors', 'Deity', 'Administrator'];
    const isAuthorized = userGroups.some(group => requiredGroups.includes(group));

    if (!isAuthorized) {
        return { statusCode: 403, body: { message: "Unauthorized" } };
    }

    let arPath = event.path.split('/');
    arPath.shift();

    let task = arPath.slice(-1)[0];

    switch(task) {
        case 'member':
            return await addMember(event);
        default:
            return { statusCode: 405, body: { message: 'Invalid route' } };
    }
};

/**
 * Add a new member with image upload
 */
const addMember = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    try {
        const uploadImageResponse = await uploadImage(event);
        if (uploadImageResponse.statusCode !== 200) {
            return uploadImageResponse;
        }
        await postMember(uploadImageResponse.body.memberData);
        return { statusCode: 201, body: uploadImageResponse.body };
    } catch (err) {
        console.error("Error processing request:", err);
        return {
            statusCode: 500,
            body: { message: 'Failed to process request', error: (err as Error).message }
        };
    }
};

/**
 * Handle GET requests for member and resource retrieval
 */
const handleGet = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    let arPath = event.path.split('/');
    arPath.shift();
    
    switch (arPath[0]) {
        case 'members':
        case 'members-v2':
            switch (arPath[1]) {
                case undefined:
                    return await getMembers(event);
                case 'characters':
                    return await getCharacters(event);
                case 'classes':
                    return await getClasses(event);
                case 'auras':
                    return await getAuras(event);
                case 'groups':
                    return await getGroups();
                case 'member':
                    return await getMemberById(event);
                case 'races':
                    return await getRaces(event);
                case 'sessions':
                    return await getSessions(event);
                default:
                    return { statusCode: 404, body: { message: 'Route not found' } };
            }
        default:
            return { statusCode: 404, body: { message: 'Route not found' } };
    }
};

/**
 * Handle PUT requests for member updates
 */
const handlePut = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    const userGroups = extractUserGroups(event);
    const requiredGroups = ['MemberEditors', 'Deity', 'Administrator'];
    const isAuthorized = userGroups.some(group => requiredGroups.includes(group));

    if (!isAuthorized) {
        return { statusCode: 403, body: { message: "Unauthorized" } };
    }

    let arPath = event.path.split('/');
    arPath.shift();

    switch (arPath[0]) {
        case 'members':
        case 'members-v2':
            console.log('calling putMembers');
            return await putMembers(event);
        default:
            return { statusCode: 405, body: { message: 'Method not allowed' } };
    }
};

/**
 * Handle member PUT operations
 */
const putMembers = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    let arPath = event.path.split('/');
    arPath.shift();

    switch(arPath[1]) {
        case 'member':
            console.log('calling putMember');
            return await putMember(event);
        default:
            return { statusCode: 405, body: { message: 'Method not allowed' } };
    }
};

/**
 * Update a specific member
 */
const putMember = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    let arPath = event.path.split('/');
    arPath.shift();

    // const memberId = arPath[2]; // unused

    if (arPath.length === 3) {
        const objMember = JSON.parse(event.body || '{}');
        if (!objMember.id) {
            return {
                statusCode: 400,
                body: { message: "Missing member ID" }
            };
        }
        return await putMemberById(event);
    }

    switch(arPath[3]) {
        case 'image':
            console.log('calling updateImage');
            const uploadImageResponse = await updateImage(event, undefined);
            if (uploadImageResponse.statusCode !== 200) {
                return uploadImageResponse;
            }
            return { statusCode: 200, body: { image: uploadImageResponse.body.image } };
        default:
            return { statusCode: 405, body: { message: 'Method not allowed' } };
    }
};

/**
 * Get characters for a specific user
 */
const getCharacters = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    const authClaims = event.requestContext?.authorizer?.claims;
    const requestedSub = event.pathParameters?.sub;
    const currentUserSub = authClaims?.sub;

    if (requestedSub && requestedSub !== currentUserSub) {
        if (!authClaims) {
            return { statusCode: 403, body: { message: "Forbidden" } };
        }

        const groups = authClaims['cognito:groups'];
        let isInGroup = false;

        if (typeof groups === 'string') {
            isInGroup = ['Administrator', 'Deity', 'MemberEditor'].includes(groups);
        } else if (Array.isArray(groups)) {
            isInGroup = groups.some(group => ['Administrator', 'Deity', 'MemberEditor'].includes(group));
        }

        if (!isInGroup) {
            return { statusCode: 403, body: { message: "Forbidden" } };
        }
    }

    const sub = requestedSub || currentUserSub;
    if (!sub) {
        return { statusCode: 400, body: { message: "User ID required" } };
    }

    return await getMembersByOwner(sub);
};

/**
 * Get sessions data for a member
 */
const getSessions = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    let arPath = event.path.split('/');
    const memberId = event.pathParameters?.id;
    
    if (!memberId) {
        return { statusCode: 400, body: { error: "Member ID is required" } };
    }
    
    arPath.shift();
    if (arPath[2] === 'count') {
        return await countReportIdsByMemberId(memberId);
    }
    return await getSessionsByMemberId(memberId);
};

/**
 * Get sessions by member ID
 */
const getSessionsByMemberId = async (memberId: string): Promise<ApiResponse> => {
    let lastEvaluatedKey: any = null;
    let items: any[] = [];

    do {
        const params = {
            TableName: 'potp-idx-report-member',
            IndexName: 'member-id-report-id-index',
            KeyConditionExpression: '#memberId = :memberId',
            ExpressionAttributeNames: {
                '#memberId': 'member-id',
            },
            ExpressionAttributeValues: {
                ':memberId': memberId,
            },
            ExclusiveStartKey: lastEvaluatedKey
        };

        try {
            const { Items, LastEvaluatedKey } = await ddbDocClient.query(params);
            items = items.concat(Items || []);
            lastEvaluatedKey = LastEvaluatedKey;
        } catch (err) {
            console.error("Error querying DynamoDB:", err);
            return {
                statusCode: 500,
                body: { error: "Failed to query DynamoDB", details: (err as Error).message }
            };
        }
    } while (lastEvaluatedKey);

    return { statusCode: 200, body: items };
};

/**
 * Count report IDs by member ID
 */
const countReportIdsByMemberId = async (memberId: string): Promise<ApiResponse> => {
    if (!memberId) {
        console.error("memberId is undefined or null");
        return { statusCode: 400, body: { error: "memberId is required" } };
    }

    let totalCount = 0;
    let lastEvaluatedKey: any = null;

    do {
        const params: any = {
            TableName: 'potp-idx-report-member',
            IndexName: 'member-id-report-id-index',
            KeyConditionExpression: '#memberId = :memberId',
            ExpressionAttributeNames: { '#memberId': 'member-id' },
            ExpressionAttributeValues: { ':memberId': memberId },
            Select: 'COUNT',
            ScanIndexForward: false
        };
        
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        try {
            const result = await ddbDocClient.query(params);
            totalCount += result.Count || 0;
            lastEvaluatedKey = result.LastEvaluatedKey;
        } catch (err) {
            console.error("Error querying DynamoDB:", err);
            return {
                statusCode: 500,
                body: { error: "Failed to query DynamoDB", details: (err as Error).message }
            };
        }
    } while (lastEvaluatedKey);

    return { statusCode: 200, body: { count: totalCount } };
};

/**
 * Extract user groups from the event context
 */
const extractUserGroups = (event: APIGatewayProxyEvent): string[] => {
    return event.requestContext?.authorizer?.claims?.['cognito:groups']?.split(',') || [];
};

/**
 * Helper function to extract path segments from the request path
 */
