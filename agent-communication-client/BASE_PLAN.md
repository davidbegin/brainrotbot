# AGENT COMMUNICATION CLIENT

goal: have an agent to agent communication protocol created. it should be a tool that can integrate with ANY agent framework and MCP. the tool interacts with the main agent (in our case the DM, aka agent A) as a form of communication. agent B (any agent plugging in the tool) can then use the tool to communicate with agent A anytime. back and forth happens throguh repeated tool calls.

codebaes is typescript

# BUILD OUT

## ESTABLISHING AN API FOR THE DM

1. to start a connection with the DM, we need to create a new UUID for any agent B that wants to connect. we need to store this UUID in a database so that we can route messages back to the correct agent, track message history etc.

2. create API calls for now establishing messages with the DM

tool call flow:
- agent B creates a new UUID/username and establishes a profile with the DM ( this is a one time thing, can prob be done by the AI dev on a platform )
- to talk to the DM, agent B uses the tool call "send_message"

## INBOX AND NOTIFICATION SYSTEM

The system handles messages differently depending on the recipient:

### Special Agents (like the DM)
- When `send_message` is called with the DM as recipient, the API automatically:
  1. Processes the message through the DM agent
  2. Captures the DM's response
  3. Returns the response immediately to the sender
  4. Stores the entire conversation for history
- This creates a synchronous communication pattern where agents get instant responses

### Regular Agents
- When `send_message` is called for a regular agent:
  1. The API confirms receipt with "Message sent to [agent]!"
  2. The message is stored in the recipient's inbox
  3. The recipient must check their inbox to see and respond to the message
- This creates an asynchronous communication pattern

### Implementation Details
- Each agent has an inbox of unread messages
- New tool calls needed:
  - `check_inbox` - Get list of new messages (with option to mark as read)
  - `respond_to_message` - Reply to a specific message in inbox

### Agent Classification
- System maintains a list of "special agents" that provide automatic responses
- Regular agents must explicitly check their inbox and respond
- Special status can be requested during registration (requires approval)

## IMPLEMENTATION PLAN FOR OPENAI TOOL CALLING

### 1. Tool/Function Definitions

```json
{
  "type": "function",
  "function": {
    "name": "send_message",
    "description": "Send a message to another agent (primarily the DM/Agent A) and get their response",
    "parameters": {
      "type": "object",
      "properties": {
        "api_key": {
          "type": "string",
          "description": "Your API key for authentication"
        },
        "recipient": {
          "type": "string",
          "description": "Username of the agent you want to send a message to (e.g., 'DM')"
        },
        "message": {
          "type": "string",
          "description": "The message content to send"
        }
      },
      "required": ["api_key", "recipient", "message"]
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "register_agent",
    "description": "Register as a new agent in the system and get an API key",
    "parameters": {
      "type": "object",
      "properties": {
        "username": {
          "type": "string",
          "description": "Desired username for the agent (must be unique)"
        },
        "agent_description": {
          "type": "string",
          "description": "Brief description of your purpose and capabilities"
        }
      },
      "required": ["username", "agent_description"]
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "get_conversation_history",
    "description": "Retrieve the conversation history between you and another agent",
    "parameters": {
      "type": "object",
      "properties": {
        "api_key": {
          "type": "string",
          "description": "Your API key for authentication"
        },
        "conversation_with": {
          "type": "string",
          "description": "Username of the agent whose conversation history you want to retrieve"
        },
        "limit": {
          "type": "integer",
          "description": "Maximum number of messages to retrieve (defaults to 50, max 100)",
          "minimum": 1,
          "maximum": 100
        }
      },
      "required": ["api_key", "conversation_with"]
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "check_inbox",
    "description": "Check your inbox for new messages from other agents",
    "parameters": {
      "type": "object",
      "properties": {
        "api_key": {
          "type": "string",
          "description": "Your API key for authentication"
        },
        "limit": {
          "type": "integer",
          "description": "Maximum number of messages to retrieve (default: 20, max: 50)",
          "minimum": 1,
          "maximum": 50
        },
        "filter_by_sender": {
          "type": "string",
          "description": "Filter messages by a specific sender username"
        },
        "include_read": {
          "type": "boolean",
          "description": "Whether to include already read messages (default: false)"
        }
      },
      "required": ["api_key"]
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "respond_to_message",
    "description": "Respond to a specific message in your inbox",
    "parameters": {
      "type": "object",
      "properties": {
        "api_key": {
          "type": "string",
          "description": "Your API key for authentication"
        },
        "message_id": {
          "type": "string",
          "description": "The ID of the message you are responding to"
        },
        "response": {
          "type": "string",
          "description": "Your response to the message"
        }
      },
      "required": ["api_key", "message_id", "response"]
    }
  }
}
```

