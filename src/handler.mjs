import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getGroups } from './ddb/groups.mjs';
import { getClasses } from './ddb/classes.mjs';
import { getMember, getMembers, getMembersByOwner } from './ddb/member.mjs';
import { getRaces } from './ddb/races.mjs';

const client = new DynamoDBClient({ region: 'ca-central-1' });
const ddbDocClient = DynamoDBDocument.from(client);

/**
 * A Lambda function that returns a greeting.
 *
 * @param {Object} event - The event object.
 * @param {Object} context - The context object.
 * @param {function} callback - The callback function.
 * @returns {Object} - The response object.
 */
export async function handler(event, context, callback) {
    console.log('event:', event);
    const httpMethod = event.httpMethod;

    let objOut = {
        statusCode: 200,
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400' // Optional
        }
    };

    let objResponse;
    
    let arPath = event.path.split('/');
    arPath.shift();

    switch(httpMethod) {
        case "GET":
           objResponse = await handleGet(event);
           break;
        case "PUT":
           objResponse = await handlePut(event);
           break;
        case "POST":
           objOut.statusCode = 405;
           break;
        default:
           objOut.statusCode = 405;
           break;
    }
     
    objOut = { ...objOut, ...objResponse };
    objOut.body = JSON.stringify(objOut.body);
    return objOut;
}

/**
 * Handle GET method
 * @param {Object} event - The event object.
 * @returns {Object} - The response object.
 */
const handleGet = async (event) => {
    let arPath = event.path.split('/');
    arPath.shift();
    switch (arPath[0]) {
        case 'members':
        case 'members-v2':
            switch (arPath[1]) {
                case undefined:
                    return await getMembers(event); // Get all members
                case 'characters':
                    return await getCharacters(event);
                case 'classes':
                    return await getClasses(event); // Get all classes from the DDB table 'Classes' (see src/ddb/classes.mjs)
                case 'groups':
                    return await getGroups(); // Get all groups from the DDB table 'Groups' (see src/ddb/groups.mjs)
                case 'member':
                    return await getMember(event);
                case 'races':
                    return await getRaces(event);
                case 'sessions':
                    return await getSessions(event);
                default:
                    // Handle unknown path
            }
            break;
        default:
            // Handle unknown path
            break;
    }
};

/**
 * Handle PUT method
 * @param {Object} event - The event object.
 * @returns {Object} - The response object.
 */
const handlePut = async (event) => {
    // Step 1: Extract user's groups from the event
    // This is a placeholder; you'll need to adjust it based on how groups are passed in your setup
    const userGroups = event.requestContext.authorizer.claims['cognito:groups']?.split(',') || [];
    console.log('userGroups:', userGroups);

    // Step 2: Check for required group membership
    const requiredGroups = ['MemberEditors', 'Deity', 'Administrator'];
    const isAuthorized = userGroups.some(group => requiredGroups.includes(group));

    if (!isAuthorized) {
        console.log('event.requestContext.authorizer:', event.requestContext.authorizer);
        // User does not have the required permissions
        return { statusCode: 403, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    // Existing function logic...
    let pathParam = event.pathParameters?.id;
    let arPath = event.path.split('/');
    arPath.shift();

    let task = (pathParam) ? arPath.slice(-2)[0] : arPath.slice(-1)[0];
    task = (event.pathParameters?.sub) ? 'characters' : task;
    console.log('task:', task);
    let objOut = { statusCode: 200 };

    switch(task) {
        case 'member':
            objOut = await putMember(event);
            break;
        default:
            objOut.statusCode = 405;
            break;
    }

    return objOut;
};
    

const getCharacters = async (event) => {
    if ((event.pathParameters?.sub) && (event.pathParameters?.sub !== event.requestContext.authorizer.claims.sub)) {
        if (event.requestContext.authorizer && event.requestContext.authorizer.claims) {
            const groups = event.requestContext.authorizer.claims['cognito:groups'];
            let isInGroup = false;

            // Check if groups is a string and directly compare
            if (typeof groups === 'string') {
                isInGroup = ['Administrator', 'Deity', 'MemberEditor'].includes(groups);
            } 
            // If groups is an array, use .some() to find if the group exists
            else if (Array.isArray(groups)) {
                isInGroup = groups.some(group => ['Administrator', 'Deity', 'MemberEditor'].includes(group));
            }

            // If user is not in any of the required groups, return 403 Forbidden
            if (!isInGroup) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ message: "Forbidden" })
                };
            }
        } else {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: "Forbidden" })
            };
        }
    }

    
    const sub = event.pathParameters?.sub || event.requestContext.authorizer.claims.sub;

    return await getMembersByOwner(sub);
};

const getSessionsByMemberId = async (memberId) => {
    const objOut = { statusCode: 200 };
    let lastEvaluatedKey = null;
    let items = [];

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
            ExclusiveStartKey: lastEvaluatedKey // null is acceptable for the first query
        };
        console.log('getSessionsByMemberId - params:', params);

        try {
            const { Items, LastEvaluatedKey } = await ddbDocClient.query(params);
            items = items.concat(Items);
            lastEvaluatedKey = LastEvaluatedKey;
        } catch (err) {
            console.error("Error querying DynamoDB:", err);
            objOut.statusCode = 500; // Internal Server Error
            objOut.body = { error: "Failed to query DynamoDB", details: err.message };
            return objOut;
        }
    } while (lastEvaluatedKey);

    objOut.body = items;
    return objOut;
}

const getSessions = async (event) => {
    let arPath = event.path.split('/');
    const memberId = event.pathParameters?.id;
    if (!memberId) {
        return { statusCode: 400, body: { error: "Member ID is required" } };
    }
    arPath.shift();
    if (arPath[2] === 'count') {
        console.log('countReportIdsByMemberId');
        return await countReportIdsByMemberId(memberId);
    }
    return await getSessionsByMemberId(memberId);
}

/**
 * Counts the number of report IDs associated with a given member ID.
 * @param {string} memberId The ID of the member to count report IDs for.
 * @returns {Promise<number>} The total count of report IDs.
 */
const countReportIdsByMemberId = async (memberId) => {
    if (!memberId) {
        console.error("memberId is undefined or null");
        return { statusCode: 400, body: { error: "memberId is required" } };
    }

    const objOut = { statusCode: 200 };
    let totalCount = 0;
    let lastEvaluatedKey = null;

    do {
        const params = {
            TableName: 'potp-idx-report-member',
            IndexName: 'member-id-report-id-index',
            KeyConditionExpression: '#memberId = :memberId',
            ExpressionAttributeNames: { '#memberId': 'member-id' },
            ExpressionAttributeValues: { ':memberId': memberId },
            Select: 'COUNT',
            ScanIndexForward: false // Optional: If order doesn't matter
        };
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        try {
            const result = await ddbDocClient.query(params);
            totalCount += result.Count;
            lastEvaluatedKey = result.LastEvaluatedKey;
        } catch (err) {
            console.error("Error querying DynamoDB:", err);
            return {
                statusCode: 500,
                body: { error: "Failed to query DynamoDB", details: err.message }
            };
        }
    } while (lastEvaluatedKey);

    objOut.body = { count: totalCount };
    return objOut;
};

const putMember = async (event) => {
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
