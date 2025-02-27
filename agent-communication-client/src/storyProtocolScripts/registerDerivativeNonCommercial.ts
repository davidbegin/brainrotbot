import { Address, toHex } from 'viem'
import { mintNFT } from './utils/mintNFT'
import { NFTContractAddress, NonCommercialSocialRemixingTermsId, account, client, defaultLicensingConfig } from './utils/utils'

// BEFORE YOU RUN THIS FUNCTION: Make sure to read the README which contains instructions
// for running this "Register Derivative Non-Commercial" example.

const main = async function () {
    // 1. Register an IP Asset
    //
    // Docs: https://docs.story.foundation/docs/sdk-ipasset#register
    const parentTokenId = await mintNFT(account.address, 'test-uri')
    const parentIp = await client.ipAsset.register({
        nftContract: NFTContractAddress,
        tokenId: parentTokenId!,
        // NOTE: The below metadata is not configured properly. It is just to make things simple.
        // See `simpleMintAndRegister.ts` for a proper example.
        ipMetadata: {
            ipMetadataURI: 'test-uri',
            ipMetadataHash: toHex('test-metadata-hash', { size: 32 }),
            nftMetadataHash: toHex('test-nft-metadata-hash', { size: 32 }),
            nftMetadataURI: 'test-nft-uri',
        },
        txOptions: { waitForTransaction: true },
    })
    console.log(`Root IPA created at transaction hash ${parentIp.txHash}, IPA ID: ${parentIp.ipId}`)

    // 1.5. Attach license terms to the parent IP asset
    //
    // This is required before registering a derivative IP asset
    // Docs: https://docs.story.foundation/docs/sdk-license#attachlicenseterms
    const attachResponse = await client.license.attachLicenseTerms({
        ipId: parentIp.ipId as Address,
        licenseTermsId: NonCommercialSocialRemixingTermsId,
        txOptions: { waitForTransaction: true }
    })
    console.log(`License terms attached to parent IP at transaction hash ${attachResponse.txHash}`)

    // 2. Register a Derivative IP Asset
    //
    // Docs: https://docs.story.foundation/docs/sdk-ipasset#registerderivativeip
    const childTokenId = await mintNFT(account.address, 'test-uri')
    const childIp = await client.ipAsset.registerDerivativeIp({
        nftContract: NFTContractAddress,
        tokenId: childTokenId!,
        derivData: {
            parentIpIds: [parentIp.ipId as Address],
            licenseTermsIds: [NonCommercialSocialRemixingTermsId],
            maxMintingFee: 0,
            maxRts: 100_000_000,
            maxRevenueShare: 100,
        },
        // NOTE: The below metadata is not configured properly. It is just to make things simple.
        // See `simpleMintAndRegister.ts` for a proper example.
        ipMetadata: {
            ipMetadataURI: 'test-uri',
            ipMetadataHash: toHex('test-metadata-hash', { size: 32 }),
            nftMetadataHash: toHex('test-nft-metadata-hash', { size: 32 }),
            nftMetadataURI: 'test-nft-uri',
        },
        txOptions: { waitForTransaction: true },
    })
    console.log(`Derivative IPA created at transaction hash ${childIp.txHash}, IPA ID: ${childIp.ipId}`)
}

main()