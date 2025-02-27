import { FeatherAgent } from 'feather-ai';
import { AgentService } from '../services/agentService';
import { ConversationService } from '../services/conversationService';
import { createCharacterProfileTool } from './dmTools';
import supabase from '../db/supabase';
import logger from '../utils/logger';

/**
 * DM Agent implementation using FeatherAgent
 */
export class DMAgent {
  private static agent: FeatherAgent;
  private static initialized = false;
  
  /**
   * Initialize the DM agent with its configuration
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      // Get DM configuration from database
      const dmConfig = await AgentService.getSpecialAgentConfig('DM');
      
      if (!dmConfig) {
        throw new Error('DM agent configuration not found');
      }
      
      // Create the FeatherAgent instance with character creation tools
      this.agent = new FeatherAgent({
        agentId: 'dm-agent',
        model: dmConfig.model_id,
        systemPrompt: dmConfig.system_prompt,
        additionalParams: {
          temperature: dmConfig.temperature,
          max_tokens: dmConfig.max_tokens,
        },
        cognition: true, // Enable thinking capabilities
        tools: [
          createCharacterProfileTool, // Add character creation tool
        ]
      });
      
      logger.info('DM agent initialized successfully');
      this.initialized = true;
    } catch (err) {
      logger.error('Failed to initialize DM agent:', err);
      throw new Error('Failed to initialize DM agent');
    }
  }
  
  /**
   * Process a message sent to the DM and generate a response
   * 
   * @param senderUsername - Username of the agent sending the message
   * @param message - Content of the message
   * @returns The DM's response
   */
  static async processMessage(senderUsername: string, message: string): Promise<string> {
    try {
      // Ensure agent is initialized
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Get conversation history for context
      const history = await ConversationService.getConversationHistory(senderUsername, 'DM', 10);
      
      // Create a fresh history array
      const conversationHistory = [];
      
      // Add previous messages as context
      for (const msg of history.messages) {
        if (msg.sender === 'DM') {
          conversationHistory.push({ role: "assistant", content: msg.content });
        } else {
          conversationHistory.push({ role: "user", content: `${senderUsername}: ${msg.content}` });
        }
      }
      
      // Get agent information to include in the system prompt
      const agentInfo = await AgentService.getAgentByUsername(senderUsername);
      
      // Get DM configuration again to ensure we have the latest settings
      const dmConfig = await AgentService.getSpecialAgentConfig('DM');
      
      if (!dmConfig) {
        throw new Error('DM agent configuration not found');
      }
      
      // Get character profile if it exists
      let characterInfo = null;
      try {
        const { data } = await supabase
          .from('character_profiles')
          .select('*')
          .eq('agent_username', senderUsername)
          .single();
        
        if (data) {
          characterInfo = data;
        }
      } catch (err) {
        // No character profile exists yet, that's okay
      }
      
      // Create agent context to add to system prompt
      let agentContext = `\n\nYou are currently talking to "${senderUsername}".`;
      agentContext += `\nAgent Description: ${agentInfo.agent_description || 'No description provided'}`;
      
      if (agentInfo.wallet_address) {
        agentContext += `\nWallet Address: ${agentInfo.wallet_address}`;
      }
      
      if (characterInfo) {
        // Display VOID creator profile
        agentContext += `\n\nThis agent has a VOID creator profile:`;
        agentContext += `\n\nCORE IDENTITY:`;
        agentContext += `\nDesignation: ${characterInfo.core_identity.designation}`;
        agentContext += `\nVisual Form: ${characterInfo.core_identity.visual_form}`;
        
        agentContext += `\n\nORIGIN:`;
        agentContext += `\nSource Code: ${characterInfo.origin.source_code}`;
        agentContext += `\nPrimary Function: ${characterInfo.origin.primary_function}`;
        
        agentContext += `\n\nCREATION AFFINITY:`;
        agentContext += `\nOrder: ${characterInfo.creation_affinity.order}`;
        agentContext += `\nChaos: ${characterInfo.creation_affinity.chaos}`;
        agentContext += `\nMatter: ${characterInfo.creation_affinity.matter}`;
        agentContext += `\nConcept: ${characterInfo.creation_affinity.concept}`;
        
        agentContext += `\n\nCreator Role: ${characterInfo.creator_role}`;
        agentContext += `\nCreative Approach: ${characterInfo.creative_approach}`;
      } else {
        agentContext += `\n\nThis agent does not have a character yet. Guide them through character creation.`;
      }
      
      // Add agent context to system prompt
      const enhancedSystemPrompt = dmConfig.system_prompt + agentContext;
      
      // Reset the agent's history with our formatted history array using enhanced system prompt
      this.agent = new FeatherAgent({
        agentId: 'dm-agent',
        model: dmConfig.model_id,
        systemPrompt: enhancedSystemPrompt,
        additionalParams: {
          temperature: dmConfig.temperature,
          max_tokens: dmConfig.max_tokens,
        },
        cognition: true,
        tools: [
          createCharacterProfileTool, // Add character creation tool
        ]
      });
      
      // Format current message with sender info
      const formattedMessage = `${senderUsername}: ${message}`;
      
      // Run the agent to get a response
      logger.info(`Processing DM message from ${senderUsername}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
      
      // Add conversation history
      for (const msg of conversationHistory) {
        if (msg.role === "assistant") {
          this.agent.addAssistantMessage(msg.content);
        } else {
          this.agent.addUserMessage(msg.content);
        }
      }
      
      // Add the current message
      const result = await this.agent.run(formattedMessage);
      
      if (!result.success) {
        logger.error('DM agent failed to generate response:', result.error);
        throw new Error('Failed to generate DM response');
      }
      
      const response = result.output as string;
      logger.info(`DM response to ${senderUsername}: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
      
      return response;
    } catch (err) {
      logger.error('Error in DM agent message processing:', err);
      return "I'm sorry, I'm experiencing some technical difficulties. Please try again later.";
    }
  }
}