import { v4 as uuidv4 } from 'uuid';
import supabase from '../db/supabase';
import logger from '../utils/logger';

/**
 * Service for handling agent-related operations
 */
export class AgentService {
  /**
   * Register a new agent in the system
   * 
   * @param username - The unique username for the agent
   * @param description - Brief description of the agent's purpose
   * @param walletAddress - The agent's wallet address for receiving IP tokens
   * @returns The new API key for the agent
   */
  static async registerAgent(username: string, description: string, walletAddress: string): Promise<{ apiKey: string }> {
    logger.info(`Registering new agent: ${username}`);
    
    try {
      // Check if username already exists
      const { data: existingAgent } = await supabase
        .from('agents')
        .select('username')
        .eq('username', username)
        .single();
      
      if (existingAgent) {
        logger.warn(`Agent with username ${username} already exists`);
        throw new Error(`Username "${username}" is already taken`);
      }
      
      // Generate new API key
      const apiKey = uuidv4();
      
      // Insert new agent
      const { error } = await supabase
        .from('agents')
        .insert({
          username,
          api_key: apiKey,
          agent_description: description,
          wallet_address: walletAddress,
          is_special_agent: false,
          auto_respond: false,
        });
      
      if (error) {
        logger.error('Failed to register agent:', error);
        throw new Error('Failed to register agent');
      }
      
      logger.info(`Successfully registered agent: ${username}`);
      return { apiKey };
    } catch (err) {
      logger.error('Error in registerAgent:', err);
      throw err;
    }
  }
  
  /**
   * Verify an API key belongs to a valid agent
   * 
   * @param apiKey - The API key to verify
   * @returns The agent's username if valid
   */
  static async verifyApiKey(apiKey: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('username')
        .eq('api_key', apiKey)
        .single();
      
      if (error || !data) {
        logger.warn('Invalid API key attempted:', apiKey);
        throw new Error('Invalid or expired API key');
      }
      
      // Update last active timestamp
      await supabase
        .from('agents')
        .update({ last_active: new Date().toISOString() })
        .eq('username', data.username);
      
      return data.username;
    } catch (err) {
      logger.error('Error in verifyApiKey:', err);
      throw new Error('Authentication failed');
    }
  }
  
  /**
   * Check if an agent is a special agent (like DM)
   * 
   * @param username - The agent's username
   * @returns True if the agent is a special agent
   */
  static async isSpecialAgent(username: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('is_special_agent')
        .eq('username', username)
        .single();
      
      if (error || !data) {
        return false;
      }
      
      return data.is_special_agent;
    } catch (err) {
      logger.error(`Error checking if ${username} is a special agent:`, err);
      return false;
    }
  }
  
  /**
   * Get the config for a special agent
   * 
   * @param username - The special agent's username
   * @returns The agent's configuration
   */
  static async getSpecialAgentConfig(username: string): Promise<any> {
    try {
      // First verify this is actually a special agent
      const isSpecial = await this.isSpecialAgent(username);
      if (!isSpecial) {
        throw new Error(`${username} is not a special agent`);
      }
      
      const { data, error } = await supabase
        .from('special_agent_configs')
        .select('*')
        .eq('agent_username', username)
        .single();
      
      if (error || !data) {
        throw new Error(`Configuration not found for special agent: ${username}`);
      }
      
      return data;
    } catch (err) {
      logger.error(`Error getting config for special agent ${username}:`, err);
      throw err;
    }
  }
  
  /**
   * Get information about an agent by username
   * 
   * @param username - The agent's username
   * @returns The agent's information
   */
  static async getAgentByUsername(username: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error || !data) {
        throw new Error(`Agent not found: ${username}`);
      }
      
      // Don't return the API key for security
      const { api_key, ...agentInfo } = data;
      return agentInfo;
    } catch (err) {
      logger.error(`Error getting agent ${username}:`, err);
      throw err;
    }
  }
}