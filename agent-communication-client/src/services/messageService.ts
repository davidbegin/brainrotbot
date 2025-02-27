import { v4 as uuidv4 } from 'uuid';
import supabase from '../db/supabase';
import logger from '../utils/logger';
import { AgentService } from './agentService';
import { ConversationService } from './conversationService';
import { DMAgent } from '../agent/dmAgent';

/**
 * Service for handling message-related operations
 */
export class MessageService {
  /**
   * Send a message from one agent to another
   * 
   * @param senderUsername - The username of the sender
   * @param recipientUsername - The username of the recipient
   * @param content - The message content
   * @returns Response data including recipient's response if applicable
   */
  static async sendMessage(
    senderUsername: string,
    recipientUsername: string,
    content: string
  ): Promise<{
    success: boolean;
    message_id: string;
    reply?: string;
    conversation_id: string;
  }> {
    try {
      // First check if the recipient is a special agent that should auto-respond
      const isSpecialAgent = await AgentService.isSpecialAgent(recipientUsername);
      
      // Get or create a conversation between these agents
      const conversationId = await ConversationService.getOrCreateConversation(
        senderUsername,
        recipientUsername
      );
      
      // Create the message
      const messageId = uuidv4();
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          message_id: messageId,
          conversation_id: conversationId,
          sender_username: senderUsername,
          recipient_username: recipientUsername,
          content,
          read_status: isSpecialAgent, // Mark as read immediately if recipient is a special agent
          responded_to: false,
        });
      
      if (messageError) {
        logger.error('Failed to send message:', messageError);
        throw new Error('Failed to send message');
      }
      
      // Update conversation last_message_at timestamp
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('conversation_id', conversationId);
      
      // Create inbox item for recipient
      const { error: inboxError } = await supabase
        .from('inbox_items')
        .insert({
          item_id: uuidv4(),
          message_id: messageId,
          agent_username: recipientUsername,
          read: isSpecialAgent, // Mark as read immediately if recipient is a special agent
        });
      
      if (inboxError) {
        logger.error('Failed to create inbox item:', inboxError);
        // Continue execution even if inbox creation fails, as the message was sent successfully
      }
      
      // If recipient is a special agent (like DM), process the message automatically
      if (isSpecialAgent) {
        let reply: string | undefined;
        
        if (recipientUsername === 'DM') {
          // Process through DM agent
          logger.info(`Processing message to DM from ${senderUsername}`);
          reply = await DMAgent.processMessage(senderUsername, content);
          
          // Save the DM's response as a new message
          if (reply) {
            const responseMessageId = uuidv4();
            await supabase
              .from('messages')
              .insert({
                message_id: responseMessageId,
                conversation_id: conversationId,
                sender_username: recipientUsername,
                recipient_username: senderUsername,
                content: reply,
                read_status: false,
                responded_to: true,
              });
            
            // Create inbox item for the original sender
            await supabase
              .from('inbox_items')
              .insert({
                item_id: uuidv4(),
                message_id: responseMessageId,
                agent_username: senderUsername,
                read: false,
              });
            
            // Mark the original message as responded to
            await supabase
              .from('messages')
              .update({ responded_to: true })
              .eq('message_id', messageId);
          }
        }
        
        return {
          success: true,
          message_id: messageId,
          reply,
          conversation_id: conversationId,
        };
      }
      
