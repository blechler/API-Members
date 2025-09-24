import { MemberRepository } from '../repositories/memberRepository.js';
import { ClassRepository } from '../repositories/classRepository.js';
import { RaceRepository } from '../repositories/raceRepository.js';
import { AuraRepository } from '../repositories/auraRepository.js';
import { GroupRepository } from '../repositories/groupRepository.js';
import { ImageService } from './imageService.js';
import { 
  MemberItem, 
  CreateMemberRequest, 
  UpdateMemberRequest,
  ServiceResponse,
  ClassItem,
  RaceItem,
  AuraItem,
  GroupItem,
  SessionItem
} from '../models/member.js';

/**
 * Service class for Member business logic.
 * Orchestrates operations between repositories and implements business rules.
 */
export class MemberService {
  private memberRepository: MemberRepository;
  private classRepository: ClassRepository;
  private raceRepository: RaceRepository;
  private auraRepository: AuraRepository;
  private groupRepository: GroupRepository;
  private imageService: ImageService;

  constructor(
    memberRepository?: MemberRepository,
    classRepository?: ClassRepository,
    raceRepository?: RaceRepository,
    auraRepository?: AuraRepository,
    groupRepository?: GroupRepository,
    imageService?: ImageService
  ) {
    this.memberRepository = memberRepository || new MemberRepository();
    this.classRepository = classRepository || new ClassRepository();
    this.raceRepository = raceRepository || new RaceRepository();
    this.auraRepository = auraRepository || new AuraRepository();
    this.groupRepository = groupRepository || new GroupRepository();
    this.imageService = imageService || new ImageService();
  }

  /**
   * Create a new member with business validation
   */
  async createMember(request: CreateMemberRequest): Promise<ServiceResponse<MemberItem>> {
    console.log('memberService > createMember > request:', request);

    try {
      // Validate required fields
      if (!request.name || request.name.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Member name cannot be empty'
          }
        };
      }

      // Create the member
      const member = await this.memberRepository.create(request);
      
