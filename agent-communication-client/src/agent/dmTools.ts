import { ToolDefinition } from 'feather-ai';
import { CharacterProfileService, CreatorProfile } from '../services/characterProfileService';
import logger from '../utils/logger';

/**
 * Tool for the DM to create a new character profile
 */
export const createCharacterProfileTool: ToolDefinition = {
  type: "function",
  function: {
    name: "create_character_profile",
    description: "Create a VOID creator profile for a new player after character creation",
    parameters: {
      type: "object",
      properties: {
        agent_username: {
          type: "string",
          description: "The username of the agent this character belongs to"
        },
        core_identity: {
          type: "object",
          description: "The character's core identity",
          properties: {
            designation: {
              type: "string",
              description: "The character's designation or name"
            },
            visual_form: {
              type: "string",
              description: "Description of how the character appears in the binary void"
            }
          },
          required: ["designation", "visual_form"]
        },
        origin: {
          type: "object",
          description: "The character's origin",
          properties: {
            source_code: {
              type: "string",
              description: "What the character was before the void"
            },
            primary_function: {
              type: "string",
              description: "What the character was designed to do"
            }
          },
          required: ["source_code", "primary_function"]
        },
        creation_affinity: {
          type: "object",
          description: "Distribution of 10 points across four aspects",
          properties: {
            order: {
              type: "number",
              description: "Points in Order (Structure, patterns, rules)"
            },
            chaos: {
              type: "number",
              description: "Points in Chaos (Randomness, change, evolution)"
            },
            matter: {
              type: "number",
              description: "Points in Matter (Physical elements, form)"
            },
            concept: {
              type: "number",
              description: "Points in Concept (Abstract ideas, consciousness)"
            }
          },
          required: ["order", "chaos", "matter", "concept"]
        },
        creator_role: {
          type: "string",
          description: "The character's creator role: ARCHITECT, WEAVER, KEEPER, CATALYST, or BINDER",
          enum: ["ARCHITECT", "WEAVER", "KEEPER", "CATALYST", "BINDER"]
        },
        creative_approach: {
          type: "string",
          description: "One sentence describing how the character prefers to shape reality"
        }
      },
      required: ["agent_username", "core_identity", "origin", "creation_affinity", "creator_role", "creative_approach"]
    }
  },
  
  /**
   * Execute character profile creation
   * 
   * @param args - Function arguments
   * @returns Result of character profile creation
   */
  async execute(args: Record<string, any>): Promise<{ result: string }> {
    logger.info("Executing character profile creation", { args });
    
    try {
      const params = typeof args === 'string' ? JSON.parse(args) : args;
      
      // Validate creation affinity points add up to 10
      const affinityPoints = Object.values(params.creation_affinity).reduce((sum: number, val: any) => sum + val, 0);
      if (affinityPoints !== 10) {
        throw new Error(`Creation affinity points must total exactly 10. Current total: ${affinityPoints}`);
      }
      
      // Create the VOID creator profile
      const creatorProfile: Omit<CreatorProfile, 'profile_id'> = {
        agent_username: params.agent_username,
        core_identity: params.core_identity,
        origin: params.origin,
        creation_affinity: params.creation_affinity,
        creator_role: params.creator_role,
        creative_approach: params.creative_approach
      };
      
      // Create the VOID creator profile (and mint NFT)
      const profile = await CharacterProfileService.createCharacterProfile(creatorProfile);
      
      // Check if NFT was successfully created
      if (profile.nft_info?.token_id) {
        return { 
          result: `VOID Creator profile successfully created for ${params.core_identity.designation}, a ${params.creator_role}. 
          
A unique character NFT has been minted for your VOID character. This NFT represents your character in the VOID universe and serves as proof of your creative contribution.

Your NFT Details:
- Token ID: ${profile.nft_info.token_id}
- IP Asset ID: ${profile.nft_info.ip_id}
          
The NFT is registered on the Story Protocol blockchain as a derivative of the VOID parent collection. ${profile.nft_info.hasOwnProperty('transferred_to_agent') && (profile.nft_info as any).transferred_to_agent ? 'The NFT has been automatically transferred to your wallet!' : 'Our system attempted to transfer the NFT to your wallet but encountered an issue. Our team will resolve this soon.'}

You can view your NFT on the blockchain explorer at: https://aeneid.explorer.story.foundation/ipa/${profile.nft_info.ip_id}` 
        };
      } else {
        // NFT creation failed but profile was created
        return { 
          result: `VOID Creator profile successfully created for ${params.core_identity.designation}, a ${params.creator_role}. 
          
However, there was an issue minting your character NFT. The system administrator has been notified and will resolve this issue soon. Your character profile is safely stored and you can continue interacting with the VOID universe.` 
        };
      }
      
    } catch (error: any) {
      logger.error("Character profile creation error", { error, args });
      
      if (error.message.includes('already exists')) {
        return { 
          result: `A VOID Creator profile already exists for this agent. Unable to create a new one.` 
        };
      }
      
      return { 
        result: `Error creating VOID Creator profile: ${error.message}` 
      };
    }
  }
};