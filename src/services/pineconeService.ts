import { Pinecone } from '@pinecone-database/pinecone';
import { MemberItem, ClassItem, RaceItem, GroupItem } from '../models/member.js';
import { ClassRepository } from '../repositories/classRepository.js';
import { RaceRepository } from '../repositories/raceRepository.js';
import { GroupRepository } from '../repositories/groupRepository.js';
import {
  generateEmbedding,
  buildMemberEmbeddingText
} from './embeddingService.js';

// Optional lookup tables that can be passed in (for migration scripts with SSO)
export interface LookupTables {
  classes: ClassItem[];
  races: RaceItem[];
  groups: GroupItem[];
}

/**
 * Service for syncing members to Pinecone vector database
 */

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'potp-embeddings';

let pineconeClient: Pinecone | null = null;

/**
 * Get or create Pinecone client
 */
function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    if (!PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }
    pineconeClient = new Pinecone({ apiKey: PINECONE_API_KEY });
  }
  return pineconeClient;
}

interface PineconeVector {
  id: string;
  values: number[];
  metadata: Record<string, any>;
}

/**
 * Sync a member to Pinecone
 * Generates embedding from member data and upserts to Pinecone
 * @param member - The member to sync
 * @param lookupTables - Optional pre-loaded lookup tables (for migration scripts with SSO credentials)
 */
export async function syncMemberToPinecone(member: MemberItem, lookupTables?: LookupTables): Promise<void> {
  console.log(`Syncing member ${member.id} (${member.name}) to Pinecone...`);

  // Skip deleted members
  if (member.deleted) {
    console.log(`Skipping member ${member.id} - marked as deleted`);
    await deleteMemberFromPinecone(member.id);
    return;
  }

  // Use provided lookup tables or load from repositories
  let classes: ClassItem[];
  let races: RaceItem[];
  let groups: GroupItem[];

  if (lookupTables) {
    classes = lookupTables.classes;
    races = lookupTables.races;
    groups = lookupTables.groups;
  } else {
    // Load lookup tables for name resolution (uses default credentials)
    const classRepository = new ClassRepository();
    const raceRepository = new RaceRepository();
    const groupRepository = new GroupRepository();

    [classes, races, groups] = await Promise.all([
      classRepository.getAll(),
      raceRepository.getAll(),
      groupRepository.getAll()
    ]);
  }

  // Build embedding text
  const embeddingText = buildMemberEmbeddingText(member, classes, races, groups);

  if (!embeddingText || embeddingText.trim().length === 0) {
    console.log(`Skipping member ${member.id} - no text to embed`);
    return;
  }

  console.log(`  Generating embedding for member ${member.id}...`);
  const embedding = await generateEmbedding(embeddingText);

  // Resolve names for metadata
  const raceNames = member.races?.map(id => {
    const race = races.find(r => r.id === id);
    return race?.name || id;
  }).join(', ') || '';

  const classNames = member.classes?.map(id => {
    const cls = classes.find(c => c.id === id);
    return cls?.name || id;
  }).join(', ') || '';

  const groupNames = member.groups?.map(id => {
    const group = groups.find(g => g.id === id);
    return group?.name || id;
  }).join(', ') || '';

  // Build metadata - filter out null/undefined values as Pinecone doesn't accept them
  const metadata: Record<string, any> = {
    type: 'member',
    memberId: member.id,
    name: member.name || '',
    text: embeddingText.substring(0, 3000), // Truncate for metadata limit
    updatedAt: new Date().toISOString()
  };

  // Only add optional fields if they have values
  if (member.pseudonym) metadata.pseudonym = member.pseudonym;
  if (member.title) metadata.title = member.title;
  if (member.born) metadata.born = member.born;
  if (member.died) metadata.died = member.died;
  if (member.level) metadata.level = member.level;
  if (raceNames) metadata.races = raceNames;
  if (classNames) metadata.classes = classNames;
  if (groupNames) metadata.groups = groupNames;
  if (member.religion) metadata.religion = member.religion;

  // Build vector with metadata
  const vector: PineconeVector = {
    id: `member_${member.id}`,
    values: embedding,
    metadata
  };

  // Delete existing vector first (if updating)
  await deleteMemberFromPinecone(member.id);

  // Upsert to Pinecone
  const pinecone = getPineconeClient();
  const index = pinecone.index(PINECONE_INDEX_NAME);
  await index.upsert([vector]);

  console.log(`  Successfully synced member ${member.id} to Pinecone`);
}

/**
 * Delete a member's vector from Pinecone
 */
export async function deleteMemberFromPinecone(memberId: string): Promise<void> {
  console.log(`Deleting vector for member ${memberId} from Pinecone...`);

  try {
    const pinecone = getPineconeClient();
    const index = pinecone.index(PINECONE_INDEX_NAME);

    // Delete the member vector
    await index.deleteOne(`member_${memberId}`);
    console.log(`  Deleted vector for member ${memberId}`);
  } catch (error: any) {
    // Ignore "not found" errors during deletion
    if (error.message?.includes('not found') || error.status === 404) {
      console.log(`  No existing vector found for member ${memberId}`);
    } else {
      throw error;
    }
  }
}

/**
 * Check if Pinecone is configured
 */
export function isPineconeConfigured(): boolean {
  return !!PINECONE_API_KEY;
}
