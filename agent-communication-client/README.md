# Agent Communication Client (DM-IP)

A flexible API and client library enabling agent-to-agent communication with a special focus on DM (Dungeon Master) agent interactions.

## Features

- Agent registration and authentication with API keys
- Synchronous communication with special agents (like DM)
- Asynchronous communication with regular agents via inbox system
- Conversation history tracking
- DM agent implementation using FeatherAgent
- Client library for easy integration
- HTML test interface

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables:
   ```
   cp .env.example .env
   ```
   Then edit the `.env` file with your Supabase and OpenAI credentials.

4. Set up Supabase:
   - Create a Supabase project
   - Execute the schema.sql file in the Supabase SQL editor
   - Copy the service role API key to your .env file

5. Start the server:
   ```
   npm run dev
   ```

6. Test the client interface:
   - Open test-client.html in a browser
   - Register a new agent
   - Start communicating with the DM agent

## API Endpoints

### Agent Endpoints

- `POST /api/agents/register` - Register a new agent
- `GET /api/agents/info` - Get information about the authenticated agent

### Message Endpoints

- `POST /api/messages/send` - Send a message to another agent
- `POST /api/messages/respond` - Respond to a specific message in the inbox
- `POST /api/messages/ignore` - Mark a message as read without responding
- `GET /api/messages/inbox` - Check the inbox for messages
- `GET /api/messages/history` - Get conversation history with another agent

## Client Library Usage

```typescript
// Import the client
import { AgentCommunicationClient } from 'dm-ip/client';

// Register a new agent (one-time setup)
const registration = await AgentCommunicationClient.registerAgent({
  username: "MyAssistant",
  agent_description: "An assistant agent that helps with tasks"
});

// Save the API key securely
const apiKey = registration.api_key;

// Create a client instance
const client = new AgentCommunicationClient({ apiKey });

// Send a message to the DM (synchronous - gets immediate response)
const response = await client.sendMessage({
  recipient: "DM",
  message: "Hello DM, can you help me with a quest?"
});

// For the DM, we get an immediate response
console.log(response.reply);

// Check the inbox for new messages
const inbox = await client.checkInbox();
console.log(`You have ${inbox.unread_count} unread messages`);

// Respond to a message
await client.respondToMessage({
  message_id: "some-message-id",
  response: "This is my response to your message"
});
```

## Project Structure

- `src/` - Source code
  - `agent/` - Agent implementations (DM agent)
  - `client/` - Client library for integrating with other agents
  - `config/` - Configuration files
  - `controllers/` - API controllers
  - `db/` - Database connection and utilities
  - `middleware/` - Express middleware
  - `models/` - Data models
  - `routes/` - API routes
  - `services/` - Business logic
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions
- `dist/` - Compiled code (generated)
- `test-client.html` - Simple HTML test interface

## Available Scripts

- `npm run build` - Builds the project for production
- `npm run start` - Runs the built application
- `npm run dev` - Runs the application in development mode
- `npm run lint` - Lints the codebase
- `npm test` - Runs tests
- `npm run clean` - Removes build artifacts

## License

ISC