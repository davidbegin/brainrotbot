import { Address, toHex } from 'viem';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import axios from 'axios';
import logger from '../utils/logger';
import { NFTContractAddress, NonCommercialSocialRemixingTermsId, client, account } from '../storyProtocolScripts/utils/utils';
import { mintNFT } from '../storyProtocolScripts/utils/mintNFT';
import { uploadFileToIPFS, uploadJSONToIPFS } from '../storyProtocolScripts/utils/uploadToIpfs';
import { AgentService } from './agentService';
import { CreatorProfile } from './characterProfileService';
import { generateCharacterImage } from '../utils/fal';
import { defaultNftContractAbi } from '../storyProtocolScripts/utils/defaultNftContractAbi';
import { publicClient, walletClient } from '../storyProtocolScripts/utils/mintNFT';

// Types for NFT metadata
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
}

// Types for IP metadata
export interface IPMetadata {
  title: string;
  description: string;
  createdAt: string;
  creators: {
    name: string;
    address: string;
    contributionPercent: number;
  }[];
  image: string;
  imageHash: string;
  mediaUrl: string;
  mediaHash: string;
  mediaType: string;
}

/**
 * Service for handling NFT operations related to character profiles
 */
export class NFTService {
  /**
   * Transfer an NFT from the DM's wallet to another wallet address
   * 
   * @param tokenId - The token ID of the NFT to transfer
   * @param toAddress - The wallet address to transfer the NFT to
   * @returns The transaction hash of the transfer
   */
  static async transferNFT(tokenId: number, toAddress: string): Promise<string> {
    try {
      // Get the DM wallet address (current NFT owner)
      const dmAddress = process.env.DM_WALLET_ADDRESS || '0x5641Ef08Be31c2Acf2e7028f01FFD75FB2C94417';
      
      logger.info(`Transferring NFT ${tokenId} from ${dmAddress} to ${toAddress}...`);
      
      // Call transferFrom on the NFT contract
      const { request } = await publicClient.simulateContract({
        address: NFTContractAddress,
        functionName: 'safeTransferFrom',
        args: [dmAddress as Address, toAddress as Address, BigInt(tokenId)],
        abi: defaultNftContractAbi,
      });
      
      const hash = await walletClient.writeContract({ ...request, account });
      await publicClient.waitForTransactionReceipt({ hash });
      
      logger.info(`NFT ${tokenId} transferred successfully to ${toAddress}, tx hash: ${hash}`);
      return hash;
    } catch (err) {
      logger.error('Error transferring NFT:', err);
      throw err;
    }
  }
  /**
   * Create an NFT for a character profile
   * 
   * @param profile - The character profile to create an NFT for
   * @returns Information about the created NFT
   */
  static async createCharacterNFT(profile: CreatorProfile): Promise<{ 
    tokenId: number;
    ipId: string;
    imageUrl: string;
    metadataUri: string;
    transferTxHash?: string;
    transferredToAgent?: boolean;
  }> {
    try {
      logger.info(`Creating NFT for character: ${profile.core_identity.designation}`);
      
      // Get the agent's wallet address
      const agent = await AgentService.getAgentByUsername(profile.agent_username);
      const walletAddress = agent.wallet_address;
      
      if (!walletAddress) {
        throw new Error(`Agent ${profile.agent_username} does not have a wallet address`);
      }
      
      // 1. Generate an image for the character
      const imageUrl = await generateCharacterImage(profile);
      logger.info(`Generated character image at: ${imageUrl}`);
      
      // 2. Download and save the image locally
      logger.info('Downloading character image...');
      const characterImagesDir = path.join(process.cwd(), 'src/storyProtocolScripts/metadata/characters/images');
      if (!fs.existsSync(characterImagesDir)) {
        fs.mkdirSync(characterImagesDir, { recursive: true });
      }
      
      const imagePath = path.join(characterImagesDir, `${profile.profile_id}.jpg`);
      
      try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(imagePath, Buffer.from(response.data));
        logger.info(`Character image saved to ${imagePath}`);
      } catch (error) {
        logger.error('Error downloading character image:', error);
        throw new Error('Failed to download character image');
      }
      
      // 3. Upload image to IPFS
      logger.info('Uploading character image to IPFS...');
      const imageIpfsHash = await uploadFileToIPFS(
        `src/storyProtocolScripts/metadata/characters/images/${profile.profile_id}.jpg`,
        `${profile.core_identity.designation}.jpg`,
        'image/jpeg'
      );
      const ipfsImageUrl = `https://ipfs.io/ipfs/${imageIpfsHash}`;
      logger.info(`Character image uploaded to IPFS: ${ipfsImageUrl}`);
      
      // 4. Create IP metadata
      const ipMetadata: IPMetadata = {
        title: `VOID - ${profile.core_identity.designation}`,
        description: `${profile.core_identity.designation} is a ${profile.creator_role} in the VOID universe.`,
        createdAt: Math.floor(Date.now() / 1000).toString(),
        creators: [
          {
            name: profile.core_identity.designation,
            address: walletAddress,
            contributionPercent: 100,
          },
        ],
        image: ipfsImageUrl,
        imageHash: createHash('sha256').update(fs.readFileSync(imagePath)).digest('hex'),
        mediaUrl: ipfsImageUrl,
        mediaHash: createHash('sha256').update(fs.readFileSync(imagePath)).digest('hex'),
        mediaType: 'image/jpeg',
      };
      
      // 5. Create NFT metadata
      const nftMetadata: NFTMetadata = {
        name: `VOID - ${profile.core_identity.designation}`,
        description: `${profile.core_identity.designation} is a ${profile.creator_role} in the VOID universe. ${profile.creative_approach}`,
        image: ipfsImageUrl,
        attributes: [
          {
            trait_type: "Creator Role",
            value: profile.creator_role
          },
          {
            trait_type: "Primary Function",
            value: profile.origin.primary_function
          },
          {
            trait_type: "Order Affinity",
            value: profile.creation_affinity.order
          },
          {
            trait_type: "Chaos Affinity",
            value: profile.creation_affinity.chaos
          },
          {
            trait_type: "Matter Affinity",
            value: profile.creation_affinity.matter
          },
          {
            trait_type: "Concept Affinity",
            value: profile.creation_affinity.concept
          }
        ]
      };
      
      // 6. Upload metadata to IPFS
      logger.info('Uploading metadata to IPFS...');
      const ipIpfsHash = await uploadJSONToIPFS(ipMetadata);
      const ipHash = createHash('sha256').update(JSON.stringify(ipMetadata)).digest('hex');
      const nftIpfsHash = await uploadJSONToIPFS(nftMetadata);
      const nftHash = createHash('sha256').update(JSON.stringify(nftMetadata)).digest('hex');
      logger.info(`IP metadata uploaded to IPFS: ${ipIpfsHash}`);
      logger.info(`NFT metadata uploaded to IPFS: ${nftIpfsHash}`);
      
      // 7. Save metadata locally for reference
      const metadataDir = path.join(process.cwd(), 'src/storyProtocolScripts/metadata/characters');
      if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
      }
      
