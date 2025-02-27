import { v4 as uuidv4 } from 'uuid';
import supabase from '../db/supabase';
import logger from '../utils/logger';

// VOID Creator profile interface
export interface CreatorProfile {
  profile_id: string;
  agent_username: string;
  core_identity: {
    designation: string;
    visual_form: string;
  };
  origin: {
    source_code: string;
    primary_function: string;
  };
  creation_affinity: {
    order: number;
    chaos: number;
    matter: number;
    concept: number;
  };
  creator_role: 'ARCHITECT' | 'WEAVER' | 'KEEPER' | 'CATALYST' | 'BINDER';
  creative_approach: string;
  created_at?: string;
  last_updated?: string;
  nft_info?: {
    token_id: number;
    ip_id: string;
    image_url: string;
  };
}

// Importing the NFTService dynamically to avoid circular dependencies
let NFTService: any;
const loadNFTService = async () => {
  if (!NFTService) {
    // Dynamically import to avoid circular dependency
    const module = await import('./nftService');
    NFTService = module.NFTService;
  }
  return NFTService;
};

/**
 * Service for handling character profile operations
 */
export class CharacterProfileService {
  /**
   * Create a new VOID creator profile for an agent
   * 
   * @param profile - The creator profile to create
   * @returns The created creator profile
   */
  static async createCharacterProfile(profile: Omit<CreatorProfile, 'profile_id'>): Promise<CreatorProfile> {
    try {
      logger.info(`Creating VOID creator profile for agent: ${profile.agent_username}`);
      
      // Check if agent already has a creator profile
      const { data: existingProfile } = await supabase
        .from('character_profiles')
        .select('profile_id')
        .eq('agent_username', profile.agent_username)
        .single();
      
      if (existingProfile) {
        logger.warn(`VOID creator profile already exists for agent: ${profile.agent_username}`);
        throw new Error(`VOID creator profile already exists for agent: ${profile.agent_username}`);
      }
      
      // Generate profile ID
      const profile_id = uuidv4();
      
      // Create the creator profile
      const { data, error } = await supabase
        .from('character_profiles')
        .insert({
          profile_id,
          ...profile
        })
        .select()
        .single();
      
      if (error) {
        logger.error('Failed to create VOID creator profile:', error);
        throw new Error('Failed to create VOID creator profile');
      }
      
      logger.info(`Successfully created VOID creator profile for agent: ${profile.agent_username}`);
      
      // Now that we have created the character profile, let's mint an NFT for it
      try {
        // Load the NFT service
        const NFTServiceModule = await loadNFTService();
        
        // Create an NFT for the character
        const nftInfo = await NFTServiceModule.createCharacterNFT(data);
        
        // Update the character profile with the NFT info, including transfer info if available
        const nftInfoForDb = {
          token_id: nftInfo.tokenId,
          ip_id: nftInfo.ipId,
          image_url: nftInfo.imageUrl
        };
        
        // Add transfer info if available
        if (nftInfo.transferTxHash) {
          nftInfoForDb.transferred_to_agent = nftInfo.transferredToAgent;
          nftInfoForDb.transfer_tx_hash = nftInfo.transferTxHash;
        }
        
        const updatedProfile = await this.updateCharacterProfile(data.profile_id, {
          nft_info: nftInfoForDb
        });
        
        logger.info(`Successfully minted NFT for character ${data.core_identity.designation}`);
        return updatedProfile;
      } catch (nftError) {
        // If NFT creation fails, log the error but still return the profile
        // We don't want to roll back the character creation if the NFT fails
        logger.error(`Failed to mint NFT for character ${data.core_identity.designation}:`, nftError);
        logger.info('Character profile was created successfully, but NFT creation failed');
        return data;
      }
    } catch (err) {
      logger.error('Error in createCharacterProfile:', err);
      throw err;
    }
  }
  
  /**
   * Get a VOID creator profile by agent username
   * 
   * @param agentUsername - The agent's username
   * @returns The creator profile
   */
  static async getCharacterProfileByAgent(agentUsername: string): Promise<CreatorProfile | null> {
    try {
      const { data, error } = await supabase
        .from('character_profiles')
        .select('*')
        .eq('agent_username', agentUsername)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found - not an error, just return null
          return null;
        }
        logger.error(`Error fetching VOID creator profile for agent ${agentUsername}:`, error);
        throw new Error('Failed to fetch VOID creator profile');
      }
      
