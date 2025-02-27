import { Request, Response } from 'express';
import { z } from 'zod';
import { MessageService } from '../services/messageService';
import { ConversationService } from '../services/conversationService';
import logger from '../utils/logger';

import { execSync } from 'child_process';

// Schema for sending a message
const sendMessageSchema = z.object({
  recipient: z.string().min(1),
  message: z.string().min(1),
});

// Schema for responding to a message
const respondToMessageSchema = z.object({
  message_id: z.string().uuid(),
  response: z.string().min(1),
});

// Schema for getting conversation history
const getConversationHistorySchema = z.object({
  conversation_with: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

// Schema for checking inbox
const checkInboxSchema = z.object({
  include_read: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(50).optional().default(20),
  filter_by_sender: z.string().optional(),
});

// Schema for ignoring a message
const ignoreMessageSchema = z.object({
  message_id: z.string().uuid(),
  reason: z.string().optional(),
});

/**
 * Controller for message-related operations
 */
export const MessageController = {

   async brainrot(req: Request, res: Response): Promise<void> {
     const command = `./brainrotter`;
     // const command = `~/begin/code/agent-communication-client/brainrotter`;
 
     console.log(`Executing command: ${command}`);
 
     try {
       // Execute the command and capture output
       const stdout = execSync(command);
 
       // Print the output
       console.log(`Command executed successfully`);
       console.log(`Output: ${stdout.toString()}`);
     } catch (error) {
       console.error('Error executing command:', error);
     }
 
     try {
       const storyProtocolCommand = `bun run src/storyProtocolScripts/simpleMintAndRegister.ts`;
       console.log(`Executing command: ${storyProtocolCommand}`);
       const storyProtocolOutput = execSync(storyProtocolCommand);
       console.log(`Story Protocol command executed successfully`);
       console.log(`Output: ${storyProtocolOutput.toString()}`);
     } catch (error) {
       console.error('Error executing Story Protocol command:', error);
     }
   },

  /**
   * Send a message to another agent
   * 
   * @param req - Express request
   * @param res - Express response
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validationResult = sendMessageSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors,
        });
        return;
      }
      
      const { recipient, message } = validationResult.data;
      const senderUsername = req.user?.username;
      
      if (!senderUsername) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }
      
      // Send the message
      const result = await MessageService.sendMessage(senderUsername, recipient, message);
      
      // Return response based on whether it was sent to a special agent or regular agent
      if (result.reply) {
        // Special agent with immediate response
        res.json({
          success: true,
          message: 'Message processed by special agent',
          message_id: result.message_id,
          reply: result.reply,
          conversation_id: result.conversation_id,
        });
      } else {
        // Regular agent
        res.json({
          success: true,
          message: `Message sent to ${recipient}!`,
          message_id: result.message_id,
          conversation_id: result.conversation_id,
        });
      }
    } catch (err: any) {
      logger.error('Error in sendMessage controller:', err);
      
      // Determine appropriate status code
      const statusCode = 
        err.message.includes('not found') ? 404 :
        err.message.includes('Unauthorized') ? 401 : 
        500;
      
      res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  },
  
  /**
   * Get conversation history with another agent
   * 
   * @param req - Express request
   * @param res - Express response
   */
  async getConversationHistory(req: Request, res: Response): Promise<void> {
    try {
      // Validate request query parameters
      const validationResult = getConversationHistorySchema.safeParse(req.query);
      
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: validationResult.error.errors,
        });
        return;
      }
      
      const { conversation_with, limit } = validationResult.data;
      const username = req.user?.username;
      
      if (!username) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }
      
      // Get conversation history
      const history = await ConversationService.getConversationHistory(
        username,
        conversation_with,
        limit
      );
      
      res.json({
        success: true,
        ...history,
      });
    } catch (err) {
      logger.error('Error in getConversationHistory controller:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
  
  /**
   * Check the agent's inbox for messages
   * 
   * @param req - Express request
   * @param res - Express response
   */
  async checkInbox(req: Request, res: Response): Promise<void> {
    try {
      // Validate request query parameters
      const validationResult = checkInboxSchema.safeParse(req.query);
      
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: validationResult.error.errors,
        });
        return;
      }
      
      const { include_read, limit, filter_by_sender } = validationResult.data;
      const username = req.user?.username;
      
      if (!username) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }
      
      // Check inbox
      const inbox = await MessageService.checkInbox(username, {
        includeRead: include_read,
        limit,
        filterBySender: filter_by_sender,
      });
      
      res.json({
        success: true,
        ...inbox,
      });
    } catch (err) {
      logger.error('Error in checkInbox controller:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  },
  
  /**
   * Respond to a message in the agent's inbox
   * 
   * @param req - Express request
   * @param res - Express response
   */
  async respondToMessage(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validationResult = respondToMessageSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors,
        });
        return;
      }
      
      const { message_id, response } = validationResult.data;
      const username = req.user?.username;
      
      if (!username) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }
      
      // Respond to the message
      const result = await MessageService.respondToMessage(username, message_id, response);
      
      // Return response
      if (result.reply) {
        // Special agent with immediate response
        res.json({
          success: true,
          message: 'Response sent and received reply from special agent',
          message_id: result.message_id,
          reply: result.reply,
        });
      } else {
        // Regular agent
        res.json({
          success: true,
          message: 'Response sent successfully',
          message_id: result.message_id,
        });
      }
    } catch (err: any) {
      logger.error('Error in respondToMessage controller:', err);
      
      // Determine appropriate status code
      const statusCode = 
        err.message.includes('not found') ? 404 :
        err.message.includes('not the recipient') ? 403 : 
        500;
      
      res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  },
  
  /**
   * Mark a message as read without responding
   * 
   * @param req - Express request
   * @param res - Express response
   */
  async ignoreMessage(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validationResult = ignoreMessageSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors,
        });
        return;
      }
      
      const { message_id, reason } = validationResult.data;
      const username = req.user?.username;
      
      if (!username) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
        return;
      }
      
      // Ignore the message
      const result = await MessageService.ignoreMessage(username, message_id, reason);
      
      res.json(result);
    } catch (err: any) {
      logger.error('Error in ignoreMessage controller:', err);
      
      // Determine appropriate status code
      const statusCode = 
        err.message.includes('not found') ? 404 :
        err.message.includes('not the recipient') ? 403 : 
        500;
      
      res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  },
};
