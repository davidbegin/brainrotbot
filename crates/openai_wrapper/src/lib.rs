use anyhow::{anyhow, Result};
use rig::{completion::Prompt, providers};

// use crate::models;

pub const DEFAULT_PROMPT_MODEL: &str = "o3-mini"; // or "gpt-4o", whichever you prefer
pub const MODEL_NAME: &str = "o3-mini"; // or "gpt-4o", whichever you prefer

/// Merge the base prompt with the discovered topic.
pub async fn generate_prompt_with_topic(
    client: &providers::openai::Client,
    base_prompt: &str,
    topic: &str,
) -> Result<String> {
    let merge_agent = client
        .agent(DEFAULT_PROMPT_MODEL)
        .preamble("You are a creative prompt generator. \
                   Merge the given base prompt with the provided topic into one clear and engaging prompt.")
        .build();

    let merge_prompt = format!(
        "Base prompt: \"{base_prompt}\"\nTopic: \"{topic}\"\n\
         Generate a new prompt that creatively incorporates both."
    );
    let new_prompt = merge_agent
        .prompt(&merge_prompt)
        .await
        .map_err(|e| anyhow!(e))?;
    Ok(new_prompt)
}
