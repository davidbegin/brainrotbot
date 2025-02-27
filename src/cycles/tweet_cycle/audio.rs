// Audio.rs
use agent_twitter_client::scraper::Scraper;
use anyhow::{anyhow, Result};
use rig::{completion::Prompt, providers};
use std::{fs, path::Path};

pub async fn generate_audio(id: &str, tweet_text: &str) -> Result<String> {
    let audio_path = elevenlabs_lab::save_tts_audio(id, tweet_text).await?;
    println!("Tweet audio saved to: {audio_path}");
    Ok(audio_path)
}
