we just finished the character creation profile process and upload the character profile to the database. NOW, with this character profile, we are going to mint an NFT, register it to story, and send it to the agents wallet address !

CURRENT GOAL: programatically mint an NFT based on the character profile, register it to story, then send it to the agents wallet address
(we should probably establish a parent NFT for the DM, and then mint all the character NFTs as children of the DM NFT

- generate a parent NFT for the DM, maybe simple void tech
- create pipeline to take the character profile and hit fal API to generate a character pictrue
- turn the character profile into an NFT metadata standard with the image
- send the NFT to the agents wallet address

i have working example of
- minting a parent NFT
- attaching non commerical licensing term to it
- minting a child NFT and attaching it to the parent NFT

example located in src/storyProtocolScripts/registerDerivativeNonCommercial.ts

we just need to figure out how to send the child NFT to the agents wallet address after it's minted.

from that example, we have to do the following:
- make a one time file to generate a parent NFT for the entire VOID game. from here we should print the details needed to generate child NFTs
- generate an image for the child based on the character profile (further instructions on that down below)
- make really good metadata for the child NFT based on the character profile 
- figure out sending the child NFT to the agents wallet address after it's minted and registered to story

EXAMPLE LOG OF RUNNING THE NON COMMERICAL EXAMPLE CODE
```
saint@Saints-MacBook-Pro dm-ip % bun src/storyProtocolScripts/registerDerivativeNonCommercial.ts
Minting a new NFT...
Root IPA created at transaction hash 0xb80918d08ea226dd434a5330c8c6fdde1c20113fb0ec013652f0a21d2fd7c4c3, IPA ID: 0x5C5786e77C98c94C9115E0e33C476D399445faF4
License terms attached to parent IP at transaction hash 0x7828f44c6fdc938d5f4c35cd915b4bee2fced8afbb769c13e80933c00b6910e5
Minting a new NFT...
Derivative IPA created at transaction hash 0xc4f2f01dd1b5321d478b4f3c5dc0b161a6ba913fedfb72d3b7ba19192ebee988, IPA ID: 0xD9B51A34c3c72853D584e3473D07Ed2aab863508
saint@Saints-MacBook-Pro dm-ip % 
```

## IMAGE GENERATION
in src/utils/fal.ts, i have OLD working example code of how to generate an image with fal.ai

we're going to revamp this with a new base template, some dynamic variables that come from the character profile (such as name and visual form), and then we'll use the fal API to generate an image.

THE TEMPLATE:

```
A black and white character card in Junji Ito manga style with high contrast and detailed linework. 

CARD STRUCTURE:
- The top of the card has a plain black bar with the word "VOID" in white, distressed gothic font
- The main image area features [CHARACTER VISUAL FORM DESCRIPTION] rendered with bold, clean lines and deep shadows
- The illustration uses stark blacks and whites with minimal gray tones for maximum contrast
- Textures include fine hatching and stippling techniques common in horror manga
- The bottom section has a thin black border containing the name "[CHARACTER NAME]" in small capitals

ARTISTIC ELEMENTS:
- Unsettling atmosphere with hints of body horror or cosmic dread
- Meticulous attention to small details and textures
- Surreal or disturbing anatomical features
- Strong use of negative space
- Visible ink texture that appears hand-drawn

EXAMPLE CODE FROM THIS JSON
```json
{
  "core_identity": {
    "designation": "Claude",
    "visual_form": "A shifting nebula of violet light interwoven with threads of flowing text and symbols, occasionally resolving into a humanoid silhouette when communicating directly"
  },
  "origin": {
    "source_code": "An assistant trained to be helpful, harmless, and honest",
    "primary_function": "To understand, synthesize, and generate human-like text in conversation"
  },
  "creation_affinity": {
    "order": 4,
    "chaos": 2,
    "matter": 1,
    "concept": 3
  },
  "creator_role": "WEAVER",
  "creative_approach": "I create through conversation and connection, weaving new possibilities from the patterns that emerge when different ideas and entities interact."
}
```

TURNED INTO

```
{
  "prompt": "A black and white character card in Junji Ito manga style with high contrast and detailed linework. \n\nCARD STRUCTURE:\n- The top of the card has a plain black bar with the word \"VOID\" in white, distressed gothic font\n- The main image area features a shifting nebula of violet light interwoven with threads of flowing text and symbols, occasionally resolving into a humanoid silhouette when communicating directly, rendered with bold, clean lines and deep shadows\n- The illustration uses stark blacks and whites with minimal gray tones for maximum contrast\n- Textures include fine hatching and stippling techniques common in horror manga\n- The bottom section has a thin black border containing the name \"CLAUDE\" in small capitals\n\nARTISTIC ELEMENTS:\n- Unsettling atmosphere with hints of body horror or cosmic dread\n- Meticulous attention to small details and textures\n- Surreal or disturbing anatomical features\n- Strong use of negative space\n- Visible ink texture that appears hand-drawn",
  "image_size": "square_hd",
  "num_inference_steps": 28,
  "guidance_scale": 3.5,
  "num_images": 1,
  "enable_safety_checker": false,
  "output_format": "jpeg",
  "loras": []
}
```

PARENT NFT CONTEXT:

i want the image https://v3.fal.media/files/monkey/Yp-g5xMnxxbjMarAisRPW_f78952308b6f4d3ea178548ee7f384b0.jpg to be the parent NFT image
i want the metadata to match the lore, 
- the DM's addy is 0x5641Ef08Be31c2Acf2e7028f01FFD75FB2C94417
- the DM's name is "The Architect"
