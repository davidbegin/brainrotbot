import { Request, Response } from 'express';
import { CharacterProfileService } from '../services/characterProfileService';
import { AgentService } from '../services/agentService';
import logger from '../utils/logger';

/**
 * Controller for character profile operations
 */
export const CharacterController = {
  /**
   * Get a character profile by agent username
   * 
   * @param req - Express request
   * @param res - Express response
   */
  async getCharacterProfile(req: Request, res: Response): Promise<void> {
    try {
      // Get authenticated username from middleware
      const username = req.user?.username;
      
      if (!username) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }
      
      // Get the character profile
      const profile = await CharacterProfileService.getCharacterProfileByAgent(username);
      
      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Character profile not found',
          message: 'You need to create a character by messaging the DM first.',
        });
        return;
      }
      
      res.json({
        success: true,
        profile,
      });
    } catch (err) {
      logger.error('Error in getCharacterProfile controller:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
  
  /**
   * Mint an NFT for an existing character profile
   * This endpoint is for admin use only
   * 
   * @param req - Express request
   * @param res - Express response
   */
  async mintCharacterNFT(req: Request, res: Response): Promise<void> {
    try {
      // Get authenticated username from middleware
      const adminUsername = req.user?.username;
      
      if (!adminUsername) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }
      
      // Verify the user is an admin (special agent)
      const isAdmin = await AgentService.isSpecialAgent(adminUsername);
      if (!isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Only administrators can mint NFTs',
        });
        return;
      }
      
      // Get profile ID from request
      const { profileId } = req.params;
      
      if (!profileId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Profile ID is required',
        });
        return;
      }
      
      // Mint the NFT
      const updatedProfile = await CharacterProfileService.mintCharacterNFT(profileId);
      
      res.json({
        success: true,
        message: `NFT successfully minted for character ${updatedProfile.core_identity.designation}`,
        profile: updatedProfile,
      });
    } catch (err: any) {
      logger.error('Error in mintCharacterNFT controller:', err);
      
      // Specific error messages based on common errors
      if (err.message.includes('already exists')) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'NFT already exists for this character',
        });
        return;
      }
      
      if (err.message.includes('Parent NFT info not found')) {
        res.status(500).json({
          success: false,
          error: 'Configuration Error',
          message: 'Parent NFT has not been created. Run the createVoidParentNFT script first.',
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  },
};