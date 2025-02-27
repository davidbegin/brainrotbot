import { Request, Response } from 'express';
import { z } from 'zod';
import { AgentService } from '../services/agentService';
import logger from '../utils/logger';

/**
 * Schema for agent registration
 */
const registerAgentSchema = z.object({
  username: z.string().min(3).max(50),
  agent_description: z.string().max(500),
  wallet_address: z.string().min(1, "Wallet address is required"),
});

/**
 * Controller for agent-related operations
 */
export const AgentController = {
  /**
   * Register a new agent
   * 
   * @param req - Express request
   * @param res - Express response
   */
  async registerAgent(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validationResult = registerAgentSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors,
        });
        return;
      }
      
      const { username, agent_description, wallet_address } = validationResult.data;
      
      // Register the agent
      const result = await AgentService.registerAgent(username, agent_description, wallet_address);
      
      // Return success response with API key
      res.status(201).json({
        success: true,
        message: 'Agent registered successfully',
        api_key: result.apiKey,
        username,
      });
    } catch (err: any) {
      logger.error('Error in registerAgent controller:', err);
      
      // Handle specific errors
      if (err.message.includes('already taken')) {
        res.status(409).json({
          success: false,
          error: err.message,
        });
        return;
      }
      
      // Generic error
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
  
  /**
   * Get information about the authenticated agent
   * 
   * @param req - Express request
   * @param res - Express response
   */
  async getAgentInfo(req: Request, res: Response): Promise<void> {
    try {
      // Agent username comes from auth middleware
      const username = req.user?.username;
      
      if (!username) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }
      
      // Get agent info
      const agentInfo = await AgentService.getAgentByUsername(username);
      
      res.json({
        success: true,
        agent: agentInfo,
      });
    } catch (err) {
      logger.error('Error in getAgentInfo controller:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
};