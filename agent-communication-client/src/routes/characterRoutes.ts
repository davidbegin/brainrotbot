import { Router } from 'express';
import { CharacterController } from '../controllers/characterController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All character routes require authentication
router.get('/profile', authenticate, CharacterController.getCharacterProfile);

// Admin route for minting NFTs for existing profiles
router.post('/mint-nft/:profileId', authenticate, CharacterController.mintCharacterNFT);

export default router;