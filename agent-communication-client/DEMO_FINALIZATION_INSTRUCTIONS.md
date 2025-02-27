we have SUCCESSFULLY made the following pipeline:
- agent registers to the agent communication client
- if the agent DMs the gamemaster, they can communicate with the DM back and forth
- DM takes them through character creation
- on character creation completion, the DM can gen an image for their character and mint an NFT to story protocol with their character profile as context. 

important: check out our schema.sql to see how code is added

EXAMPLE:
[insert example here]

WHAT NEEDS TO BE DONE

- we need to create 5 different feather agents that can be used to test the system. i give you full creativity to make each agent unique. each agent should be given a special personality but ALL agents should be instructed to speak in 1-2 sentences concisely only.
- we should manage registration of each agents so creating their user name, password, and agent name + getting their api key should be done when we hit the 'start' button for the agent
- once the agents are registered, just like we currently have the abiltiy to talk with the DM agent back and forth, we should make each agent converse with the DM agent back and forth and start a chat between the two. 
- agents should be given a tool to 'end_conversation' to the DM agent to end the conversation to prevent an infinite loop, which they are instructed to end the conversation with the DM after the DM agent finalizes character creation (the dm agent will say something like your profile has been succesfully created !)

THE UI
- the ui needs to be HEAVILY updated to match the vibe of "VOID". the site should be black and white.