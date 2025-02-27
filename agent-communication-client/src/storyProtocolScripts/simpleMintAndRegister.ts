//import { mintNFT } from './utils/mintNFT'
//import { NFTContractAddress, account, client } from './utils/utils'
//import { uploadJSONToIPFS } from './utils/uploadToIpfs'
//import { createHash } from 'crypto'
//
//// BEFORE YOU RUN THIS FUNCTION: Make sure to read the README which contains
//// instructions for running this "Simple Mint and Register" example.
//
//const main = async function () {
//    // 1. Set up your IP Metadata
//    //
//    // Docs: https://docs.story.foundation/docs/ipa-metadata-standard
//    const ipMetadata = {
//        title: 'Midnight Marriage',
//        description: 'This is a house-style song generated on suno.',
//        createdAt: '1740005219',
//        creators: [
//            {
//                name: 'Jacob Tucker',
//                address: '0xA2f9Cf1E40D7b03aB81e34BC50f0A8c67B4e9112',
//                contributionPercent: 100,
//            },
//        ],
//        image: 'https://cdn2.suno.ai/image_large_8bcba6bc-3f60-4921-b148-f32a59086a4c.jpeg',
//        imageHash: '0xc404730cdcdf7e5e54e8f16bc6687f97c6578a296f4a21b452d8a6ecabd61bcc',
//        mediaUrl: 'https://cdn1.suno.ai/dcd3076f-3aa5-400b-ba5d-87d30f27c311.mp3',
//        mediaHash: '0xb52a44f53b2485ba772bd4857a443e1fb942cf5dda73c870e2d2238ecd607aee',
//        mediaType: 'audio/mpeg',
//    }
//
//    // 2. Set up your NFT Metadata
//    //
//    // Docs: https://docs.opensea.io/docs/metadata-standards#metadata-structure
//    const nftMetadata = {
//        name: 'Midnight Marriage',
//        description: 'This is a house-style song generated on suno. This NFT represents ownership of the IP Asset.',
//        image: 'https://cdn2.suno.ai/image_large_8bcba6bc-3f60-4921-b148-f32a59086a4c.jpeg',
//        media: [
//            {
//                name: 'Midnight Marriage',
//                url: 'https://cdn1.suno.ai/dcd3076f-3aa5-400b-ba5d-87d30f27c311.mp3',
//                mimeType: 'audio/mpeg',
//            },
//        ],
//        attributes: [
//            {
//                key: 'Suno Artist',
//                value: 'amazedneurofunk956',
//            },
//            {
//                key: 'Artist ID',
//                value: '4123743b-8ba6-4028-a965-75b79a3ad424',
//            },
//            {
//                key: 'Source',
//                value: 'Suno.com',
//            },
//        ],
//    }
//
//    // 3. Upload your IP and NFT Metadata to IPFS
//    const ipIpfsHash = await uploadJSONToIPFS(ipMetadata)
//    const ipHash = createHash('sha256').update(JSON.stringify(ipMetadata)).digest('hex')
//    const nftIpfsHash = await uploadJSONToIPFS(nftMetadata)
//    const nftHash = createHash('sha256').update(JSON.stringify(nftMetadata)).digest('hex')
//
//    // 4. Mint an NFT
//    const tokenId = await mintNFT(account.address, `https://ipfs.io/ipfs/${nftIpfsHash}`)
//    console.log(`NFT minted with tokenId ${tokenId}`)
//
//    // 5. Register an IP Asset
//    //
//    // Docs: https://docs.story.foundation/docs/sdk-ipasset#register
//    const response = await client.ipAsset.register({
//        nftContract: NFTContractAddress,
//        tokenId: tokenId!,
//        ipMetadata: {
//            ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
//            ipMetadataHash: `0x${ipHash}`,
//            nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
//            nftMetadataHash: `0x${nftHash}`,
//        },
//        txOptions: { waitForTransaction: true },
//    })
//    console.log(`Root IPA created at transaction hash ${response.txHash}, IPA ID: ${response.ipId}`)
//    console.log(`View on the explorer: https://aeneid.explorer.story.foundation/ipa/${response.ipId}`)
//}
//
//main()
import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { mintNFT } from './utils/mintNFT'
import { NFTContractAddress, account, client } from './utils/utils'
import {
  uploadJSONToIPFS,
  // Make sure you actually have this function available:
  uploadFileToIPFS,
} from './utils/uploadToIpfs'

