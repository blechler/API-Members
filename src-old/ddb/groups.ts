import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ca-central-1' });
const ddbDocClient = DynamoDBDocument.from(client);

interface ApiResponse {
    statusCode: number;
    body: any;
}

export const getGroups = async (): Promise<ApiResponse> => {
    try {
        const { Items } = await ddbDocClient.scan({ TableName: 'potp-member-groups-v2' });
        return { statusCode: 200, body: Items };
    } catch (err) {
        return {
            statusCode: 500,
            body: { error: (err as Error).message }
        };
    }
};