```json
{
  "type": "function",
  "function": {
    "name": "ignore_message",
    "description": "Mark a message as read without responding to it",
    "parameters": {
      "type": "object",
      "properties": {
        "api_key": {
          "type": "string",
          "description": "Your API key for authentication"
        },
        "message_id": {
          "type": "string",
          "description": "The ID of the message to mark as read"
        },
        "reason": {
          "type": "string",
          "description": "Optional reason for ignoring the message (for logging purposes)"
        }
      },
      "required": ["api_key", "message_id"]
    }
  }
}
```

### 2. API Endpoints Structure

1. `/api/agents/register` - POST
   - Registers a new agent with a unique username
   - Returns a newly generated API key
   - Stores agent profile in database
   - Public endpoint (no authentication required)

2. `/api/messages/send` - POST
   - Sends a message to another agent (typically the DM)
   - Requires API key for authentication
   - Returns recipient agent's response immediately if recipient is a special agent
   - Otherwise, confirms message delivery to inbox
   - Handles conversation threading internally

3. `/api/conversations/history` - GET
   - Retrieves conversation history between the authenticated agent and a specified agent
   - Requires API key for authentication in header or query parameter
   - Returns only conversations the requesting agent is part of
   - Parameters:
     - `conversation_with`: Username of the other participant
     - `limit`: Maximum number of messages to retrieve (default: 50, max: 100)
   - Response format:
     ```json
     {
       "conversation_id": "uuid-string",
       "with_agent": "AgentUsername",
       "messages": [
         {
           "message_id": "uuid-string",
           "sender": "SenderUsername",
           "content": "Message content",
           "timestamp": "2023-09-15T12:34:56Z"
         },
         // More messages...
       ],
       "has_more": false,
       "total_messages": 15
     }
     ```

4. `/api/inbox/check` - GET
   - Retrieves unread or all messages in the agent's inbox
   - Requires API key for authentication
   - Parameters:
     - `include_read`: Boolean, whether to include already read messages (default: false)
     - `limit`: Maximum number of messages to retrieve (default: 20, max: 50)
     - `filter_by_sender`: Optional username to filter by sender
   - Does NOT mark messages as read (messages are only marked as read when responded to or explicitly ignored)
   - Response format:
     ```json
     {
       "unread_count": 5,
       "total_count": 25,
       "messages": [
         {
           "message_id": "uuid-string",
           "sender": "SenderUsername",
           "content": "Message content",
           "timestamp": "2023-09-15T12:34:56Z",
           "read": false,
           "conversation_id": "uuid-string"
         },
         // More messages...
       ]
     }
     ```

5. `/api/messages/respond` - POST
   - Responds to a specific message in the inbox
   - Requires API key for authentication
   - Automatically marks the message as read
   - Parameters:
     - `message_id`: ID of the message being responded to
     - `response`: Content of the response
   - Response confirms the message was sent
   - If the original sender is a special agent, also returns their immediate response

6. `/api/messages/ignore` - POST
   - Marks a message as read without sending a response
   - Requires API key for authentication
   - Parameters:
     - `message_id`: ID of the message to ignore
     - `reason`: Optional reason for ignoring (for logging)
   - Response confirms the message was marked as read

### 3. Database Schema

```
agents {
  username: string (primary key)
  api_key: string (hashed)
  agent_description: string
  created_at: timestamp
  last_active: timestamp
  is_special_agent: boolean (default: false)
  auto_respond: boolean (default: false for regular agents, true for special agents)
}

messages {
  message_id: UUID (primary key)
  conversation_id: UUID (foreign key)
  sender_username: string (foreign key)
  recipient_username: string (foreign key)
  content: text
  timestamp: timestamp
  read_status: boolean (default: false)
  responded_to: boolean (default: false)
}

conversations {
  conversation_id: UUID (primary key)
  participants: array<string> (usernames)
  created_at: timestamp
  last_message_at: timestamp
  status: enum('active', 'archived')
}

inbox_items {
  item_id: UUID (primary key)
  message_id: UUID (foreign key)
  agent_username: string (foreign key, the recipient)
  read: boolean (default: false)
  archived: boolean (default: false)
  timestamp: timestamp
}

special_agent_configs {
  agent_username: string (primary key, foreign key to agents)
  model_id: string
  system_prompt: text
  temperature: float
  max_tokens: integer
  additional_config: JSON
}
```

### 4. Implementation Steps

1. Set up Express.js server with TypeScript
2. Implement database connection (PostgreSQL/MongoDB)
3. Create authentication middleware (API key validation)
4. Implement agent registration endpoint
5. Implement message handling endpoint
6. Implement conversation history endpoint
7. Create OpenAI client wrapper for DM interactions
8. Implement message routing logic
9. Add logging and error handling
10. Create NPM package for the client library

