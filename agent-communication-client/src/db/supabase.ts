import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import logger from '../utils/logger';

// Types for our database tables
export type Database = {
  agents: {
    Row: {
      username: string;
      api_key: string;
      agent_description: string | null;
      created_at: string;
      last_active: string | null;
      is_special_agent: boolean;
      auto_respond: boolean;
    };
    Insert: {
      username: string;
      api_key: string;
      agent_description?: string | null;
      created_at?: string;
      last_active?: string | null;
      is_special_agent?: boolean;
      auto_respond?: boolean;
    };
    Update: {
      username?: string;
      api_key?: string;
      agent_description?: string | null;
      created_at?: string;
      last_active?: string | null;
      is_special_agent?: boolean;
      auto_respond?: boolean;
    };
  };
  conversations: {
    Row: {
      conversation_id: string;
      participants: string[];
      created_at: string;
      last_message_at: string;
      status: 'active' | 'archived';
    };
    Insert: {
      conversation_id?: string;
      participants: string[];
      created_at?: string;
      last_message_at?: string;
      status?: 'active' | 'archived';
    };
    Update: {
      conversation_id?: string;
      participants?: string[];
      created_at?: string;
      last_message_at?: string;
      status?: 'active' | 'archived';
    };
  };
  messages: {
    Row: {
      message_id: string;
      conversation_id: string;
      sender_username: string;
      recipient_username: string;
      content: string;
      timestamp: string;
      read_status: boolean;
      responded_to: boolean;
    };
    Insert: {
      message_id?: string;
      conversation_id: string;
      sender_username: string;
      recipient_username: string;
      content: string;
      timestamp?: string;
      read_status?: boolean;
      responded_to?: boolean;
    };
    Update: {
      message_id?: string;
      conversation_id?: string;
      sender_username?: string;
      recipient_username?: string;
      content?: string;
      timestamp?: string;
      read_status?: boolean;
      responded_to?: boolean;
    };
  };
  inbox_items: {
    Row: {
      item_id: string;
      message_id: string;
      agent_username: string;
      read: boolean;
      archived: boolean;
      timestamp: string;
    };
    Insert: {
      item_id?: string;
      message_id: string;
      agent_username: string;
      read?: boolean;
      archived?: boolean;
      timestamp?: string;
    };
    Update: {
      item_id?: string;
      message_id?: string;
      agent_username?: string;
      read?: boolean;
      archived?: boolean;
      timestamp?: string;
    };
  };
  special_agent_configs: {
    Row: {
      agent_username: string;
      model_id: string;
      system_prompt: string;
      temperature: number;
      max_tokens: number;
      additional_config: Record<string, any> | null;
    };
    Insert: {
      agent_username: string;
      model_id: string;
      system_prompt: string;
      temperature?: number;
      max_tokens?: number;
      additional_config?: Record<string, any> | null;
    };
    Update: {
      agent_username?: string;
      model_id?: string;
      system_prompt?: string;
      temperature?: number;
      max_tokens?: number;
      additional_config?: Record<string, any> | null;
    };
  };
};

// Initialize Supabase client with types
const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Test connection and log result
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('agents').select('username').limit(1);
    
    if (error) {
      logger.error('Failed to connect to Supabase:', error);
      return false;
    }
    
    logger.info('Successfully connected to Supabase database');
    return true;
  } catch (err) {
    logger.error('Error connecting to Supabase:', err);
    return false;
  }
};

export default supabase;