import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB configuration for the Members API
 * Provides a configured DynamoDB Document Client instance
 */

const region = process.env.AWS_REGION || 'ca-central-1';

// Create the base DynamoDB client
const client = new DynamoDBClient({ region });

// Create the Document Client with marshalling options
export const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// Table names - these should be environment variables in production
export const TABLES = {
  MEMBERS: process.env.MEMBERS_TABLE || 'potp-member-v2',
  CLASSES: process.env.CLASSES_TABLE || 'potp-classes-v2',
  RACES: process.env.RACES_TABLE || 'potp-races-v2',
  AURAS: process.env.AURAS_TABLE || 'potp-auras',
  GROUPS: process.env.GROUPS_TABLE || 'potp-member-groups-v2',
  SESSIONS: process.env.SESSIONS_TABLE || 'potp-idx-report-member',
} as const;

// Index names
export const INDEXES = {
  SESSIONS_BY_MEMBER: 'member-id-report-id-index',
} as const;