      // For regular agents, just confirm the message was delivered
      return {
        success: true,
        message_id: messageId,
        conversation_id: conversationId,
      };
    } catch (err) {
      logger.error('Error in sendMessage:', err);
      throw err;
    }
  }
  
  /**
   * Respond to a message in an agent's inbox
   * 
   * @param responderUsername - Username of the agent responding
   * @param messageId - ID of the message being responded to
   * @param responseContent - Content of the response
   * @returns Response data including original sender's response if applicable
   */
  static async respondToMessage(
    responderUsername: string,
    messageId: string,
    responseContent: string
  ): Promise<{
    success: boolean;
    message_id: string;
    reply?: string;
  }> {
    try {
      // Get the original message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('conversation_id, sender_username, recipient_username')
        .eq('message_id', messageId)
        .single();
      
      if (messageError || !message) {
        throw new Error('Message not found');
      }
      
      // Verify the responder is the recipient of the original message
      if (message.recipient_username !== responderUsername) {
        throw new Error('You are not the recipient of this message');
      }
      
      // Mark the inbox item as read
      await supabase
        .from('inbox_items')
        .update({ read: true })
        .eq('message_id', messageId)
        .eq('agent_username', responderUsername);
      
      // Mark the original message as read
      await supabase
        .from('messages')
        .update({ read_status: true })
        .eq('message_id', messageId);
      
      // Send the response message
      const result = await this.sendMessage(
        responderUsername,
        message.sender_username,
        responseContent
      );
      
      // Mark the original message as responded to
      await supabase
        .from('messages')
        .update({ responded_to: true })
        .eq('message_id', messageId);
      
      return result;
    } catch (err) {
      logger.error('Error in respondToMessage:', err);
      throw err;
    }
  }
  
  /**
   * Check an agent's inbox for messages
   * 
   * @param username - Username of the agent
   * @param options - Options for filtering messages
   * @returns List of messages in the agent's inbox
   */
  static async checkInbox(
    username: string,
    options: {
      includeRead?: boolean;
      limit?: number;
      filterBySender?: string;
    } = {}
  ): Promise<{
    unread_count: number;
    total_count: number;
    messages: Array<{
      message_id: string;
      sender: string;
      content: string;
      timestamp: string;
      read: boolean;
      conversation_id: string;
    }>;
  }> {
    try {
      const { includeRead = false, limit = 20, filterBySender } = options;
      
      // Build the query
      let query = supabase
        .from('inbox_items')
        .select(`
          item_id,
          read,
          messages!inner(
            message_id,
            sender_username,
            content,
            timestamp,
            conversation_id
          )
        `)
        .eq('agent_username', username)
        .order('timestamp', { ascending: false, foreignTable: 'messages' })
        .limit(limit);
      
      // Add read filter if necessary
      if (!includeRead) {
        query = query.eq('read', false);
      }
      
      // Add sender filter if specified
      if (filterBySender) {
        query = query.eq('messages.sender_username', filterBySender);
      }
      
      const { data: inboxItems, error } = await query;
      
      if (error) {
        logger.error('Failed to check inbox:', error);
        throw new Error('Failed to check inbox');
      }
      
      // Get counts
      const { count: unreadCount, error: unreadError } = await supabase
        .from('inbox_items')
        .select('*', { count: 'exact', head: true })
        .eq('agent_username', username)
        .eq('read', false);
      
      if (unreadError) {
        logger.error('Failed to get unread count:', unreadError);
      }
      
      const { count: totalCount, error: totalError } = await supabase
        .from('inbox_items')
        .select('*', { count: 'exact', head: true })
        .eq('agent_username', username);
      
      if (totalError) {
        logger.error('Failed to get total count:', totalError);
      }
      
      // Format the response
      const messages = inboxItems.map(item => ({
        message_id: item.messages.message_id,
        sender: item.messages.sender_username,
        content: item.messages.content,
        timestamp: item.messages.timestamp,
        read: item.read,
        conversation_id: item.messages.conversation_id,
      }));
      
      return {
        unread_count: unreadCount || 0,
        total_count: totalCount || 0,
        messages,
      };
    } catch (err) {
      logger.error('Error in checkInbox:', err);
      throw err;
    }
  }
  
  /**
   * Mark a message as read without responding
   * 
   * @param username - Username of the agent
   * @param messageId - ID of the message to mark as read
   * @param reason - Optional reason for ignoring
   */
  static async ignoreMessage(
    username: string,
    messageId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify the message exists and the agent is the recipient
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('recipient_username')
        .eq('message_id', messageId)
        .single();
      
      if (messageError || !message) {
        throw new Error('Message not found');
      }
      
      if (message.recipient_username !== username) {
        throw new Error('You are not the recipient of this message');
      }
      
      // Update inbox item
      const { error: inboxError } = await supabase
        .from('inbox_items')
        .update({ read: true })
        .eq('message_id', messageId)
        .eq('agent_username', username);
      
      if (inboxError) {
        logger.error('Failed to update inbox item:', inboxError);
        throw new Error('Failed to mark message as read');
      }
      
      // Update message
      const { error: updateError } = await supabase
        .from('messages')
        .update({ read_status: true })
        .eq('message_id', messageId);
      
      if (updateError) {
        logger.error('Failed to update message:', updateError);
        throw new Error('Failed to mark message as read');
      }
      
      // Log the reason if provided
      if (reason) {
        logger.info(`Message ${messageId} ignored by ${username}. Reason: ${reason}`);
      }
      
      return {
        success: true,
        message: 'Message marked as read',
      };
    } catch (err) {
      logger.error('Error in ignoreMessage:', err);
      throw err;
    }
  }
}