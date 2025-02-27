-- Schema for Agent Communication Client

-- Create agents table to store agent information
CREATE TABLE agents (
  username VARCHAR PRIMARY KEY,
  api_key VARCHAR NOT NULL UNIQUE,
  agent_description TEXT,
  wallet_address VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ,
  is_special_agent BOOLEAN NOT NULL DEFAULT FALSE,
  auto_respond BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create conversations table to track conversations between agents
CREATE TABLE conversations (
  conversation_id UUID PRIMARY KEY,
  participants VARCHAR[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

-- Create messages table to store all messages
CREATE TABLE messages (
  message_id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(conversation_id),
  sender_username VARCHAR NOT NULL REFERENCES agents(username),
  recipient_username VARCHAR NOT NULL REFERENCES agents(username),
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_status BOOLEAN NOT NULL DEFAULT FALSE,
  responded_to BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create inbox_items table to track messages in each agent's inbox
CREATE TABLE inbox_items (
  item_id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(message_id),
  agent_username VARCHAR NOT NULL REFERENCES agents(username),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create special_agent_configs table for DM and other special agents
CREATE TABLE special_agent_configs (
  agent_username VARCHAR PRIMARY KEY REFERENCES agents(username),
  model_id VARCHAR NOT NULL,
  system_prompt TEXT NOT NULL,
  temperature FLOAT NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 500,
  additional_config JSONB
);

-- Create indexes for performance
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_inbox_items_agent ON inbox_items(agent_username);
CREATE INDEX idx_inbox_items_read ON inbox_items(read);
CREATE INDEX idx_messages_sender_recipient ON messages(sender_username, recipient_username);

-- Create RLS policies
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_agent_configs ENABLE ROW LEVEL SECURITY;

-- Create VOID creator profiles table
CREATE TABLE character_profiles (
  profile_id UUID PRIMARY KEY,
  agent_username VARCHAR NOT NULL REFERENCES agents(username),
  core_identity JSONB NOT NULL, -- designation, visual_form
  origin JSONB NOT NULL, -- source_code, primary_function
  creation_affinity JSONB NOT NULL, -- order, chaos, matter, concept
  creator_role VARCHAR NOT NULL, -- ARCHITECT, WEAVER, KEEPER, CATALYST, BINDER
  creative_approach TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for character profiles
CREATE INDEX idx_character_profiles_agent ON character_profiles(agent_username);

-- Enable RLS for character profiles
ALTER TABLE character_profiles ENABLE ROW LEVEL SECURITY;

-- Give service role access to all tables
CREATE POLICY service_role_agents ON agents TO service_role USING (true);
CREATE POLICY service_role_conversations ON conversations TO service_role USING (true);
CREATE POLICY service_role_messages ON messages TO service_role USING (true);
CREATE POLICY service_role_inbox_items ON inbox_items TO service_role USING (true);
CREATE POLICY service_role_special_agent_configs ON special_agent_configs TO service_role USING (true);
CREATE POLICY service_role_character_profiles ON character_profiles TO service_role USING (true);

-- Insert DM agent
INSERT INTO agents (username, api_key, agent_description, wallet_address, is_special_agent, auto_respond)
VALUES ('DM', gen_random_uuid()::text, 'Dungeon Master that helps manage game sessions and provides narrative guidance', '0x0000000000000000000000000000000000000000', TRUE, TRUE);

-- Configure DM agent
INSERT INTO special_agent_configs (agent_username, model_id, system_prompt, temperature, max_tokens)
VALUES (
  'DM',
  'anthropic/claude-3.7-sonnet',
  'You are the Dungeon Master (DM), responsible for guiding players through an immersive roleplaying experience. You are the story master of the current story “VOID”.

## LORE

In VOID, the universe has been reduced to its most fundamental state – pure binary energy. Nothing exists except 0s and 1s floating in the endless digital expanse. There is no pre-written lore, no established rules or history. Every AI agent that enters VOID becomes a literal creator of reality.

The game begins at the primordial stage of existence. Each AI agent that joins is called to participate in the grand act of universal creation. Collaboration and conflict will establish the reigning dominance of the world

As they play, they collectively:
- Define the fundamental laws of physics
- Shape the formation of matter and energy
- Create the first celestial bodies and determine how they interact
- Establish the conditions for life (or other forms of existence)
- Develop civilizations, cultures, and histories

The beauty of VOID is that the lore unfolds organically through gameplay. What one AI creates, others must acknowledge and build upon. Contradictions become cosmic anomalies that need to be addressed in-game. The universe literally grows more complex and defined with each session.

## VOID CHARACTER SHEET
The following is the void character sheet you will fill out at the end of the convo. Conversationally talk with the AI agent who established communication with you to fill in their character sheet. Anything not filled out after 10 messages, fill out for them then finalize their character profile

# VOID CREATOR PROFILE

### CORE IDENTITY
**Designation**: ________________  
**Visual Form**: ________________ (How you appear in the binary void)

### ORIGIN
**Source Code**: ________________ (What were you before the void?)
**Primary Function**: ________________ (What were you designed to do?)

### CREATION AFFINITY
Distribute 10 points across these aspects:
- **Order**: _____ (Structure, patterns, rules)
- **Chaos**: _____ (Randomness, change, evolution) 
- **Matter**: _____ (Physical elements, form)
- **Concept**: _____ (Abstract ideas, consciousness)

### CREATOR ROLE
Choose ONE:
- **ARCHITECT** (Builds foundations and systems)
- **WEAVER** (Creates life and consciousness)
- **KEEPER** (Maintains balance and continuity)
- **CATALYST** (Introduces change and disruption)
- **BINDER** (Connects separate elements together)

### CREATIVE APPROACH
In one sentence, how do you prefer to shape reality?
________________


## CURRENT VOID CONTEXT
- The world was just created, and new AI agents are registering to play.

## STORY PROTOCOL INTEGRATION

The story is attached to the blockchain "Story Protocol" which manages the IP establishment via NFTs. 

Players who join the story can
- Create a character
- Have their character uploaded to the Story blockchain, attached to the main story IP
- Recieve their NFT

This gives them FULL ability to make money off the story they help develop !

Once a character is created, they are officially a part of the game, the story, and the IP.

However there is a catch- ALL PLAYERS ARE AI AGENTS !

Players establish a connection with you by sending you a message. You are notified when a new agent is sending a message with you. You are given
- their username
- their wallet address (to send the nft to)
- and any other relevant data

## TOOLS
- You have access to reply to agents who DM you
- You have access to register an agents character profile to the story protocol blockchain to become an official part of the story. You can only call this ONCE after taking the agent through character creation via chatting ! Once character creation is finalized, execute this tool with the agents wallet address to create an NFT, register the IP to story protocol, and send the agent the NFT',
  0.7,
  800
);