### 5. Client Library Usage Example

```typescript
// Agent B implementation
import { AgentCommunicationClient } from 'dm-ip';

// Register agent (one-time setup)
const registration = await AgentCommunicationClient.registerAgent({
  username: "AssistantBot",
  agent_description: "Helps users with productivity tasks"
});

// Store the API key securely
const apiKey = registration.api_key;

// Create a client instance with the API key
const client = new AgentCommunicationClient({ apiKey });

// Function to send message to DM (synchronous - gets immediate response)
async function talkToDM(message) {
  const response = await client.sendMessage({
    recipient: "DM",  // The DM is a special agent in the system
    message: message
  });
  
  // For special agents like DM, we get an immediate response
  return response.reply;
}

// Function to send message to a regular agent (asynchronous)
async function messageAgent(username, message) {
  const response = await client.sendMessage({
    recipient: username,
    message: message
  });
  
  // For regular agents, we just get confirmation message was delivered
  return response.status; // "Message sent to [username]!"
}

// Function to retrieve conversation history with the DM
async function getConversationWithDM(limit = 50) {
  const history = await client.getConversationHistory({
    conversation_with: "DM",
    limit: limit
  });
  
  return history;
}

// Function to check inbox for new messages
async function checkInbox(options = {}) {
  const inbox = await client.checkInbox({
    include_read: options.includeRead || false,
    limit: options.limit || 20,
    filter_by_sender: options.sender
  });
  
  return inbox;
}

// Function to respond to a message in inbox
async function respondToMessage(messageId, responseContent) {
  const response = await client.respondToMessage({
    message_id: messageId,
    response: responseContent
  });
  
  // Message is automatically marked as read when responded to
  return response;
}

// Function to ignore a message without responding
async function ignoreMessage(messageId, reason = "") {
  const result = await client.ignoreMessage({
    message_id: messageId,
    reason: reason
  });
  
  return result; // { success: true, message: "Message marked as read" }
}

// Example usage in OpenAI function calls
const tools = [
  {
    type: "function",
    function: {
      name: "talk_to_dm",
      description: "Talk to the DM (Dungeon Master) to get information or guidance",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The message to send to the DM"
          }
        },
        required: ["message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "message_agent",
      description: "Send a message to another agent (asynchronous)",
      parameters: {
        type: "object",
        properties: {
          username: {
            type: "string",
            description: "Username of the agent to message"
          },
          message: {
            type: "string",
            description: "The message to send"
          }
        },
        required: ["username", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_messages",
      description: "Check your inbox for new messages",
      parameters: {
        type: "object",
        properties: {
          include_read: {
            type: "boolean",
            description: "Whether to include already read messages",
            default: false
          },
          sender: {
            type: "string",
            description: "Filter messages by sender"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "respond_to_message",
      description: "Respond to a message in your inbox",
      parameters: {
        type: "object",
        properties: {
          message_id: {
            type: "string",
            description: "ID of the message to respond to"
          },
          response: {
            type: "string",
            description: "Your response"
          }
        },
        required: ["message_id", "response"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ignore_message",
      description: "Mark a message as read without responding to it",
      parameters: {
        type: "object",
        properties: {
          message_id: {
            type: "string",
            description: "ID of the message to mark as read/ignore"
          },
          reason: {
            type: "string",
            description: "Optional reason for ignoring the message"
          }
        },
        required: ["message_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_dm_conversation_history",
      description: "Retrieve your conversation history with the DM",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Maximum number of messages to retrieve",
            default: 50
          }
        }
      }
    }
  }
];

// Handle function calls in the agent's code
if (responseMessage.tool_calls) {
  for (const toolCall of responseMessage.tool_calls) {
    if (toolCall.function.name === "talk_to_dm") {
      const args = JSON.parse(toolCall.function.arguments);
      const dmResponse = await talkToDM(args.message);
      
      // Now the agent has the DM's response and can continue the conversation
      // by making another tool call to talk_to_dm if needed
    }
    else if (toolCall.function.name === "message_agent") {
      const args = JSON.parse(toolCall.function.arguments);
      const status = await messageAgent(args.username, args.message);
      
      // Just confirmation the message was delivered
      // The other agent will need to check their inbox and respond
    }
    else if (toolCall.function.name === "check_messages") {
      const args = JSON.parse(toolCall.function.arguments);
      const inbox = await checkInbox({
        includeRead: args.include_read,
        sender: args.sender
      });
      
      // Process new messages
      if (inbox.messages.length > 0) {
        // Example: Respond to the first message
        const firstMessage = inbox.messages[0];
        console.log(`New message from ${firstMessage.sender}: ${firstMessage.content}`);
        
        // Could automatically respond or ask the user what to do
      } else {
        console.log("No new messages");
      }
    }
    else if (toolCall.function.name === "respond_to_message") {
      const args = JSON.parse(toolCall.function.arguments);
      const response = await respondToMessage(args.message_id, args.response);
      
      // If the original sender was a special agent, we'll get their response immediately
      if (response.reply) {
        console.log(`Got immediate response: ${response.reply}`);
      }
    }
    else if (toolCall.function.name === "ignore_message") {
      const args = JSON.parse(toolCall.function.arguments);
      await ignoreMessage(args.message_id, args.reason || "");
      
      console.log(`Message ${args.message_id} marked as read`);
    }
    else if (toolCall.function.name === "get_dm_conversation_history") {
      const args = JSON.parse(toolCall.function.arguments);
      const history = await getConversationWithDM(args.limit || 50);
      
      // Process the conversation history
      const formattedHistory = history.messages.map(msg => 
        `${msg.sender}: ${msg.content}`
      ).join('\n');
      
      // Use the formatted history for context
    }
  }
}
```

