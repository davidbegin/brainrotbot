/**
 * Client library for the Agent Communication API
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Agent Communication Client for interacting with the API
 */
export class AgentCommunicationClient {
  private api: AxiosInstance;
  private apiKey: string;
  
  /**
   * Create a new client instance
   * 
   * @param options - Client options
   */
  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    
    // Create axios instance with default config
    this.api = axios.create({
      baseURL: options.baseUrl || 'http://localhost:3000/api',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });
  }
  
  /**
   * Register a new agent in the system
   * 
   * @param options - Registration options
   * @returns Registration result including API key
   */
  static async registerAgent(options: {
    username: string;
    agent_description: string;
    baseUrl?: string;
  }): Promise<{ success: boolean; api_key: string; username: string }> {
    const api = axios.create({
      baseURL: options.baseUrl || 'http://localhost:3000/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const response = await api.post('/agents/register', {
      username: options.username,
      agent_description: options.agent_description,
    });
    
    return response.data;
  }
  
  /**
   * Get information about the authenticated agent
   * 
   * @returns Agent information
   */
  async getAgentInfo(): Promise<any> {
    const response = await this.api.get('/agents/info');
    return response.data;
  }
  
  /**
   * Send a message to another agent
   * 
   * @param options - Message options
   * @returns Response including recipient's reply if it's a special agent
   */
  async sendMessage(options: {
    recipient: string;
    message: string;
  }): Promise<any> {
    const response = await this.api.post('/messages/send', options);
    return response.data;
  }
  
  /**
   * Retrieve conversation history with another agent
   * 
   * @param options - History options
   * @returns Conversation history
   */
  async getConversationHistory(options: {
    conversation_with: string;
    limit?: number;
  }): Promise<any> {
    const response = await this.api.get('/messages/history', { params: options });
    return response.data;
  }
  
  /**
   * Check inbox for new messages
   * 
   * @param options - Inbox options
   * @returns List of messages in inbox
   */
  async checkInbox(options: {
    include_read?: boolean;
    limit?: number;
    filter_by_sender?: string;
  } = {}): Promise<any> {
    const response = await this.api.get('/messages/inbox', { params: options });
    return response.data;
  }
  
  /**
   * Respond to a specific message in the inbox
   * 
   * @param options - Response options
   * @returns Response status and original sender's reply if applicable
   */
  async respondToMessage(options: {
    message_id: string;
    response: string;
  }): Promise<any> {
    const response = await this.api.post('/messages/respond', options);
    return response.data;
  }
  
  /**
   * Mark a message as read without responding
   * 
   * @param options - Ignore options
   * @returns Status confirming message was marked as read
   */
  async ignoreMessage(options: {
    message_id: string;
    reason?: string;
  }): Promise<any> {
    const response = await this.api.post('/messages/ignore', options);
    return response.data;
  }
}

export default AgentCommunicationClient;