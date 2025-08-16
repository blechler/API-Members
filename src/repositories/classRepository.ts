import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, TABLES } from '../config/database.js';
import { ClassItem } from '../models/member.js';

/**
 * Repository class for Class data access operations.
 * Handles all DynamoDB interactions for character classes.
 */
export class ClassRepository {

  /**
   * Get all available classes
   */
  async getAll(): Promise<ClassItem[]> {
    console.log('classRepository > getAll');
    
    try {
      const command = new ScanCommand({
        TableName: TABLES.CLASSES
      });

      const result = await ddbDocClient.send(command);
      
      console.log(`classRepository > getAll > success: ${result.Items?.length || 0} items`);
      return (result.Items as ClassItem[]) || [];
    } catch (error) {
      console.error('classRepository > getAll > error:', error);
      throw error;
    }
  }
}