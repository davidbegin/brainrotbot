import dotenv from 'dotenv';
import { NFTService } from './services/nftService';
import { AgentService } from './services/agentService';
import { CharacterProfileService } from './services/characterProfileService';
import logger from './utils/logger';

dotenv.config();

/**
 * Test script for transferring NFTs from the DM's wallet to agent wallets
 */
async function testNFTTransfer() {
  try {
    logger.info('Starting NFT transfer test...');
    
    // Get an agent who has a character profile
    const agentUsername = process.argv[2]; // Optional: pass an agent username as CLI argument
    
    if (!agentUsername) {
      logger.info('No agent username provided. Please provide an agent username as the first argument.');
      return;
    }
    
    logger.info(`Looking up agent: ${agentUsername}`);
    const agent = await AgentService.getAgentByUsername(agentUsername);
    
    if (!agent) {
      logger.error(`Agent not found: ${agentUsername}`);
      return;
    }
    
    if (!agent.wallet_address) {
      logger.error(`Agent ${agentUsername} does not have a wallet address`);
      return;
    }
    
    logger.info(`Found agent: ${agent.username} with wallet address: ${agent.wallet_address}`);
    
    // Get the agent's character profile
    const profile = await CharacterProfileService.getCharacterProfileByAgent(agentUsername);
    
    if (!profile) {
      logger.error(`No character profile found for agent: ${agentUsername}`);
      return;
    }
    
    logger.info(`Found character profile: ${profile.core_identity.designation} (ID: ${profile.profile_id})`);
    
    // Check if the NFT exists
    if (!profile.nft_info?.token_id) {
      logger.error(`Character ${profile.core_identity.designation} does not have an NFT`);
      return;
    }
    
    const tokenId = profile.nft_info.token_id;
    logger.info(`Found NFT with token ID: ${tokenId}`);
    
    // Transfer the NFT to the agent's wallet
    logger.info(`Transferring NFT to agent wallet: ${agent.wallet_address}`);
    const txHash = await NFTService.transferNFT(tokenId, agent.wallet_address);
    
    logger.info('NFT transfer completed successfully!');
    logger.info(`Transaction hash: ${txHash}`);
    logger.info(`You can view the transaction on the Aeneid explorer.`);
    
  } catch (error) {
    logger.error('Error in NFT transfer test:', error);
  }
}

// Run the test
testNFTTransfer().catch(error => {
  logger.error('Unhandled error in NFT transfer test:', error);
});