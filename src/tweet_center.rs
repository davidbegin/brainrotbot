#![allow(unused_imports)]
#![allow(dead_code)]
use anyhow::Result;
use rand::prelude::*;
use rig::{completion::Prompt, providers};

use crate::consts;

const SECTION_CRYPTO: &str = "crypto";
const SECTION_AI: &str = "ai";
const SECTION_FUNNY: &str = "funny";

const SECTIONS: [&str; 3] = [SECTION_CRYPTO, SECTION_AI, SECTION_FUNNY];

const CRYPTO_USER_IDS: &[&str] = &[
    "5925542",  // casey
    "40134343", // tylerh
];

const AI_USER_IDS: &[&str] = &[
    "1005182149",          // begin
    "427089628",           // lex
    "1605",                // sama
    "1173552893003255808", // yacine
    "1326180756310331399", // tom dorr
];

const FUNNY_USER_IDS: &[&str] = &[
    "16298441", // dril
               // We need more
];

// The consts
/// Summarizes tweets, extracting a line starting with "Topic:".
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

/// Picks a random section name ("crypto", "ai", or "funny") and a random user ID from that section.
pub fn get_random_user_id() -> Option<(&'static str, &'static str)> {
    let mut rng = rand::rng();
    let section = SECTIONS.choose(&mut rng).copied()?;

    // Pick a random ID from that section
    let user_ids = match section {
        SECTION_CRYPTO => CRYPTO_USER_IDS,
        SECTION_AI => AI_USER_IDS,
        SECTION_FUNNY => FUNNY_USER_IDS,
        _ => return None,
    };

    let user_id = user_ids.choose(&mut rng).copied()?;
    Some((section, user_id))
}