async function main() {
  // 1. Get all files in the current directory that start with `brainrot_` and end with `.mp4`
  const files = fs.readdirSync('.')
  const mp4Files = files.filter(
    (file) => file.startsWith('brainrot_') && file.endsWith('.mp4')
  )

  if (!mp4Files.length) {
    console.log('No MP4 files found that start with `brainrot_` in the current directory.')
    return
  }

  // 2. Loop over each file, upload it, create metadata, mint, and register
  for (const fileName of mp4Files) {
    console.log(`\n--- Processing file: ${fileName} ---`)

    // 2a. Read the file and compute the media hash
    const fileBuffer = fs.readFileSync(fileName)
    const fileHashHex = createHash('sha256').update(fileBuffer).digest('hex')
    const fileHash = `0x${fileHashHex}`

    // 2b. Upload the MP4 to IPFS
    // Make sure `uploadFileToIPFS(filePath)` returns the CID or a URL you can combine with `https://ipfs.io/ipfs/...`
    const mediaCid = await uploadFileToIPFS(fileName)
    const mediaUrl = `https://ipfs.io/ipfs/${mediaCid}`
    console.log(`Uploaded file to IPFS: ${mediaUrl}`)

    // 3. Prepare IP (IPA) metadata
    //    Customize any fields here as desired.
    const ipMetadata = {
      title: fileName,
      description: `This is an MP4 minted from ${fileName}.`,
      createdAt: `${Math.floor(Date.now() / 1000)}`, // current timestamp
      creators: [
        {
          name: 'Jacob Tucker',
          address: '0xA2f9Cf1E40D7b03aB81e34BC50f0A8c67B4e9112',
          contributionPercent: 100,
        },
      ],
      image: '',             // put an image if you want
      imageHash: '',         // likewise
      mediaUrl: mediaUrl,    // the IPFS URL to the video
      mediaHash: fileHash,   // the file's hash
      mediaType: 'video/mp4' // or the appropriate type for your media
    }

    // 4. Prepare NFT metadata
    const nftMetadata = {
      name: fileName,
      description: `This NFT represents ownership of the MP4 file: ${fileName}`,
      image: '', // You could store or generate a thumbnail, or leave it blank
      media: [
        {
          name: fileName,
          url: mediaUrl,      // same IPFS URL
          mimeType: 'video/mp4'
        }
      ],
      attributes: [
        // You can add any custom attributes or properties you’d like here
        {
          key: 'Source',
          value: 'Local Directory'
        }
      ]
    }

    // 5. Upload both metadata objects to IPFS
    const ipIpfsHash = await uploadJSONToIPFS(ipMetadata)
    const ipHash = createHash('sha256')
      .update(JSON.stringify(ipMetadata))
      .digest('hex')

    const nftIpfsHash = await uploadJSONToIPFS(nftMetadata)
    const nftHash = createHash('sha256')
      .update(JSON.stringify(nftMetadata))
      .digest('hex')

    console.log(`IP Metadata uploaded at ipfs.io/ipfs/${ipIpfsHash}`)
    console.log(`NFT Metadata uploaded at ipfs.io/ipfs/${nftIpfsHash}`)

    // 6. Mint the NFT (using the NFT metadata URI)
    const tokenId = await mintNFT(
      account.address,
      `https://ipfs.io/ipfs/${nftIpfsHash}`
    )
    console.log(`NFT minted with tokenId ${tokenId}`)

    // 7. Register the IP Asset (IPA)
    const response = await client.ipAsset.register({
      nftContract: NFTContractAddress,
      tokenId: tokenId!,
      ipMetadata: {
        ipMetadataURI: `https://ipfs.io/ipfs/${ipIpfsHash}`,
        ipMetadataHash: `0x${ipHash}`,
        nftMetadataURI: `https://ipfs.io/ipfs/${nftIpfsHash}`,
        nftMetadataHash: `0x${nftHash}`,
      },
      txOptions: { waitForTransaction: true },
    })

    console.log(`Root IPA created at transaction hash ${response.txHash}, IPA ID: ${response.ipId}`)
    console.log(`View on the explorer: https://aeneid.explorer.story.foundation/ipa/${response.ipId}`)
  }
}

main().catch((error) => {
  console.error('Error running script:', error)
})
