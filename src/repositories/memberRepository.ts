import { 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  ScanCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ddbDocClient, TABLES, INDEXES } from '../config/database.js';
import { 
  MemberItem, 
  CreateMemberRequest, 
  UpdateMemberRequest,
  SessionItem
} from '../models/member.js';

/**
 * Repository class for Member data access operations.
 * Handles all DynamoDB interactions for members.
 */
export class MemberRepository {

  /**
   * Create a new member in DynamoDB
   */
  async create(request: CreateMemberRequest): Promise<MemberItem> {
    console.log('memberRepository > create > request:', request);
    
    try {
      const id = uuidv4();
      
      const dbMember = {
        id,
        name: request.name || '',
        pseudonym: request.pseudonym || '',
        title: request.title || '',
        descript: request.descript || '',
        owner: request.owner || '',
        born: request.born,
        died: request.died,
        ethnicity: request.ethnicity,
        eyes: request.eyes,
        hair: request.hair,
        height: request.height,
        weight: request.weight || 0,
        hp: request.hp || 1,
        level: request.level || 1,
        colour_hex: request.colour_hex,
        caster_colour: request.caster_colour,
        classes: request.classes || [],
        races: request.races || [],
        religion: request.religion,
        groups: request.groups || [],
        tower_id: request.tower_id,
        image: request.image
      };

      const command = new PutCommand({
        TableName: TABLES.MEMBERS,
        Item: dbMember
      });

      await ddbDocClient.send(command);
      
      console.log('memberRepository > create > success:', id);
      return dbMember;
    } catch (error) {
      console.error('memberRepository > create > error:', error);
      throw error;
    }
  }

  /**
   * Get member by ID
   */
  async getById(id: string): Promise<MemberItem | null> {
    console.log('memberRepository > getById > id:', id);
    
    try {
      const command = new GetCommand({
        TableName: TABLES.MEMBERS,
        Key: { id }
      });

      const result = await ddbDocClient.send(command);
      
      if (!result.Item) {
        console.log('memberRepository > getById > not found');
        return null;
      }

      console.log('memberRepository > getById > success');
      return result.Item as MemberItem;
    } catch (error) {
      console.error('memberRepository > getById > error:', error);
      throw error;
    }
  }

  /**
   * Get all members with projection
   */
  async getAll(): Promise<MemberItem[]> {
    console.log('memberRepository > getAll');
    
    try {
      let allItems: MemberItem[] = [];
      let lastEvaluatedKey: any = null;

      do {
        const params: any = {
          TableName: TABLES.MEMBERS,
          ProjectionExpression: 'id, #name, born, died, image, groups',
          ExpressionAttributeNames: {
            '#name': 'name'
          }
        };

        if (lastEvaluatedKey) {
          params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const command = new ScanCommand(params);
        const result = await ddbDocClient.send(command);

        if (result.Items) {
          allItems = allItems.concat(result.Items as MemberItem[]);
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      console.log(`memberRepository > getAll > success: ${allItems.length} items`);
      return allItems;
    } catch (error) {
      console.error('memberRepository > getAll > error:', error);
      throw error;
    }
  }

  /**
   * Get members by owner
   */
  async getByOwner(ownerId: string): Promise<MemberItem[]> {
    console.log('memberRepository > getByOwner > ownerId:', ownerId);
    
    try {
      let allItems: MemberItem[] = [];
      let lastEvaluatedKey: any = null;

      do {
        const params: any = {
          TableName: TABLES.MEMBERS,
          FilterExpression: '#owner = :owner',
          ExpressionAttributeNames: {
            '#owner': 'owner'
          },
          ExpressionAttributeValues: {
            ':owner': ownerId
          }
        };

        if (lastEvaluatedKey) {
          params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const command = new ScanCommand(params);
        const result = await ddbDocClient.send(command);

        if (result.Items) {
          allItems = allItems.concat(result.Items as MemberItem[]);
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      console.log(`memberRepository > getByOwner > success: ${allItems.length} items`);
      return allItems;
    } catch (error) {
      console.error('memberRepository > getByOwner > error:', error);
      throw error;
    }
  }

  /**
   * Update member by ID
   */
  async update(id: string, updates: UpdateMemberRequest): Promise<MemberItem> {
    console.log('memberRepository > update > id:', id, 'updates:', updates);
    
    try {
      // Build update expression dynamically
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const attributeName = `#${key}`;
          const attributeValue = `:${key}`;
          
          updateExpressions.push(`${attributeName} = ${attributeValue}`);
          expressionAttributeNames[attributeName] = key;
          expressionAttributeValues[attributeValue] = value;
        }
      });

      if (updateExpressions.length === 0) {
        throw new Error('No valid updates provided');
      }

      const command = new UpdateCommand({
        TableName: TABLES.MEMBERS,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      });

      const result = await ddbDocClient.send(command);
      
      console.log('memberRepository > update > success');
      return result.Attributes as MemberItem;
    } catch (error) {
      console.error('memberRepository > update > error:', error);
      throw error;
    }
  }

  /**
   * Get sessions by member ID
   */
  async getSessionsByMemberId(memberId: string): Promise<SessionItem[]> {
    console.log('memberRepository > getSessionsByMemberId > memberId:', memberId);
    
    try {
      let allItems: SessionItem[] = [];
      let lastEvaluatedKey: any = null;

      do {
        const params: any = {
          TableName: TABLES.SESSIONS,
          IndexName: INDEXES.SESSIONS_BY_MEMBER,
          KeyConditionExpression: '#memberId = :memberId',
          ExpressionAttributeNames: {
            '#memberId': 'member-id',
          },
          ExpressionAttributeValues: {
            ':memberId': memberId,
          }
        };

        if (lastEvaluatedKey) {
          params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const command = new QueryCommand(params);
        const result = await ddbDocClient.send(command);

        if (result.Items) {
          allItems = allItems.concat(result.Items as SessionItem[]);
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      console.log(`memberRepository > getSessionsByMemberId > success: ${allItems.length} items`);
      return allItems;
    } catch (error) {
      console.error('memberRepository > getSessionsByMemberId > error:', error);
      throw error;
    }
  }

  /**
   * Count sessions by member ID
   */
  async countSessionsByMemberId(memberId: string): Promise<number> {
    console.log('memberRepository > countSessionsByMemberId > memberId:', memberId);
    
    try {
      let totalCount = 0;
      let lastEvaluatedKey: any = null;

      do {
        const params: any = {
          TableName: TABLES.SESSIONS,
          IndexName: INDEXES.SESSIONS_BY_MEMBER,
          KeyConditionExpression: '#memberId = :memberId',
          ExpressionAttributeNames: { '#memberId': 'member-id' },
          ExpressionAttributeValues: { ':memberId': memberId },
          Select: 'COUNT',
          ScanIndexForward: false
        };
        
        if (lastEvaluatedKey) {
          params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const command = new QueryCommand(params);
        const result = await ddbDocClient.send(command);
        
        totalCount += result.Count || 0;
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      console.log(`memberRepository > countSessionsByMemberId > success: ${totalCount}`);
      return totalCount;
    } catch (error) {
      console.error('memberRepository > countSessionsByMemberId > error:', error);
      throw error;
    }
  }
}