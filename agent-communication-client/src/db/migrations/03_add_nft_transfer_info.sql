-- Add new fields to track NFT transfers to the character_profiles table
ALTER TABLE character_profiles 
ADD COLUMN IF NOT EXISTS nft_info jsonb DEFAULT NULL;

-- Update nft_info schema to support tracking transfers
-- This is a safe operation as it only adds fields to the jsonb structure
DO $$
BEGIN
  -- Add a note to developers in the migration log
  RAISE NOTICE 'Adding transfer tracking fields to nft_info in character_profiles table';
END $$;

-- No need to add fields directly since JSONB can accept new fields without schema changes.
-- When updating the nft_info, we'll include the new fields:
-- - transferred_to_agent: boolean
-- - transfer_tx_hash: string