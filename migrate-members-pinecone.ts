/**
 * Migration script to sync all existing members to Pinecone
 *
 * Usage: PINECONE_API_KEY=xxx AWS_PROFILE=potp npx tsx migrate-members-pinecone.ts
 *
 * Add --dry-run to preview without making changes
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { fromSSO } from '@aws-sdk/credential-providers';
import { MemberItem, ClassItem, RaceItem, GroupItem } from './src/models/member.js';
import { syncMemberToPinecone, isPineconeConfigured, LookupTables } from './src/services/pineconeService.js';

// Initialize DynamoDB client with SSO profile credentials
const profile = process.env.AWS_PROFILE || 'default';
const region = process.env.AWS_REGION || 'ca-central-1';

const client = new DynamoDBClient({
  region,
  credentials: fromSSO({ profile })
});

const ddbDocClient = DynamoDBDocumentClient.from(client);
const TABLES = {
  MEMBERS: 'potp-member-v2',
  CLASSES: 'potp-classes-v2',
  RACES: 'potp-races-v2',
  GROUPS: 'potp-member-groups-v2'
};

const DRY_RUN = process.argv.includes('--dry-run');

async function scanTable<T>(tableName: string): Promise<T[]> {
  const items: T[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const params: any = { TableName: tableName };
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await ddbDocClient.send(new ScanCommand(params));
    items.push(...(result.Items || []) as T[]);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

async function loadLookupTables(): Promise<LookupTables> {
  console.log('Loading lookup tables...');
  const [classes, races, groups] = await Promise.all([
    scanTable<ClassItem>(TABLES.CLASSES),
    scanTable<RaceItem>(TABLES.RACES),
    scanTable<GroupItem>(TABLES.GROUPS)
  ]);
  console.log(`  Classes: ${classes.length}, Races: ${races.length}, Groups: ${groups.length}`);
  return { classes, races, groups };
}

async function getAllMembers(): Promise<MemberItem[]> {
  const members: MemberItem[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  console.log('Scanning all members from DynamoDB...');

  do {
    const params: any = {
      TableName: TABLES.MEMBERS,
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await ddbDocClient.send(new ScanCommand(params));
    members.push(...(result.Items || []) as MemberItem[]);
    lastEvaluatedKey = result.LastEvaluatedKey;

    console.log(`  Scanned ${members.length} members so far...`);
  } while (lastEvaluatedKey);

  return members;
}

async function migrate() {
  console.log('=== Member Pinecone Migration Script ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  // Check Pinecone configuration
  if (!isPineconeConfigured()) {
    console.error('ERROR: PINECONE_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Get all members
  const members = await getAllMembers();
  console.log(`\nFound ${members.length} total members`);

  // Filter active members (not deleted) with names
  const activeMembers = members.filter(m => !m.deleted && m.name && m.name.trim().length > 0);
  console.log(`Active members with names: ${activeMembers.length}`);
  console.log(`Deleted or unnamed members (skipped): ${members.length - activeMembers.length}`);
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN - Would sync the following members:');
    for (const member of activeMembers.slice(0, 15)) {
      const status = member.died ? `died ${member.died}SF` : 'alive';
      console.log(`  - ${member.name} (${status})`);
    }
    if (activeMembers.length > 15) {
      console.log(`  ... and ${activeMembers.length - 15} more`);
    }
    console.log('\nRun without --dry-run to execute migration.');
    return;
  }

  // Load lookup tables once (using SSO credentials)
  const lookupTables = await loadLookupTables();

  // Sync each member
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < activeMembers.length; i++) {
    const member = activeMembers[i];
    const progress = `[${i + 1}/${activeMembers.length}]`;

    try {
      console.log(`${progress} Syncing member ${member.name}...`);
      await syncMemberToPinecone(member, lookupTables);
      successCount++;
      console.log(`${progress} ✓ Synced ${member.name}`);
    } catch (error) {
      errorCount++;
      console.error(`${progress} ✗ Error syncing member ${member.name}:`, (error as Error).message);
    }

    // Small delay to avoid rate limiting
    if (i < activeMembers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total member vectors created: ${successCount}`);
}

migrate().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
