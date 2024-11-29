import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

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

export const putMember = async (event) => {
    const body = JSON.parse(event.body);
    console.log('body:', body);

    // Mapping incoming data to the required schema
    const item = {
        id: body.id || uuidv4(), // Generate a UUID if id is not provided
        born: body.born,
        caster_colour: body.caster_colour || null,
        classes: body.classes || [],
        colour_hex: body.colour_hex || null,
        deleted: body.deleted || 0,
        descript: body.descript || "",
        died: body.died || 0,
        ethnicity: body.ethnicity || "",
        eyes: body.eyes || "",
        groups: body.groups || [],
        hair: body.hair || "",
        height: body.height || "",
        hp: body.hp || 0,
        image: body.image ? body.image.substring(body.image.lastIndexOf('/') + 1) : "",
        level: body.level || 0,
        name: body.name || "",
        old_id: body.old_id || null,
        owner: body.owner || "",
        pseudonym: body.pseudonym || "",
        races: body.races || [],
        religion: body.religion || "",
        title: body.title || "",
        tower_id: body.tower_id || null,
        weight: body.weight || 0,
    };

    const params = {
        TableName: 'potp-member-v2',
        Item: item
    };

    try {
        await ddbDocClient.put(params);
        return { statusCode: 200, body: JSON.stringify({ message: "Member added successfully" }) };
    } catch (err) {
        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
        return { statusCode: 500, body: JSON.stringify({ error: "Failed to add the member", details: err.message }) };
    }
};

export const postMember = async (memberData) => {
    // Mapping incoming data to the required schema
    const newMember = {
        id: memberData.id || uuidv4(), // Generate a UUID if id is not provided
        born: memberData.born,
        caster_colour: memberData.caster_colour || null,
        classes: memberData.classes || [],
        colour_hex: memberData.colour_hex || null,
        deleted: memberData.deleted || 0,
        descript: memberData.descript || "",
        died: memberData.died || 0,
        ethnicity: memberData.ethnicity || "",
        eyes: memberData.eyes || "",
        groups: memberData.groups || [],
        hair: memberData.hair || "",
        height: memberData.height || "",
        hp: memberData.hp || 0,
        image: memberData.image || "",
        level: memberData.level || 0,
        name: memberData.name || "",
        owner: memberData.owner || "",
        pseudonym: memberData.pseudonym || "",
        races: memberData.races || [],
        religion: memberData.religion || "",
        title: memberData.title || "",
        tower_id: memberData.tower_id || null,
        weight: memberData.weight || 0,
    };

    const params = {
        TableName: 'potp-member-v2',
        Item: newMember
    };

    try {
        await ddbDocClient.put(params);
        return { statusCode: 200, body: { id: newMember.id } };
    } catch (err) {
        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
        return { statusCode: 500, body: { error: "Failed to add the member", details: err.message } };
    }
};