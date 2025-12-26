import { BedrockRuntimeClient, BedrockRuntimeClientConfig, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromSSO } from '@aws-sdk/credential-providers';
import { MemberItem, ClassItem, RaceItem, GroupItem } from '../models/member.js';

/**
 * Service for generating text embeddings for members using Amazon Bedrock Titan
 */

const BEDROCK_REGION = process.env.BEDROCK_REGION || 'us-east-1';
const EMBEDDING_MODEL = process.env.BEDROCK_EMBEDDING_MODEL || 'amazon.titan-embed-text-v2:0';
const EMBEDDING_DIMENSIONS = 1024;
const MAX_TEXT_LENGTH = 24000; // Titan v2 limit

// Use SSO credentials when running locally with AWS_PROFILE
const profile = process.env.AWS_PROFILE;
const bedrockClientConfig: BedrockRuntimeClientConfig = { region: BEDROCK_REGION };
if (profile) {
  bedrockClientConfig.credentials = fromSSO({ profile });
}
const bedrockClient = new BedrockRuntimeClient(bedrockClientConfig);

/**
 * Strip HTML tags and clean text for embedding
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  let cleaned = html;

  // Convert block-level elements to double newlines for paragraph breaks
  cleaned = cleaned.replace(/<\s*(p|div|h[1-6]|li|ul|ol|blockquote|br)\s*[^>]*>/gi, '\n\n');
  cleaned = cleaned.replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|blockquote)\s*>/gi, '\n\n');

  // Remove all remaining tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');

  // Decode HTML entities
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");

  // Normalize whitespace
  cleaned = cleaned.replace(/\n\s*\n/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  return cleaned.trim();
}

/**
 * Build searchable text from member fields
 * Combines all relevant biographical data into a format optimized for semantic search
 */
export function buildMemberEmbeddingText(
  member: MemberItem,
  classes: ClassItem[],
  races: RaceItem[],
  groups: GroupItem[]
): string {
  const parts: string[] = [];

  // Primary identity
  if (member.name) {
    parts.push(`Name: ${member.name}`);
  }
  if (member.pseudonym) {
    parts.push(`Also known as: ${member.pseudonym}`);
  }
  if (member.title) {
    parts.push(`Title: ${member.title}`);
  }

  // Race - resolved names
  if (member.races?.length) {
    const raceNames = member.races
      .map(id => {
        const race = races.find(r => r.id === id);
        return race?.name || id;
      })
      .join(', ');
    parts.push(`Race: ${raceNames}`);
  }

  // Class - resolved names
  if (member.classes?.length) {
    const classNames = member.classes
      .map(id => {
        const cls = classes.find(c => c.id === id);
        return cls?.name || id;
      })
      .join(', ');
    parts.push(`Class: ${classNames}`);
  }

  // Biographical details
  if (member.born) {
    parts.push(`Born: ${member.born}SF`);
  }
  if (member.died) {
    // Include level at death for deceased members
    const levelInfo = member.level ? ` (Level ${member.level} at death)` : '';
    parts.push(`Died: ${member.died}SF${levelInfo}`);
  } else if (member.level) {
    // Current level for living members
    parts.push(`Level: ${member.level}`);
  }

  // Physical characteristics
  const physical: string[] = [];
  if (member.ethnicity) physical.push(`ethnicity: ${member.ethnicity}`);
  if (member.eyes) physical.push(`eyes: ${member.eyes}`);
  if (member.hair) physical.push(`hair: ${member.hair}`);
  if (member.height) physical.push(`height: ${member.height}`);
  if (member.weight) physical.push(`weight: ${member.weight} lbs`);
  if (physical.length) {
    parts.push(`Physical: ${physical.join(', ')}`);
  }

  // Religion
  if (member.religion) {
    parts.push(`Religion: ${member.religion}`);
  }

  // Groups - resolved names
  if (member.groups?.length) {
    const groupNames = member.groups
      .map(id => {
        const group = groups.find(g => g.id === id);
        return group?.name || id;
      })
      .join(', ');
    parts.push(`Groups: ${groupNames}`);
  }

  // Biography (most important for semantic search)
  if (member.descript) {
    parts.push(`Biography: ${stripHtml(member.descript)}`);
  }

  return parts.join('\n');
}

/**
 * Generate embedding for text using Bedrock Titan
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Truncate text to stay within Titan limits
  const truncatedText = text.substring(0, MAX_TEXT_LENGTH);

  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL,
    body: JSON.stringify({
      inputText: truncatedText,
      dimensions: EMBEDDING_DIMENSIONS,
      normalize: true
    }),
    contentType: 'application/json',
    accept: 'application/json',
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  return responseBody.embedding;
}
