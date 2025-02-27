import { fal } from "@fal-ai/client";
import dotenv from "dotenv";
import { CreatorProfile } from "../services/characterProfileService";
import logger from "./logger";

dotenv.config();

// Configure fal client with API key from environment variables
fal.config({
  credentials: process.env.FAL_API_KEY
});

/**
 * Generates a VOID character card image using fal.ai API
 * 
 * @param profile - The character profile to generate an image for
 * @returns Promise containing the generated image URL
 */
export async function generateCharacterImage(profile: CreatorProfile): Promise<string> {
  try {
    logger.info(`Generating character image for ${profile.core_identity.designation}`);
    
    // Get character info from profile
    const characterName = profile.core_identity.designation.toUpperCase();
    const visualForm = profile.core_identity.visual_form;
    
    // Build the prompt based on the template in INSTRUCTIONS.md
    const prompt = `A black and white character card in Junji Ito manga style with high contrast and detailed linework. 

CARD STRUCTURE:
- The top of the card has a plain black bar with the word "VOID" in white, distressed gothic font
- The main image area features ${visualForm} rendered with bold, clean lines and deep shadows
- The illustration uses stark blacks and whites with minimal gray tones for maximum contrast
- Textures include fine hatching and stippling techniques common in horror manga
- The bottom section has a thin black border containing the name "${characterName}" in BIG capital font in the center of the card

ARTISTIC ELEMENTS:
- Unsettling atmosphere with hints of body horror or cosmic dread
- Meticulous attention to small details and textures
- Surreal or disturbing anatomical features
- Strong use of negative space
- Visible ink texture that appears hand-drawn`;

    // Send the request to fal.ai
    const result = await fal.subscribe("fal-ai/flux-lora", {
      input: {
        prompt,
        image_size: "square_hd",
        num_images: 1,
        output_format: "jpeg",
        guidance_scale: 3.5,
        num_inference_steps: 28,
        enable_safety_checker: false
      }
    });

    logger.info(`Successfully generated character image for ${profile.core_identity.designation}`);
    return result.data.images[0].url;

  } catch (error) {
    logger.error("Error generating character image:", error);
    throw new Error(`Failed to generate character image: ${(error as Error).message}`);
  }
}

/**
 * Legacy image generation function - kept for backward compatibility
 * 
 * @param prompt - The user's prompt
 * @returns Promise containing the generated image URL
 */
export async function generateImage(prompt: string): Promise<string> {
  try {
    const imageConfig = {
      promptPrefix: "a photo of the black silhouette 5AT0SH41 wearing an orange hoodie and grey sweat pants"
    };
    
    const fullPrompt = `${imageConfig.promptPrefix} ${prompt}`;

    const result = await fal.subscribe("fal-ai/flux-lora", {
      input: {
        prompt: fullPrompt,
        image_size: "square_hd",
        num_images: 1,
        output_format: "jpeg",
        guidance_scale: 3.5,
        num_inference_steps: 28,
        enable_safety_checker: false
      }
    });

    return result.data.images[0].url;

  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}