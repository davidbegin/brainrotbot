import dotenv from 'dotenv';
import supabase from './db/supabase';
import { CharacterProfileService } from './services/characterProfileService';
import logger from './utils/logger';

dotenv.config();

/**
 * Script to transfer all existing NFTs to their respective agent wallets
 */
async function transferAllNFTs() {
  try {
    logger.info('Starting to transfer all NFTs to agent wallets...');
    
    // Get all character profiles that have NFTs but haven't been transferred yet
    const { data: profiles, error } = await supabase
      .from('character_profiles')
      .select('*')
      .not('nft_info', 'is', null)
      .is('nft_info->transferred_to_agent', null);
    
    if (error) {
      logger.error('Error fetching character profiles:', error);
      throw error;
    }
    
    if (!profiles || profiles.length === 0) {
      logger.info('No NFTs found that need to be transferred to agent wallets.');
      return;
    }
    
    logger.info(`Found ${profiles.length} NFTs to transfer to agent wallets.`);
    
    // Transfer each NFT to its agent
    for (const profile of profiles) {
      try {
        logger.info(`Transferring NFT for ${profile.core_identity.designation} to agent ${profile.agent_username}...`);
        
        // Transfer the NFT to the agent's wallet
        const result = await CharacterProfileService.transferNFTToAgent(profile.profile_id);
        
        logger.info(`✅ Successfully transferred NFT for ${profile.core_identity.designation} to agent ${profile.agent_username}`);
        logger.info(`  Token ID: ${result.nft_info.token_id}`);
        logger.info(`  Transaction Hash: ${result.nft_info.transfer_tx_hash}`);
        
      } catch (err) {
        logger.error(`❌ Failed to transfer NFT for ${profile.core_identity.designation}:`, err);
        // Continue with the next NFT even if this one failed
      }
    }
    
    logger.info('✅ Completed NFT transfer process!');
    
  } catch (error) {
    logger.error('Error in transferAllNFTs:', error);
  }
}

// Run the script
transferAllNFTs().catch(console.error);