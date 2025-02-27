use agent_twitter_client::{scraper::Scraper, tweets::create_tweet_request};
use anyhow::anyhow;
use anyhow::Result;
use rand::prelude::*;
use std::env;
use std::fs;

/// Logs into Twitter via the Scraper
pub async fn init_scraper() -> Result<Scraper> {
    let username = env::var("TWITTER_USERNAME").map_err(|_| anyhow!("TWITTER_USERNAME not set"))?;
    let password = env::var("TWITTER_PASSWORD").map_err(|_| anyhow!("TWITTER_PASSWORD not set"))?;
    let email = "beginbot@gmail.com".to_string();

    let mut scraper = Scraper::new().await?;
    scraper.login(username, password, Some(email), None).await?;
    Ok(scraper)
}

// This goes in the scraper
/// Given a user_id, fetches the latest tweets and returns them joined as a single string.
pub async fn fetch_tweets(scraper: &mut Scraper, user_id: &str) -> Result<String> {
    let tweets = scraper.get_user_tweets(user_id, 1, None).await?;
    let text = tweets
        .tweets
        .iter()
        .filter_map(|t| t.text.clone())
        .collect::<Vec<String>>()
        .join("\n");
    Ok(text)
}

/// Posts the tweet text with a local MP4 file as media.
pub async fn post_tweet_with_video(
    scraper: &Scraper,
    tweet_text: &str,
    video_path: &str,
) -> Result<()> {
    let mp4_bytes = fs::read(video_path)?;
    let media_data = vec![(mp4_bytes, String::from("video/mp4"))];

    let response = create_tweet_request(
        &scraper.twitter_client,
        tweet_text,
        None, // no "reply to" tweet ID
        Some(media_data),
    )
    .await?;

    println!("Tweet posted successfully: {response}");
    Ok(())
}

// =================================================================

const SECTION_CRYPTO: &str = "crypto";
const SECTION_AI: &str = "ai";
const SECTION_FUNNY: &str = "funny";

const TOPICS: [&str; 3] = [SECTION_CRYPTO, SECTION_AI, SECTION_FUNNY];

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

/// Picks a random section name ("crypto", "ai", or "funny") and a random user ID from that section.
pub fn get_random_user_id() -> Option<(&'static str, &'static str)> {
    let mut rng = rand::rng();
    let section = TOPICS.choose(&mut rng).copied()?;

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
