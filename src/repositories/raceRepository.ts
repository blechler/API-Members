import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDocClient, TABLES } from '../config/database.js';
import { RaceItem } from '../models/member.js';

/**
 * Repository class for Race data access operations.
 * Handles all DynamoDB interactions for character races.
 */
export class RaceRepository {

  /**
   * Get all available races
   */
  async getAll(): Promise<RaceItem[]> {
    console.log('raceRepository > getAll');
    
    try {
      const command = new ScanCommand({
        TableName: TABLES.RACES
      });

      const result = await ddbDocClient.send(command);
      
      console.log(`raceRepository > getAll > success: ${result.Items?.length || 0} items`);
      return (result.Items as RaceItem[]) || [];
    } catch (error) {
      console.error('raceRepository > getAll > error:', error);
      throw error;
    }
  }
}