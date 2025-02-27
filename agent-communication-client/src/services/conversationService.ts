import { v4 as uuidv4 } from 'uuid';
import supabase from '../db/supabase';
import logger from '../utils/logger';
import { AgentService } from './agentService';

/**
 * Service for handling conversation-related operations
 */
export class ConversationService {
  /**
   * Get or create a conversation between two agents
   * 
   * @param agentA - First agent username
   * @param agentB - Second agent username
   * @returns The conversation ID
   */
  static async getOrCreateConversation(agentA: string, agentB: string): Promise<string> {
    try {
      // Verify both agents exist
      await Promise.all([
        AgentService.getAgentByUsername(agentA),
        AgentService.getAgentByUsername(agentB)
      ]);
      
      // Always sort usernames to ensure consistency in queries
      const participants = [agentA, agentB].sort();
      
      // Check if conversation already exists
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('conversation_id')
        .contains('participants', participants)
        .eq('status', 'active')
        .maybeSingle();
      
      if (existingConversation) {
        return existingConversation.conversation_id;
      }
      
      // Create new conversation
      const conversationId = uuidv4();
      const { error } = await supabase
        .from('conversations')
        .insert({
          conversation_id: conversationId,
          participants,
          status: 'active',
        });
      
      if (error) {
        logger.error('Failed to create conversation:', error);
        throw new Error('Failed to create conversation');
      }
      
      logger.info(`Created new conversation ${conversationId} between ${agentA} and ${agentB}`);
      return conversationId;
    } catch (err) {
      logger.error('Error in getOrCreateConversation:', err);
      throw err;
    }
  }
  
  /**
   * Get conversation history between two agents
   * 
   * @param senderUsername - The requesting agent's username
   * @param otherUsername - The other agent in the conversation
   * @param limit - Maximum number of messages to retrieve
   * @returns The conversation history
   */
  static async getConversationHistory(
    senderUsername: string,
    otherUsername: string,
    limit: number = 50
  ): Promise<{
    conversation_id: string;
    with_agent: string;
    messages: Array<{
      message_id: string;
      sender: string;
      content: string;
      timestamp: string;
    }>;
    has_more: boolean;
    total_messages: number;
  }> {
    try {
      // Get the conversation ID
      const conversationId = await this.getOrCreateConversation(senderUsername, otherUsername);
      
      // Get the total count of messages
      const { count: totalCount, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);
      
      if (countError) {
        logger.error('Error getting message count:', countError);
        throw new Error('Failed to retrieve conversation history');
      }
      
      // Get the messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('message_id, sender_username, content, timestamp')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (messagesError) {
        logger.error('Error getting messages:', messagesError);
        throw new Error('Failed to retrieve conversation history');
      }
      
      // Format the response
      const formattedMessages = messages.map(msg => ({
        message_id: msg.message_id,
        sender: msg.sender_username,
        content: msg.content,
        timestamp: msg.timestamp,
      })).reverse(); // Reverse to get chronological order
      
      return {
        conversation_id: conversationId,
        with_agent: otherUsername,
        messages: formattedMessages,
        has_more: totalCount > limit,
        total_messages: totalCount || 0,
      };
    } catch (err) {
      logger.error('Error in getConversationHistory:', err);
      throw err;
    }
  }
  
  /**
   * Archive a conversation
   * 
   * @param conversationId - The conversation ID to archive
   * @param requestingAgent - The username of the agent making the request
   */
  static async archiveConversation(conversationId: string, requestingAgent: string): Promise<void> {
    try {
      // Verify the agent is a participant in the conversation
      const { data: conversation, error: fetchError } = await supabase
        .from('conversations')
        .select('participants')
        .eq('conversation_id', conversationId)
        .single();
      
      if (fetchError || !conversation) {
        throw new Error('Conversation not found');
      }
      
      if (!conversation.participants.includes(requestingAgent)) {
        throw new Error('You are not a participant in this conversation');
      }
      
      // Archive the conversation
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ status: 'archived' })
        .eq('conversation_id', conversationId);
      
      if (updateError) {
        logger.error('Failed to archive conversation:', updateError);
        throw new Error('Failed to archive conversation');
      }
      
      logger.info(`Archived conversation ${conversationId}`);
    } catch (err) {
      logger.error('Error in archiveConversation:', err);
      throw err;
    }
  }
}