use anyhow::Result;
use dotenv::dotenv;
use rig::providers;
use std::env;
use tokio::time::Duration;

mod consts;
mod cycles;
mod logger;
mod tweet_center;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    let openai_key =
        env::var("OPENAI_API_KEY").expect("Environment variable OPENAI_API_KEY not set");

    println!("Creating Twitter Scrapper");
    let mut scraper = twitter_scraper::init_scraper().await?;

    println!("Creating OpenAI Client");
    let openai_client = providers::openai::Client::new(&openai_key);

    loop {
        cycles::tweet_cycle::loops::run_tweet_cycle(&mut scraper, &openai_client).await?;

        println!("Sleeping before next cycle...");

        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}