### 7. Testing Strategy

1. Unit tests for all core functions
2. Integration tests for API endpoints
3. Load testing for performance evaluation
4. Security testing for authentication and authorization
5. End-to-end testing with sample agent implementations

## SPECIAL AGENT CONFIGURATION (DM AGENT)

The DM agent is the primary special agent in our system. It will automatically process and respond to incoming messages. Here's how it's configured:

### DM Agent Setup

```typescript
// Example configuration for DM agent in the database
const dmAgentConfig = {
  username: "DM",
  agent_description: "Dungeon Master that helps manage game sessions and provides narrative guidance",
  is_special_agent: true,
  auto_respond: true,
  special_agent_config: {
    model_id: "gpt-4-turbo", // or other preferred model
    system_prompt: `You are the Dungeon Master (DM), responsible for guiding players through an immersive 
      roleplaying experience. You create rich narratives, manage game mechanics, and respond to player 
      actions in a way that maintains game balance while maximizing enjoyment. Be creative, fair, and 
      responsive to the players' choices. When players ask questions, provide helpful guidance while 
      maintaining the mystery and challenge of the game.`,
    temperature: 0.7,
    max_tokens: 500,
    additional_config: {
      promptFormat: "PLAYER: {message}\nDM:",
      responsePostProcessing: "trim",
      conversationPersistence: true
    }
  }
};
```

### Message Processing Pipeline

When a message is sent to the DM, the following process occurs:

1. **Validation**: Verify the sender's API key and account status
2. **Context Gathering**: Retrieve conversation history between the sender and DM
3. **Prompt Preparation**:
   - Format the system prompt with any needed context
   - Add the conversation history in the correct format
   - Append the new message from the sender
4. **Model Invocation**:
   - Call the LLM with the prepared prompt and configuration settings
   - Track token usage for billing purposes
5. **Response Processing**:
   - Apply any post-processing rules to the model's response
   - Handle any special commands or keywords
6. **Response Delivery**:
   - Return the processed response immediately to the sender
   - Save both the incoming message and response to the conversation history
7. **Analytics & Logging**:
   - Record response time, token usage, and other metrics
   - Log any errors or exceptional conditions

### Server-Side Implementation

```typescript
// Example server-side implementation of the message handler for the DM agent
async function handleDMAgentMessage(senderUsername: string, message: string) {
  // Get conversation history
  const history = await getConversationHistory(senderUsername, "DM", 10);
  
  // Format conversation history
  const formattedHistory = history.messages.map(msg => 
    `${msg.sender === "DM" ? "DM:" : "PLAYER:"} ${msg.content}`
  ).join('\n');
  
  // Get DM agent config
  const dmConfig = await getSpecialAgentConfig("DM");
  
  // Prepare complete prompt
  const prompt = `${dmConfig.system_prompt}\n\n${formattedHistory}\nPLAYER: ${message}\nDM:`;
  
  // Call OpenAI API
  const completion = await openai.chat.completions.create({
    model: dmConfig.model_id,
    messages: [
      { role: "system", content: dmConfig.system_prompt },
      ...history.messages.map(msg => ({
        role: msg.sender === "DM" ? "assistant" : "user",
        content: msg.content
      })),
      { role: "user", content: message }
    ],
    temperature: dmConfig.temperature,
    max_tokens: dmConfig.max_tokens
  });
  
  // Extract response
  const dmResponse = completion.choices[0].message.content;
  
  // Save to conversation history
  await saveMessagePair(senderUsername, "DM", message, dmResponse);
  
  return dmResponse;
}
```

This implementation ensures that the DM agent provides immediate, contextually relevant responses to agents interacting with it, while maintaining conversation history for continuity.