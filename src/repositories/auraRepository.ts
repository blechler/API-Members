import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, TABLES } from '../config/database.js';
import { AuraItem } from '../models/member.js';

/**
 * Repository class for Aura data access operations.
 * Handles all DynamoDB interactions for auras.
 */
export class AuraRepository {

  /**
   * Get all available auras
   */
  async getAll(): Promise<AuraItem[]> {
    console.log('auraRepository > getAll');
    
    try {
      const command = new ScanCommand({
        TableName: TABLES.AURAS
      });

      const result = await ddbDocClient.send(command);
      
      console.log(`auraRepository > getAll > success: ${result.Items?.length || 0} items`);
      return (result.Items as AuraItem[]) || [];
    } catch (error) {
      console.error('auraRepository > getAll > error:', error);
      throw error;
    }
  }
}