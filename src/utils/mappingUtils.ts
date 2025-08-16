import { 
  CreateMemberRequest,
  UpdateMemberRequest,
  ServiceResponse,
  ServiceErrorResponse
} from '../models/member.js';

/**
 * Sanitize and validate create member request
 */
export function sanitizeCreateMemberRequest(rawData: any): CreateMemberRequest {
  return {
    name: rawData.name?.toString().trim() || '',
    pseudonym: rawData.pseudonym?.toString().trim() || '',
    title: rawData.title?.toString().trim() || '',
    descript: rawData.descript?.toString().trim() || '',
    owner: rawData.owner?.toString().trim() || '',
    born: rawData.born ? Number(rawData.born) : undefined,
    died: rawData.died ? Number(rawData.died) : undefined,
    ethnicity: rawData.ethnicity?.toString().trim() || '',
    eyes: rawData.eyes?.toString().trim() || '',
    hair: rawData.hair?.toString().trim() || '',
    height: rawData.height?.toString().trim() || '',
    weight: rawData.weight ? Number(rawData.weight) : 0,
    hp: rawData.hp ? Number(rawData.hp) : 1,
    level: rawData.level ? Number(rawData.level) : 1,
    colour_hex: rawData.colour_hex || null,
    caster_colour: rawData.caster_colour || null,
    classes: Array.isArray(rawData.classes) ? rawData.classes : [],
    races: Array.isArray(rawData.races) ? rawData.races : [],
    religion: rawData.religion?.toString().trim() || '',
    groups: Array.isArray(rawData.groups) ? rawData.groups : [],
    tower_id: rawData.tower_id || null,
    image: rawData.image?.toString().trim() || ''
  };
}

/**
 * Sanitize and validate update member request
 */
export function sanitizeUpdateMemberRequest(rawData: any): UpdateMemberRequest {
  const updates: UpdateMemberRequest = {};

  if (rawData.name !== undefined) {
    updates.name = rawData.name.toString().trim();
  }
  if (rawData.pseudonym !== undefined) {
    updates.pseudonym = rawData.pseudonym.toString().trim();
  }
  if (rawData.title !== undefined) {
    updates.title = rawData.title.toString().trim();
  }
  if (rawData.descript !== undefined) {
    updates.descript = rawData.descript.toString().trim();
  }
  if (rawData.owner !== undefined) {
    updates.owner = rawData.owner.toString().trim();
  }
  if (rawData.born !== undefined) {
    updates.born = Number(rawData.born);
  }
  if (rawData.died !== undefined) {
    updates.died = Number(rawData.died);
  }
  if (rawData.ethnicity !== undefined) {
    updates.ethnicity = rawData.ethnicity.toString().trim();
  }
  if (rawData.eyes !== undefined) {
    updates.eyes = rawData.eyes.toString().trim();
  }
  if (rawData.hair !== undefined) {
    updates.hair = rawData.hair.toString().trim();
  }
  if (rawData.height !== undefined) {
    updates.height = rawData.height.toString().trim();
  }
  if (rawData.weight !== undefined) {
    updates.weight = Number(rawData.weight);
  }
  if (rawData.hp !== undefined) {
    updates.hp = Number(rawData.hp);
  }
  if (rawData.level !== undefined) {
    updates.level = Number(rawData.level);
  }
  if (rawData.colour_hex !== undefined) {
    updates.colour_hex = rawData.colour_hex;
  }
  if (rawData.caster_colour !== undefined) {
    updates.caster_colour = rawData.caster_colour;
  }
  if (rawData.classes !== undefined) {
    updates.classes = Array.isArray(rawData.classes) ? rawData.classes : [];
  }
  if (rawData.races !== undefined) {
    updates.races = Array.isArray(rawData.races) ? rawData.races : [];
  }
  if (rawData.religion !== undefined) {
    updates.religion = rawData.religion.toString().trim();
  }
  if (rawData.groups !== undefined) {
    updates.groups = Array.isArray(rawData.groups) ? rawData.groups : [];
  }
  if (rawData.tower_id !== undefined) {
    updates.tower_id = rawData.tower_id;
  }
  if (rawData.image !== undefined) {
    updates.image = rawData.image.toString().trim();
  }

  return updates;
}

/**
 * Convert service response to HTTP response format
 */
export function convertServiceResponse<T>(serviceResponse: ServiceResponse<T>): { statusCode: number; body: any } {
  if (serviceResponse.success) {
    return {
      statusCode: 200,
      body: serviceResponse.data
    };
  } else {
    const errorResponse = serviceResponse as ServiceErrorResponse;
    const statusCode = getStatusCodeFromError(errorResponse.error.code);
    return {
      statusCode,
      body: errorResponse.error
    };
  }
}

/**
 * Map error codes to HTTP status codes
 */
export function getStatusCodeFromError(errorCode: string): number {
  switch (errorCode) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'MEMBER_NOT_FOUND':
      return 404;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}

/**
 * Extract path segments from request path
 */
export function getPathSegments(path: string): string[] {
  return path.split('/').filter(segment => segment.length > 0);
}