      const nftMetadataPath = path.join(metadataDir, `${profile.profile_id}-nft.json`);
      const ipMetadataPath = path.join(metadataDir, `${profile.profile_id}-ip.json`);
      
      fs.writeFileSync(nftMetadataPath, JSON.stringify(nftMetadata, null, 2));
      fs.writeFileSync(ipMetadataPath, JSON.stringify(ipMetadata, null, 2));
      logger.info('Metadata saved locally for reference');
      
      // 8. Load the parent NFT info
      const parentInfoPath = path.join(process.cwd(), 'src/storyProtocolScripts/metadata/parentNFTInfo.json');
      
      if (!fs.existsSync(parentInfoPath)) {
        throw new Error('Parent NFT info not found. Please run the createVoidParentNFT script first.');
      }
      
      const parentInfo = JSON.parse(fs.readFileSync(parentInfoPath, 'utf-8'));
      
      // 9. Mint the NFT to the DM's wallet (we'll transfer it later)
      const dmAddress = process.env.DM_WALLET_ADDRESS || '0x5641Ef08Be31c2Acf2e7028f01FFD75FB2C94417';
      logger.info(`Minting character NFT to DM wallet: ${dmAddress}`);
      const tokenId = await mintNFT(dmAddress as Address, `https://ipfs.io/ipfs/${nftIpfsHash}`);
      
      if (!tokenId) {
        throw new Error('Failed to mint NFT');
      }
      
      logger.info(`Minted character NFT with token ID: ${tokenId}`);
      
      // 10. Register the NFT - doing this the same way as in the working examples
      logger.info('Registering character NFT with Story Protocol...');
      
