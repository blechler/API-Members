import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: 'ca-central-1' });
const ddbDocClient = DynamoDBDocument.from(client);

interface ApiResponse {
    statusCode: number;
    body: any;
}

interface Member {
    id: string;
    born?: number;
    caster_colour?: string | null;
    classes?: string[];
    colour_hex?: string | null;
    deleted?: number;
    descript?: string;
    died?: number;
    ethnicity?: string;
    eyes?: string;
    groups?: string[];
    hair?: string;
    height?: string;
    hp?: number;
    image?: string;
    level?: number;
    name?: string;
    owner?: string;
    pseudonym?: string;
    races?: string[];
    religion?: string;
    title?: string;
    tower_id?: string | null;
    weight?: number;
}

export const getMemberById = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    const id = event.pathParameters?.id;

    if (!id) {
        return { statusCode: 400, body: { error: "Member ID is required" } };
    }

    const params = {
        TableName: 'potp-member-v2',
        Key: {
            id: id
        }
    };

    try {
        const { Item } = await ddbDocClient.get(params);
        if (!Item) {
            return { statusCode: 404, body: { error: "Member not found" } };
        } else {
            return { statusCode: 200, body: Item };
        }
    } catch (err) {
        console.error("Unable to read item. Error:", err);
        return { 
            statusCode: 500, 
            body: { error: "Failed to get the member", details: (err as Error).message }
        };
    }
};

export const getMembers = async (_event?: APIGatewayProxyEvent): Promise<ApiResponse> => {
    async function scanTable(accumulatedItems: any[] = [], lastEvaluatedKey: any = null): Promise<any[]> {
        const params: any = {
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
            const allItems = accumulatedItems.concat(Items || []);
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
        const items = await scanTable();
        return { statusCode: 200, body: items };
    } catch (err) {
        return { 
            statusCode: 500, 
            body: { error: "Failed to scan the table", details: (err as Error).message }
        };
    }
};

export const getMembersByOwner = async (owner: string): Promise<ApiResponse> => {
    const params = {
        TableName: 'potp-member-v2',
        IndexName: 'owner-id-index',
        KeyConditionExpression: '#owner = :owner',
        ExpressionAttributeValues: {
           ':owner': owner
        },
        ExpressionAttributeNames: {
            '#owner': 'owner'
        }
    };

    try {
        const { Items } = await ddbDocClient.query(params);
        return { statusCode: 200, body: Items };
    } catch (err) {
        console.error("Unable to query items. Error JSON:", err);
        return { 
            statusCode: 500, 
            body: { error: "Failed to get characters", details: (err as Error).message }
        };
    }
};

export const putMemberById = async (event: APIGatewayProxyEvent): Promise<ApiResponse> => {
    if (!event.body) {
        return { statusCode: 400, body: { error: "Request body is required" } };
    }

    const body = JSON.parse(event.body);
    console.log('body:', body);

    const item: Member = {
        id: body.id,
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
        owner: body.owner || "",
        pseudonym: body.pseudonym || "",
        races: body.races || [],
        religion: body.religion || "",
        title: body.title || "",
        tower_id: body.tower_id || null,
        weight: body.weight || 0,
    };
    console.log('item:', item);

    const params = {
        TableName: 'potp-member-v2',
        Item: item
    };

    try {
        await ddbDocClient.put(params);
        return { statusCode: 200, body: { message: "Member updated." } };
    } catch (err) {
        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
        return { 
            statusCode: 500, 
            body: { error: "Failed to add the member", details: (err as Error).message }
        };
    }
};

export const postMember = async (memberData: Partial<Member>): Promise<ApiResponse> => {
    const newMember: Member = {
        id: memberData.id || uuidv4(),
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
        return { 
            statusCode: 500, 
            body: { error: "Failed to add the member", details: (err as Error).message }
        };
    }
};