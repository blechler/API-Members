import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, TABLES } from '../config/database.js';
import { GroupItem } from '../models/member.js';

/**
 * Repository class for Group data access operations.
 * Handles all DynamoDB interactions for member groups.
 */
export class GroupRepository {

  /**
   * Get all available groups
   */
  async getAll(): Promise<GroupItem[]> {
    console.log('groupRepository > getAll');
    
    try {
      const command = new ScanCommand({
        TableName: TABLES.GROUPS
      });

      const result = await ddbDocClient.send(command);
      
      console.log(`groupRepository > getAll > success: ${result.Items?.length || 0} items`);
      return (result.Items as GroupItem[]) || [];
    } catch (error) {
      console.error('groupRepository > getAll > error:', error);
      throw error;
    }
  }
}