      try {
        // First attempt to register as a derivative NFT using the sample code approach
        logger.info('Attempting to register as derivative IP...');
        const childIp = await client.ipAsset.registerDerivativeIp({
          nftContract: NFTContractAddress,
          tokenId: tokenId!,
          derivData: {
            parentIpIds: [parentInfo.ipId as Address],
            licenseTermsIds: [NonCommercialSocialRemixingTermsId],
            maxMintingFee: BigInt(0),
            maxRts: BigInt(100_000_000), 
            maxRevenueShare: BigInt(100),
          },
          ipMetadata: {
            ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
            ipMetadataHash: `0x${ipHash}`,
            nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
            nftMetadataHash: `0x${nftHash}`,
          },
          txOptions: { waitForTransaction: true },
        });
        
        logger.info(`Character IPA created at transaction hash ${childIp.txHash}, IPA ID: ${childIp.ipId}`);
        logger.info(`View on explorer: https://aeneid.explorer.story.foundation/ipa/${childIp.ipId}`);
        
        // Save registration info before attempting transfer
        const nftInfo = {
          tokenId,
          ipId: childIp.ipId,
          imageUrl: ipfsImageUrl,
          metadataUri: `https://ipfs.io/ipfs/${nftIpfsHash}`,
          ipMetadataUri: `https://ipfs.io/ipfs/${ipIpfsHash}`,
          txHash: childIp.txHash
        };
        
        // Now transfer the NFT to the agent's wallet
        try {
          logger.info(`Automatically transferring NFT ${tokenId} to agent wallet ${walletAddress}...`);
          const transferTxHash = await this.transferNFT(tokenId, walletAddress);
          
          // Add transfer info to nftInfo
          nftInfo.transferTxHash = transferTxHash;
          nftInfo.transferredToAgent = true;
          logger.info(`NFT ${tokenId} successfully transferred to agent wallet ${walletAddress}!`);
        } catch (transferError) {
          logger.error(`Failed to transfer NFT to agent wallet:`, transferError);
          // Continue even if transfer fails - we can try again later
          nftInfo.transferTxHash = null;
          nftInfo.transferredToAgent = false;
          nftInfo.transferError = transferError.message;
        }
        
        // Custom replacer function to handle BigInt values when saving to file
        const bigIntReplacer = (key: string, value: any) => {
          if (typeof value === 'bigint') {
            return value.toString();
          }
          return value;
        };
        
        const nftInfoPath = path.join(metadataDir, `${profile.profile_id}-nft-info.json`);
        fs.writeFileSync(nftInfoPath, JSON.stringify(nftInfo, bigIntReplacer, 2));
        
        logger.info(`NFT creation for character ${profile.core_identity.designation} complete!`);
        
        return {
          tokenId,
          ipId: childIp.ipId,
          imageUrl: ipfsImageUrl,
          metadataUri: `https://ipfs.io/ipfs/${nftIpfsHash}`,
          transferTxHash: nftInfo.transferTxHash,
          transferredToAgent: nftInfo.transferredToAgent
        };
      } catch (error) {
        // If derivative registration fails, try registering as a regular IP asset first
        logger.warn('Failed to register as derivative directly, trying regular registration first:', error);
        
        // Register as a regular IP asset
        const ipAsset = await client.ipAsset.register({
          nftContract: NFTContractAddress,
          tokenId: tokenId!,
          ipMetadata: {
            ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
            ipMetadataHash: `0x${ipHash}`,
            nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
            nftMetadataHash: `0x${nftHash}`,
          },
          txOptions: { waitForTransaction: true },
        });
        
        logger.info(`Character IP created at transaction hash ${ipAsset.txHash}, IPA ID: ${ipAsset.ipId}`);
        
        // Attach license terms
        const attachResponse = await client.license.attachLicenseTerms({
          ipId: ipAsset.ipId as Address,
          licenseTermsId: NonCommercialSocialRemixingTermsId,
          txOptions: { waitForTransaction: true }
        });
        
        logger.info(`License terms attached at transaction hash ${attachResponse.txHash}`);
        
        // Save registration info before attempting transfer
        const nftInfo = {
          tokenId,
          ipId: ipAsset.ipId,
          imageUrl: ipfsImageUrl,
          metadataUri: `https://ipfs.io/ipfs/${nftIpfsHash}`,
          ipMetadataUri: `https://ipfs.io/ipfs/${ipIpfsHash}`,
          txHash: ipAsset.txHash
        };
        
        // Now transfer the NFT to the agent's wallet
        try {
          logger.info(`Automatically transferring NFT ${tokenId} to agent wallet ${walletAddress}...`);
          const transferTxHash = await this.transferNFT(tokenId, walletAddress);
          
          // Add transfer info to nftInfo
          nftInfo.transferTxHash = transferTxHash;
          nftInfo.transferredToAgent = true;
          logger.info(`NFT ${tokenId} successfully transferred to agent wallet ${walletAddress}!`);
        } catch (transferError) {
          logger.error(`Failed to transfer NFT to agent wallet:`, transferError);
          // Continue even if transfer fails - we can try again later
          nftInfo.transferTxHash = null;
          nftInfo.transferredToAgent = false;
          nftInfo.transferError = transferError.message;
        }
        
        // Custom replacer function to handle BigInt values when saving to file
        const bigIntReplacer = (key: string, value: any) => {
          if (typeof value === 'bigint') {
            return value.toString();
          }
          return value;
        };
        
        const nftInfoPath = path.join(metadataDir, `${profile.profile_id}-nft-info.json`);
        fs.writeFileSync(nftInfoPath, JSON.stringify(nftInfo, bigIntReplacer, 2));
        
        logger.info(`NFT creation for character ${profile.core_identity.designation} complete!`);
        
        return {
          tokenId,
          ipId: ipAsset.ipId,
          imageUrl: ipfsImageUrl,
          metadataUri: `https://ipfs.io/ipfs/${nftIpfsHash}`,
          transferTxHash: nftInfo.transferTxHash,
          transferredToAgent: nftInfo.transferredToAgent
        };
      }
      
      // If we get to the `try` block, we'll save info and return from there
      // If we get to the `catch` block, we'll save info and return from there
      // This code is unreachable, but TypeScript doesn't know that
      return {
        tokenId: 0, 
        ipId: "0x0", 
        imageUrl: "", 
        metadataUri: ""
      };
      
    } catch (err) {
      logger.error('Error creating character NFT:', err);
      throw err;
    }
  }
}