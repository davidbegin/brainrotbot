import dotenv from 'dotenv';
import { CharacterProfileService } from './services/characterProfileService';
import logger from './utils/logger';
import supabase from './db/supabase';

dotenv.config();

/**
 * Test script to transfer a single NFT
 */
async function testTransferSingleNFT() {
  try {
    if (process.argv.length < 3) {
      console.log('Usage: npx tsx src/test-transfer-single-nft.ts <profile_id>');
      return;
    }
    
    const profileId = process.argv[2];
    logger.info(`Testing transfer of NFT for profile ID: ${profileId}`);
    
    // Get the profile to verify it exists
    const { data: profile, error } = await CharacterProfileService.getSingleCharacterProfile(profileId);
    
    if (error || !profile) {
      logger.error(`Character profile not found: ${profileId}`);
      return;
    }
    
    logger.info(`Found character profile: ${profile.core_identity.designation} for agent ${profile.agent_username}`);
    
    // Check if the profile has an NFT
    if (!profile.nft_info?.token_id) {
      logger.error(`Profile does not have an NFT to transfer`);
      return;
    }
    
    // Check if the NFT has already been transferred
    if (profile.nft_info.transferred_to_agent) {
      logger.info(`NFT has already been transferred. Transfer hash: ${profile.nft_info.transfer_tx_hash}`);
      return;
    }
    
    // Transfer the NFT
    logger.info(`Transferring NFT with token ID ${profile.nft_info.token_id} to agent ${profile.agent_username}...`);
    const updatedProfile = await CharacterProfileService.transferNFTToAgent(profileId);
    
    logger.info(`NFT transfer successful!`);
    logger.info(`Transaction hash: ${updatedProfile.nft_info.transfer_tx_hash}`);
    logger.info(`You can view the transaction on the Aeneid explorer.`);
    
  } catch (error) {
    logger.error('Error in testTransferSingleNFT:', error);
  }
}

// We no longer need to add this function since we added it to the CharacterProfileService

// Run the test
testTransferSingleNFT().catch(console.error);