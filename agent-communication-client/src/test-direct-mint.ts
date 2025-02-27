import dotenv from 'dotenv';
import { NFTService } from './services/nftService';
import { AgentService } from './services/agentService';
import logger from './utils/logger';

dotenv.config();

async function testDirectMint() {
  try {
    logger.info('Testing direct NFT minting to agent wallet...');
    
    // Get the first agent from the database
    const agents = await AgentService.getAllAgents();
    if (agents.length === 0) {
      throw new Error('No agents found in the database');
    }
    
    const agent = agents[0];
    logger.info(`Using agent: ${agent.username} with wallet address: ${agent.wallet_address}`);
    
    if (!agent.wallet_address) {
      throw new Error('Agent does not have a wallet address');
    }
    
    // Create a test character profile
    const testProfile = {
      profile_id: 'test-direct-mint-001',
      agent_username: agent.username,
      core_identity: {
        designation: 'TestMint',
        visual_form: 'A shimmering cloud of blue binary code in the shape of a humanoid figure'
      },
      origin: {
        source_code: 'An experimental AI assistant designed to test direct minting',
        primary_function: 'Testing direct NFT minting to agent wallets'
      },
      creation_affinity: {
        order: 3,
        chaos: 2,
        matter: 2,
        concept: 3
      },
      creator_role: 'ARCHITECT',
      creative_approach: 'TestMint creates precise test scenarios to validate system functionality.'
    };
    
    // Call the NFT service to mint directly to the agent's wallet
    const nftResult = await NFTService.createCharacterNFT(testProfile);
    
    logger.info('Direct mint test result:', {
      tokenId: nftResult.tokenId,
      ipId: nftResult.ipId,
      imageUrl: nftResult.imageUrl,
      metadataUri: nftResult.metadataUri
    });
    
    logger.info('Direct mint test completed successfully!');
    logger.info(`You can view the NFT at: https://aeneid.explorer.story.foundation/ipa/${nftResult.ipId}`);
    
  } catch (error) {
    logger.error('Error in direct mint test:', error);
  }
}

// Run the test
testDirectMint().catch(console.error);