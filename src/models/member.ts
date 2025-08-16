export interface MemberItem {
  // Primary identifier
  id: string;        // Member ID
  
  // Member basic information
  name?: string;
  pseudonym?: string;
  title?: string;
  descript?: string;
  owner?: string;
  
  // Physical characteristics
  born?: number;
  died?: number;
  ethnicity?: string;
  eyes?: string;
  hair?: string;
  height?: string;
  weight?: number;
  
  // Game mechanics
  hp?: number;
  level?: number;
  colour_hex?: string | null;
  caster_colour?: string | null;
  classes?: string[];
  races?: string[];
  religion?: string;
  groups?: string[];
  
  // Tower association
  tower_id?: string | null;
  
  // Media
  image?: string;
  
  // Metadata
  deleted?: number;
}

export interface CreateMemberRequest {
  name?: string;
  pseudonym?: string;
  title?: string;
  descript?: string;
  owner?: string;
  born?: number;
  died?: number;
  ethnicity?: string;
  eyes?: string;
  hair?: string;
  height?: string;
  weight?: number;
  hp?: number;
  level?: number;
  colour_hex?: string | null;
  caster_colour?: string | null;
  classes?: string[];
  races?: string[];
  religion?: string;
  groups?: string[];
  tower_id?: string | null;
  image?: string;
}

export interface UpdateMemberRequest {
  name?: string;
  pseudonym?: string;
  title?: string;
  descript?: string;
  owner?: string;
  born?: number;
  died?: number;
  ethnicity?: string;
  eyes?: string;
  hair?: string;
  height?: string;
  weight?: number;
  hp?: number;
  level?: number;
  colour_hex?: string | null;
  caster_colour?: string | null;
  classes?: string[];
  races?: string[];
  religion?: string;
  groups?: string[];
  tower_id?: string | null;
  image?: string;
}

export interface ClassItem {
  [key: string]: any;
}

export interface RaceItem {
  [key: string]: any;
}

export interface AuraItem {
  [key: string]: any;
}

export interface GroupItem {
  [key: string]: any;
}

export interface SessionItem {
  'member-id': string;
  'report-id': string;
  [key: string]: any;
}

export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  lastEvaluatedKey?: Record<string, any>;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

export interface ServiceErrorResponse {
  success: false;
  error: ServiceError;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
}

export interface ApiResponse {
  statusCode: number;
  body: any;
}