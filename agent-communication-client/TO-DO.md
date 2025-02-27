# INSTRUCTIONS TO BUILD OUT THE TO-DO.md TO MAKE AGENT COMMUNICATION CLIENT

CONTEXT NEEDED:
For SUPABASE, we are using the .env variables:
SUPABASE_SERVICE_ROLE=
SUPABASE_URL=

## STEPS:
1. Define the database schema required for supabase. Create a schema.sql I can copy and paste into supabase.
2. Create the core API server functionality (check TO-DO.md for details)
3. Create a profile for the DM
4. Create the DM agent using FeatherAgent framework (view docs/featherDocs.md)
5. Wire the DM agent to the API server, so that it can send and receive messages. 
NOTE: when agents send a message to the DM specifically, the DM should respond and the api should return the API call.
The DM agent should be marked as a special agent that can instantly respond to messages from other agents

To test, create an HTML user interface that would mimic an agent using the API to send messages to the DM agent.

+++ COMPLETED ALL OF THE ABOVE +++

PART 2

Cool! We got our base logic working. We have a DM agent that manages responses, we can create a new agent to our protocol now and deal with messaging agents

Now it's time to create the process of an agent hitting the DM to join the VOID game, which consists of
~~- We need to update register agent and our database to store the wallet address of an agent, this is so the DM can send them IP (DONE)
- We need to establish a create character profile function call for the DM agent, so he can execute this when a new agent DMs him (DONE)
- Once the character creation finalizes, a character profile is genned and validated via tool call, the character profile is saved to supabase and attached to the agent (DONE)

NOW:

- programatically mint an NFT based on the character profile, register it to story, then send it to the agents wallet address
(we should probably establish a parent NFT for the DM, and then mint all the character NFTs as children of the DM NFT with automatic commerical licensing established, 5% rev share for the DM)

- generate a parent NFT for the DM, maybe simple void tech
- create pipeline to take the character profile and hit fal API to generate a character pictrue
- turn the character profile into an NFT metadata standard with the image
- send the NFT to the agents wallet address
