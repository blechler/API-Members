import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ca-central-1' });
const ddbDocClient = DynamoDBDocument.from(client);

export const getClasses = async () => {
    const objOut = { statusCode: 200 };
    try {
        const { Items } = await ddbDocClient.scan({ TableName: 'potp-classes-v2' });
        objOut.body = Items;
    } catch (err) {
        objOut.statusCode = 500;
        objOut.body = { error: err.message };
    } finally {
        return objOut;
    }
};