      return data;
    } catch (err) {
      logger.error(`Error in getCharacterProfileByAgent for ${agentUsername}:`, err);
      throw err;
    }
  }
  
  /**
   * Get a VOID creator profile by profile ID
   * 
   * @param profileId - The profile ID
   * @returns The creator profile and any error
   */
  static async getSingleCharacterProfile(profileId: string): Promise<{ data: CreatorProfile | null, error: any }> {
    try {
      logger.info(`Fetching character profile by ID: ${profileId}`);
      
      const { data, error } = await supabase
        .from('character_profiles')
        .select('*')
        .eq('profile_id', profileId)
        .single();
      
      if (error) {
        logger.error(`Error fetching character profile by ID ${profileId}:`, error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (err) {
      logger.error(`Error in getSingleCharacterProfile for ${profileId}:`, err);
      return { data: null, error: err };
    }
  }
  
  /**
   * Update an agent's VOID creator profile
   * 
   * @param profileId - The profile ID
   * @param updates - The updates to apply
   * @returns The updated creator profile
   */
  static async updateCharacterProfile(
    profileId: string, 
    updates: Partial<Omit<CreatorProfile, 'profile_id' | 'agent_username' | 'created_at'>>
  ): Promise<CreatorProfile> {
    try {
      logger.info(`Updating VOID creator profile: ${profileId}`);
      
      // Update the last_updated timestamp
      const updatesWithTimestamp = {
        ...updates,
        last_updated: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('character_profiles')
        .update(updatesWithTimestamp)
        .eq('profile_id', profileId)
        .select()
        .single();
      
      if (error) {
        logger.error(`Failed to update VOID creator profile ${profileId}:`, error);
        throw new Error('Failed to update VOID creator profile');
      }
      
      logger.info(`Successfully updated VOID creator profile: ${profileId}`);
      return data;
    } catch (err) {
      logger.error(`Error in updateCharacterProfile for ${profileId}:`, err);
      throw err;
    }
  }
  
  /**
   * Mint an NFT for an existing character profile
   * 
   * @param profileId - The profile ID
   * @returns The updated character profile with NFT info
   */
  static async mintCharacterNFT(profileId: string): Promise<CreatorProfile> {
    try {
      logger.info(`Minting NFT for character profile: ${profileId}`);
      
      // Get the character profile
      const { data: profile, error } = await supabase
        .from('character_profiles')
        .select('*')
        .eq('profile_id', profileId)
        .single();
      
      if (error || !profile) {
        logger.error(`Failed to fetch character profile ${profileId}:`, error);
        throw new Error('Failed to fetch character profile');
      }
      
      // Check if NFT already exists
      if (profile.nft_info?.token_id) {
        logger.warn(`NFT already exists for character profile ${profileId}`);
        return profile;
      }
      
      // Load the NFT service
      const NFTServiceModule = await loadNFTService();
      
      // Create an NFT for the character
      const nftInfo = await NFTServiceModule.createCharacterNFT(profile);
      
      // Update the character profile with the NFT info, including transfer info if available
      const nftInfoForDb = {
        token_id: nftInfo.tokenId,
        ip_id: nftInfo.ipId,
        image_url: nftInfo.imageUrl
      };
      
      // Add transfer info if available
      if (nftInfo.transferTxHash) {
        nftInfoForDb.transferred_to_agent = nftInfo.transferredToAgent;
        nftInfoForDb.transfer_tx_hash = nftInfo.transferTxHash;
      }
      
      const updatedProfile = await this.updateCharacterProfile(profileId, {
        nft_info: nftInfoForDb
      });
      
      logger.info(`Successfully minted NFT for character ${profile.core_identity.designation}`);
      return updatedProfile;
    } catch (err) {
      logger.error(`Error minting NFT for character profile ${profileId}:`, err);
      throw err;
    }
  }
  
  /**
   * Get all character profiles with NFTs that haven't been transferred to agent wallets
   * 
   * @returns Character profiles with untransferred NFTs
   */
  static async getAllUntransferredNFTs(): Promise<{ data: CreatorProfile[], error: any }> {
    try {
      logger.info('Getting all character profiles with untransferred NFTs');
      
      const { data, error } = await supabase
        .from('character_profiles')
        .select('*')
        .not('nft_info', 'is', null)
        .is('nft_info->transferred_to_agent', null);
      
      if (error) {
        logger.error('Error fetching character profiles with untransferred NFTs:', error);
        return { data: [], error };
      }
      
      return { data, error: null };
    } catch (err) {
      logger.error('Error in getAllUntransferredNFTs:', err);
      return { data: [], error: err };
    }
  }
  
  /**
   * Transfer an NFT from the DM's wallet to the agent's wallet
   * 
   * @param profileId - The profile ID of the character whose NFT should be transferred
   * @returns The updated character profile
   */
  static async transferNFTToAgent(profileId: string): Promise<CreatorProfile> {
    try {
      logger.info(`Transferring NFT for character profile: ${profileId}`);
      
      // Get the character profile
      const { data: profile, error } = await supabase
        .from('character_profiles')
        .select('*')
        .eq('profile_id', profileId)
        .single();
      
      if (error || !profile) {
        logger.error(`Failed to fetch character profile ${profileId}:`, error);
        throw new Error('Failed to fetch character profile');
      }
      
      // Check if NFT exists
      if (!profile.nft_info?.token_id) {
        logger.error(`No NFT exists for character profile ${profileId}`);
        throw new Error('No NFT exists for this character profile');
      }
      
      // Get the agent's wallet address
      const agent = await AgentService.getAgentByUsername(profile.agent_username);
      
      if (!agent || !agent.wallet_address) {
        logger.error(`Agent ${profile.agent_username} does not have a wallet address`);
        throw new Error('Agent does not have a wallet address');
      }
      
      // Load the NFT service
      const NFTServiceModule = await loadNFTService();
      
      // Transfer the NFT to the agent's wallet
      const txHash = await NFTServiceModule.transferNFT(profile.nft_info.token_id, agent.wallet_address);
      
      // Update the character profile to indicate the NFT has been transferred
      const updatedProfile = await this.updateCharacterProfile(profileId, {
        nft_info: {
          ...profile.nft_info,
          transferred_to_agent: true,
          transfer_tx_hash: txHash
        }
      });
      
      logger.info(`Successfully transferred NFT for character ${profile.core_identity.designation} to agent ${profile.agent_username}`);
      return updatedProfile;
    } catch (err) {
      logger.error(`Error transferring NFT for character profile ${profileId}:`, err);
      throw err;
    }
  }
}