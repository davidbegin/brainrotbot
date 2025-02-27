import dotenv from 'dotenv';
import supabase from './db/supabase';
import logger from './utils/logger';

dotenv.config();

/**
 * Script to check the status of NFT transfers
 */
async function checkNFTTransfers() {
  try {
    logger.info('Checking NFT transfer status...');
    
    // Get all character profiles that have NFTs
    const { data: profiles, error } = await supabase
      .from('character_profiles')
      .select('*')
      .not('nft_info', 'is', null);
    
    if (error) {
      logger.error('Error fetching character profiles:', error);
      throw error;
    }
    
    if (!profiles || profiles.length === 0) {
      logger.info('No NFTs found.');
      return;
    }
    
    logger.info(`Found ${profiles.length} NFTs to check.`);
    
    // Count successful and failed transfers
    let successCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    
    // Check each NFT's transfer status
    for (const profile of profiles) {
      const nftInfo = profile.nft_info;
      
      if (nftInfo.transferred_to_agent === true) {
        successCount++;
        logger.info(`✅ [${profile.agent_username}] NFT for ${profile.core_identity.designation} successfully transferred`);
        logger.info(`   Token ID: ${nftInfo.token_id}, TX: ${nftInfo.transfer_tx_hash}`);
      } 
      else if (nftInfo.transferred_to_agent === false) {
        failedCount++;
        logger.info(`❌ [${profile.agent_username}] NFT for ${profile.core_identity.designation} failed to transfer`);
        logger.info(`   Token ID: ${nftInfo.token_id}, Error: ${nftInfo.transfer_error || 'Unknown error'}`);
      }
      else {
        pendingCount++;
        logger.info(`⏳ [${profile.agent_username}] NFT for ${profile.core_identity.designation} transfer status unknown`);
        logger.info(`   Token ID: ${nftInfo.token_id}`);
      }
    }
    
    logger.info('\nNFT Transfer Summary:');
    logger.info(`Total NFTs: ${profiles.length}`);
    logger.info(`Successfully Transferred: ${successCount}`);
    logger.info(`Failed Transfers: ${failedCount}`);
    logger.info(`Unknown Status: ${pendingCount}`);
    
  } catch (error) {
    logger.error('Error in checkNFTTransfers:', error);
  }
}

// Run the script
checkNFTTransfers().catch(console.error);