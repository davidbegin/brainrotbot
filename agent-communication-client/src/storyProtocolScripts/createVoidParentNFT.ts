import { Address, toHex } from 'viem'
import { mintNFT } from './utils/mintNFT'
import { NFTContractAddress, NonCommercialSocialRemixingTermsId, account, client } from './utils/utils'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import dotenv from 'dotenv'
import { uploadFileToIPFS, uploadJSONToIPFS } from './utils/uploadToIpfs'
import { createHash } from 'crypto'

dotenv.config()

/**
 * This script creates the parent NFT for the VOID game
 * It only needs to be run once and stores the results in a file
 * for future reference when creating child NFTs
 */
const main = async function () {
    console.log('Creating parent VOID NFT for the DM...')
    
    // Parent NFT image URL from instructions
    const originalImageUrl = 'https://v3.fal.media/files/monkey/Yp-g5xMnxxbjMarAisRPW_f78952308b6f4d3ea178548ee7f384b0.jpg'
    
    // 1. Download the image and save it locally
    console.log('Downloading parent NFT image...')
    const imagePath = path.join(process.cwd(), 'src/storyProtocolScripts/metadata/void-parent-image.jpg')
    
    // Create directory if it doesn't exist
    const metadataDir = path.dirname(imagePath)
    if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true })
    }
    
    try {
        const response = await axios.get(originalImageUrl, { responseType: 'arraybuffer' })
        fs.writeFileSync(imagePath, Buffer.from(response.data))
        console.log(`Image saved to ${imagePath}`)
    } catch (error) {
        console.error('Error downloading image:', error)
        throw new Error('Failed to download parent NFT image')
    }
    
    // 2. Upload the image to IPFS
    console.log('Uploading image to IPFS...')
    const imageIpfsHash = await uploadFileToIPFS(
        'src/storyProtocolScripts/metadata/void-parent-image.jpg', 
        'void-parent-image.jpg', 
        'image/jpeg'
    )
    const imageUrl = `https://ipfs.io/ipfs/${imageIpfsHash}`
    console.log(`Image uploaded to IPFS: ${imageUrl}`)
    
    // 3. Create IP metadata
    const ipMetadata = {
        title: 'VOID Game - The Architect',
        description: 'The Architect oversees the construction of reality in the VOID universe.',
        createdAt: Math.floor(Date.now() / 1000).toString(),
        creators: [
            {
                name: 'The Architect',
                address: process.env.DM_WALLET_ADDRESS || '0x5641Ef08Be31c2Acf2e7028f01FFD75FB2C94417',
                contributionPercent: 100,
            },
        ],
        image: imageUrl,
        imageHash: createHash('sha256').update(fs.readFileSync(imagePath)).digest('hex'),
        mediaUrl: imageUrl,
        mediaHash: createHash('sha256').update(fs.readFileSync(imagePath)).digest('hex'),
        mediaType: 'image/jpeg',
    }
    
    // 4. Create NFT metadata
    const nftMetadata = {
        name: "VOID Game - The Architect",
        description: "Authorized creator of derivative VOID character NFTs. The Architect oversees the construction of reality in the VOID universe.",
        image: imageUrl,
        attributes: [
            {
                trait_type: "Role",
                value: "The Architect"
            },
            {
                trait_type: "Game",
                value: "VOID"
            }
        ]
    }
    
    // 5. Upload metadata to IPFS
    console.log('Uploading metadata to IPFS...')
    const ipIpfsHash = await uploadJSONToIPFS(ipMetadata)
    const ipHash = createHash('sha256').update(JSON.stringify(ipMetadata)).digest('hex')
    const nftIpfsHash = await uploadJSONToIPFS(nftMetadata)
    const nftHash = createHash('sha256').update(JSON.stringify(nftMetadata)).digest('hex')
    console.log(`IP metadata uploaded to IPFS: ${ipIpfsHash}`)
    console.log(`NFT metadata uploaded to IPFS: ${nftIpfsHash}`)
    
    // 6. Save metadata locally for reference
    const parentMetadataPath = path.join(process.cwd(), 'src/storyProtocolScripts/metadata/parentNFTMetadata.json')
    const ipMetadataPath = path.join(process.cwd(), 'src/storyProtocolScripts/metadata/parentIPMetadata.json')
    
    fs.writeFileSync(parentMetadataPath, JSON.stringify(nftMetadata, null, 2))
    fs.writeFileSync(ipMetadataPath, JSON.stringify(ipMetadata, null, 2))
    console.log(`Metadata saved locally for reference`)
    
    // 7. Mint the parent NFT to the DM's address
    console.log('Minting parent NFT...')
    const dmAddress = process.env.DM_WALLET_ADDRESS || '0x5641Ef08Be31c2Acf2e7028f01FFD75FB2C94417'
    const parentTokenId = await mintNFT(dmAddress as Address, `https://ipfs.io/ipfs/${nftIpfsHash}`)
    console.log(`NFT minted with token ID ${parentTokenId}`)
    
    // 8. Register the parent IP
    console.log('Registering parent IP with Story Protocol...')
    const parentIp = await client.ipAsset.register({
        nftContract: NFTContractAddress,
        tokenId: parentTokenId!,
        ipMetadata: {
            ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
            ipMetadataHash: `0x${ipHash}`,
            nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
            nftMetadataHash: `0x${nftHash}`,
        },
        txOptions: { waitForTransaction: true },
    })
    console.log(`VOID Parent IPA created at transaction hash ${parentIp.txHash}, IPA ID: ${parentIp.ipId}`)
    console.log(`View on explorer: https://aeneid.explorer.story.foundation/ipa/${parentIp.ipId}`)

    // 9. Attach license terms to the parent IP asset
    console.log('Attaching license terms to parent IP...')
    const attachResponse = await client.license.attachLicenseTerms({
        ipId: parentIp.ipId as Address,
        licenseTermsId: NonCommercialSocialRemixingTermsId,
        txOptions: { waitForTransaction: true }
    })
    console.log(`License terms attached to VOID Parent IP at transaction hash ${attachResponse.txHash}`)

    // 10. Save parent NFT info for future reference
    const parentNftInfo = {
        tokenId: parentTokenId,
        ipId: parentIp.ipId,
        nftContract: NFTContractAddress,
        dmAddress,
        ipfsImage: imageUrl,
        ipfsMetadata: `https://ipfs.io/ipfs/${nftIpfsHash}`
    }
    
    const parentInfoPath = path.join(process.cwd(), 'src/storyProtocolScripts/metadata/parentNFTInfo.json')
    fs.writeFileSync(parentInfoPath, JSON.stringify(parentNftInfo, null, 2))
    
    console.log(`VOID Parent NFT info saved to ${parentInfoPath}`)
    console.log('VOID Parent NFT creation complete!')
}

// Only run this script directly (not when imported)
if (require.main === module) {
    main().catch(console.error)
}

export default main