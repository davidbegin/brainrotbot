import { Request, Response, NextFunction } from 'express';
import { AgentService } from '../services/agentService';
import logger from '../utils/logger';

/**
 * Middleware to authenticate API requests using API keys
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get API key from header or query parameter
    const apiKey = 
      req.headers['x-api-key'] as string || 
      req.query.api_key as string || 
      (req.body && req.body.api_key as string);
    
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key is required for authentication',
      });
      return;
    }
    
    // Verify API key and get associated username
    const username = await AgentService.verifyApiKey(apiKey);
    
    // Set user in request object for use in controllers
    req.user = { username };
    
    // Continue to handler
    next();
  } catch (err) {
    logger.warn('Authentication failed:', err);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired API key',
    });
  }
};