import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ca-central-1' });
const ddbDocClient = DynamoDBDocument.from(client);

interface ApiResponse {
    statusCode: number;
    body: any;
}

export const getRaces = async (event?: APIGatewayProxyEvent): Promise<ApiResponse> => {
    const params = {
        TableName: 'potp-races-v2',
    };

    try {
        const { Items } = await ddbDocClient.scan(params);
        return { statusCode: 200, body: Items };
    }
    catch (err) {
        console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
        return { 
            statusCode: 500, 
            body: { error: "Failed to load races", details: (err as Error).message }
        };
    }
};