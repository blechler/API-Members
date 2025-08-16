import { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthenticationResult {
  statusCode: number;
  message?: string;
  userGroups?: string[];
  isAuthorized?: boolean;
}

/**
 * Extract user groups from the event context
 */
export function extractUserGroups(event: APIGatewayProxyEvent): string[] {
  return event.requestContext?.authorizer?.claims?.['cognito:groups']?.split(',') || [];
}

/**
 * Check if user is authorized for member operations
 */
export function checkMemberAuthorization(event: APIGatewayProxyEvent): AuthenticationResult {
  const userGroups = extractUserGroups(event);
  const requiredGroups = ['MemberEditors', 'Deity', 'Administrator'];
  const isAuthorized = userGroups.some(group => requiredGroups.includes(group));

  if (!isAuthorized) {
    return { 
      statusCode: 403, 
      message: 'Unauthorized - insufficient permissions',
      userGroups,
      isAuthorized: false
    };
  }

  return { 
    statusCode: 200, 
    message: 'Authorized',
    userGroups,
    isAuthorized: true
  };
}

/**
 * Check if user can access specific member's characters
 */
export function checkCharacterAccess(event: APIGatewayProxyEvent, requestedSub?: string): AuthenticationResult {
  const authClaims = event.requestContext?.authorizer?.claims;
  const currentUserSub = authClaims?.sub;

  if (requestedSub && requestedSub !== currentUserSub) {
    if (!authClaims) {
      return { statusCode: 403, message: 'Forbidden' };
    }

    const groups = authClaims['cognito:groups'];
    let isInGroup = false;

    if (typeof groups === 'string') {
      isInGroup = ['Administrator', 'Deity', 'MemberEditor'].includes(groups);
    } else if (Array.isArray(groups)) {
      isInGroup = groups.some(group => ['Administrator', 'Deity', 'MemberEditor'].includes(group));
    }

    if (!isInGroup) {
      return { statusCode: 403, message: 'Forbidden' };
    }
  }

  return { 
    statusCode: 200, 
    message: 'Authorized',
    isAuthorized: true
  };
}