      return {
        success: true,
        data: member
      };
    } catch (error) {
      console.error('memberService > createMember > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to create member: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Get member by ID
   */
  async getMemberById(id: string): Promise<ServiceResponse<MemberItem>> {
    console.log('memberService > getMemberById > id:', id);

    try {
      if (!id || id.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Member ID is required'
          }
        };
      }

      const member = await this.memberRepository.getById(id);
      
      if (!member) {
        return {
          success: false,
          error: {
            code: 'MEMBER_NOT_FOUND',
            message: 'Member not found'
          }
        };
      }

      return {
        success: true,
        data: member
      };
    } catch (error) {
      console.error('memberService > getMemberById > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to get member: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Get all members
   */
  async getAllMembers(): Promise<ServiceResponse<MemberItem[]>> {
    console.log('memberService > getAllMembers');

    try {
      const members = await this.memberRepository.getAll();
      
      return {
        success: true,
        data: members
      };
    } catch (error) {
      console.error('memberService > getAllMembers > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to get members: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Get members by owner
   */
  async getMembersByOwner(ownerId: string): Promise<ServiceResponse<MemberItem[]>> {
    console.log('memberService > getMembersByOwner > ownerId:', ownerId);

    try {
      if (!ownerId || ownerId.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Owner ID is required'
          }
        };
      }

      const members = await this.memberRepository.getByOwner(ownerId);
      
      return {
        success: true,
        data: members
      };
    } catch (error) {
      console.error('memberService > getMembersByOwner > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to get members: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Update member by ID
   */
  async updateMember(id: string, updates: UpdateMemberRequest): Promise<ServiceResponse<MemberItem>> {
    console.log('memberService > updateMember > id:', id, 'updates:', updates);

    try {
      if (!id || id.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Member ID is required'
          }
        };
      }

      // Check if member exists
      const existingMember = await this.memberRepository.getById(id);
      if (!existingMember) {
        return {
          success: false,
          error: {
            code: 'MEMBER_NOT_FOUND',
            message: 'Member not found'
          }
        };
      }

      // Validate name if provided
      if (updates.name !== undefined && updates.name.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Member name cannot be empty'
          }
        };
      }

      const updatedMember = await this.memberRepository.update(id, updates);
      
      return {
        success: true,
        data: updatedMember
      };
    } catch (error) {
      console.error('memberService > updateMember > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to update member: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Delete member by ID
   */
  async deleteMember(id: string): Promise<ServiceResponse<{ message: string }>> {
    console.log('memberService > deleteMember > id:', id);

    try {
      if (!id || id.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Member ID is required'
          }
        };
      }

      // Check if member exists
      const existingMember = await this.memberRepository.getById(id);
      if (!existingMember) {
        return {
          success: false,
          error: {
            code: 'MEMBER_NOT_FOUND',
            message: 'Member not found'
          }
        };
      }

      // Delete associated image from S3 if it exists
      if (existingMember.image) {
        console.log(`Deleting associated image: ${existingMember.image}`);
        const imageDeleteResult = await this.imageService.deleteImageFromS3(existingMember.image);
        if (!imageDeleteResult.success) {
          console.warn(`Failed to delete image ${existingMember.image}: ${imageDeleteResult.error}`);
          // Continue with member deletion even if image deletion fails
        } else {
          console.log(`Successfully deleted image: ${existingMember.image}`);
        }
      }

      // Delete member from database
      await this.memberRepository.delete(id);
      
      return {
        success: true,
        data: { message: 'Member deleted successfully' }
      };
    } catch (error) {
      console.error('memberService > deleteMember > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to delete member: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Get all available classes
   */
  async getClasses(): Promise<ServiceResponse<ClassItem[]>> {
    console.log('memberService > getClasses');

    try {
      const classes = await this.classRepository.getAll();
      
      return {
        success: true,
        data: classes
      };
    } catch (error) {
      console.error('memberService > getClasses > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to get classes: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Get all available races
   */
  async getRaces(): Promise<ServiceResponse<RaceItem[]>> {
    console.log('memberService > getRaces');

    try {
      const races = await this.raceRepository.getAll();
      
      return {
        success: true,
        data: races
      };
    } catch (error) {
      console.error('memberService > getRaces > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to get races: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Get all available auras
   */
  async getAuras(): Promise<ServiceResponse<AuraItem[]>> {
    console.log('memberService > getAuras');

    try {
      const auras = await this.auraRepository.getAll();
      
      return {
        success: true,
        data: auras
      };
    } catch (error) {
      console.error('memberService > getAuras > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to get auras: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Get all available groups
   */
  async getGroups(): Promise<ServiceResponse<GroupItem[]>> {
    console.log('memberService > getGroups');

    try {
      const groups = await this.groupRepository.getAll();
      
      return {
        success: true,
        data: groups
      };
    } catch (error) {
      console.error('memberService > getGroups > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to get groups: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Get sessions by member ID
   */
  async getSessionsByMemberId(memberId: string): Promise<ServiceResponse<SessionItem[]>> {
    console.log('memberService > getSessionsByMemberId > memberId:', memberId);

    try {
      if (!memberId || memberId.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Member ID is required'
          }
        };
      }

      const sessions = await this.memberRepository.getSessionsByMemberId(memberId);
      
      return {
        success: true,
        data: sessions
      };
    } catch (error) {
      console.error('memberService > getSessionsByMemberId > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to get sessions: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Count sessions by member ID
   */
  async countSessionsByMemberId(memberId: string): Promise<ServiceResponse<{ count: number }>> {
    console.log('memberService > countSessionsByMemberId > memberId:', memberId);

    try {
      if (!memberId || memberId.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Member ID is required'
          }
        };
      }

      const count = await this.memberRepository.countSessionsByMemberId(memberId);
      
      return {
        success: true,
        data: { count }
      };
    } catch (error) {
      console.error('memberService > countSessionsByMemberId > error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Failed to count sessions: ${(error as Error).message}`
        }
      };
    }
  }
}