use anyhow::Result;
use rig::{completion::Prompt, providers};

use crate::consts;
use crate::logger;

pub async fn summarize_tweets_and_get_topic(
    client: &providers::openai::Client,
    tweets: String,
) -> Result<String> {
    let agent = client
        .agent(consts::DEFAULT_PROMPT_MODEL)
        .preamble(consts::TWEET_SUMMARIZER_PROMPT)
        .build();
    let response = agent.prompt(&tweets).await?;

    for line in response.lines() {
        if let Some(stripped) = line.strip_prefix("Topic:") {
            return Ok(stripped.trim().to_string());
        }
    }
    Ok("NoTopicFound".to_string())
}

pub async fn generate_tweet_text(
    openai_client: &providers::openai::Client,
    topic: &str,
) -> Result<String> {
    let initial_prompt = openai_wrapper::generate_prompt_with_topic(
        openai_client,
        consts::TWEET_WRITER_PROMPT,
        topic,
    )
    .await?;
    logger::system_log(&format!("Initial tweet-writer prompt:\n{initial_prompt}"));

    let tweet_agent = openai_client
        .agent(consts::DEFAULT_PROMPT_MODEL)
        .preamble(&initial_prompt)
        .build();

    let tweet_text = tweet_agent.prompt("Create one short tweet now.").await?;
    Ok(tweet_text)
}
