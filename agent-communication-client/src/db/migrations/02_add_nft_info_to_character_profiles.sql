-- Update character_profiles table to add NFT info column
ALTER TABLE character_profiles 
ADD COLUMN IF NOT EXISTS nft_info JSONB;

COMMENT ON COLUMN character_profiles.nft_info IS 'NFT information for the character profile, including token ID, IP ID, and image URL';