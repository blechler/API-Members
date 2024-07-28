import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ca-central-1' });
const ddbDocClient = DynamoDBDocument.from(client);

export const getMember = async (event) => {
    const objOut = { statusCode: 200 };
    const id = event.pathParameters?.id;

    const params = {
        TableName: 'potp-member-v2',
        Key: {
            id: id
        }
    };

    try {
        const { Item } = await ddbDocClient.get(params);
        if (!Item) {
            objOut.statusCode = 404; // Not Found
            objOut.body = { error: "Member not found" };
        } else {
            objOut.body = Item;
        }
    } catch (err) {
        console.error("Unable to read item. Error:", err);
        objOut.statusCode = 500; // Internal Server Error
        objOut.body = JSON.stringify({ error: "Failed to get the member", details: err.message });
    }

    console.log('objOut:', objOut);
    return objOut;
};

export const getMembers = async () => {
    const objOut = { statusCode: 200 };

    async function scanTable(accumulatedItems = [], lastEvaluatedKey = null) {
        const params = {
            TableName: 'potp-member-v2',
            ProjectionExpression: '#id, #name, #born, #died, #image, #groups',
            ExpressionAttributeNames: {
                '#id': 'id',
                '#name': 'name',
                '#born': 'born',
                '#died': 'died',
                '#image': 'image',
                '#groups': 'groups'
            }
        };

        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        try {
            const { Items, LastEvaluatedKey } = await ddbDocClient.scan(params);
            const allItems = accumulatedItems.concat(Items);
            if (LastEvaluatedKey) {
                return scanTable(allItems, LastEvaluatedKey);
            }
            return allItems;
        } catch (err) {
            console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
            throw err;
        }
    }

    try {
        objOut.body = await scanTable();
    } catch (err) {
        objOut.statusCode = 500; // Internal Server Error
        objOut.body = { error: "Failed to scan the table", details: err.message };
    }

    return objOut;
};

export const getMembersByOwner = async (owner) => {
    const objOut = { statusCode: 200 };
    const params = {
        TableName: 'potp-member-v2',
        IndexName: 'owner-id-index',
        KeyConditionExpression: '#owner = :owner',
        ExpressionAttributeValues: {
           ':owner': owner
        },
        ExpressionAttributeNames: {
            '#owner': 'owner' // Define the placeholder
        }
    };

    try {
        const { Items } = await ddbDocClient.query(params);
        return { statusCode: 200, body: Items };
    } catch (err) {
        console.error("Unable to query items. Error JSON:", err);
        return { statusCode: 500, body: { error: "Failed to get characters", details: err.message } };
    }
}