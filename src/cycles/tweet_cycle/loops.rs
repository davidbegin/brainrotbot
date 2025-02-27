#![allow(dead_code)]
#![allow(unused_imports)]

use agent_twitter_client::scraper::Scraper;
use anyhow::{anyhow, Result};
use rig::{completion::Prompt, providers};
use std::{fs, path::Path, time::SystemTime};

use crate::consts;
use crate::cycles::tweet_cycle::{audio, image_action, srt, text_action};
use twitter_scraper;

// -------------------------------------------------------
// -- Loop States ---
// -------------------------------------------------------

pub struct Initial;

pub struct FetchTweets {
    pub topic: String,
    pub user_id: String,
}

pub struct GenerateTweetText {
    pub topic: String,
    pub user_id: String,
}

pub struct GenerateAudio {
    pub topic: String,
    pub user_id: String,
    pub tweet_text: String,
}

pub struct GenerateSubtitles {
    pub topic: String,
    pub user_id: String,
    pub tweet_text: String,
    pub audio_path: String,
}

pub struct GenerateImages {
    pub topic: String,
    pub user_id: String,
    pub tweet_text: String,
    pub audio_path: String,
    pub srt_file: String,
}

pub struct ImagesGenerated {
    pub topic: String,
    pub user_id: String,
    pub tweet_text: String,
    pub audio_path: String,
    pub srt_file: String,
}

pub struct ImagesCombinedIntoVideoPlusAudio {
    pub topic: String,
    pub user_id: String,
    pub tweet_text: String,
    pub audio_path: String,
    pub srt_file: String,
}

pub struct Complete;

// -------------------------------------------------------
// A generic TweetCycle that holds a particular state T
// -------------------------------------------------------

pub struct TweetCycle<T> {
    run_id: i64,
    state: T,
}

impl TweetCycle<Initial> {
    /// Start a new TweetCycle in the initial state.
    pub fn new(run_id: i64) -> Self {
        println!("Starting tweet cycle at {}", run_id);
        TweetCycle {
            run_id,
            state: Initial,
        }
    }

    /// 1. Choose a random user in a random section.
    pub async fn select_user(self) -> Result<TweetCycle<FetchTweets>> {
        let (topic, user_id) = twitter_scraper::get_random_user_id()
            .ok_or_else(|| anyhow!("No valid user_id found in any section."))?;
        println!("Randomly chose section '{topic}' with user_id '{user_id}'.");
        Ok(TweetCycle {
            run_id: self.run_id,
            state: FetchTweets {
                topic: topic.to_string(),
                user_id: user_id.to_string(),
            },
        })
    }
}

impl TweetCycle<FetchTweets> {
    /// 2. Fetch tweets & summarize => topic
    pub async fn generate_topic(
        self,
        scraper: &mut Scraper,
        openai_client: &providers::openai::Client,
    ) -> Result<TweetCycle<GenerateTweetText>> {
        let tweets_text = twitter_scraper::fetch_tweets(scraper, &self.state.user_id).await?;
        let topic = text_action::summarize_tweets_and_get_topic(openai_client, tweets_text).await?;
        println!("Initial topic for {} user: {}", self.state.topic, topic);

        Ok(TweetCycle {
            run_id: self.run_id,
            state: GenerateTweetText {
                topic,
                user_id: self.state.user_id,
            },
        })
    }
}

impl TweetCycle<GenerateTweetText> {
    /// 3. Generate the tweet text
    pub async fn generate_tweet_text(
        self,
        openai_client: &providers::openai::Client,
    ) -> Result<TweetCycle<GenerateAudio>> {
        let tweet_text = text_action::generate_tweet_text(openai_client, &self.state.topic).await?;
        println!("\n--- TWEET OUT ---\n{tweet_text}\n");

        Ok(TweetCycle {
            run_id: self.run_id,
            state: GenerateAudio {
                topic: self.state.topic,
                user_id: self.state.user_id,
                tweet_text,
            },
        })
    }
}

impl TweetCycle<GenerateAudio> {
    pub async fn generate_audio(self) -> Result<TweetCycle<GenerateSubtitles>> {
        let audio_path =
            audio::generate_audio(&self.run_id.to_string(), &self.state.tweet_text).await?;

        println!("Audio path: {audio_path}\n");

        Ok(TweetCycle {
            run_id: self.run_id,
            state: GenerateSubtitles {
                topic: self.state.topic,
                user_id: self.state.user_id,
                tweet_text: self.state.tweet_text,
                audio_path,
            },
        })
    }
}

// This should be generating audio!
impl TweetCycle<GenerateSubtitles> {
    /// 5. Generate SRT file from audio
    pub async fn generate_subtitles(self) -> Result<TweetCycle<GenerateImages>> {
        let (srt_file, ass_file) =
            srt::generate_subtitles(&self.run_id.to_string(), &self.state.audio_path)?;

        println!("SRT file: {:?}", srt_file);
        println!("Ass file: {:?}", ass_file);

        Ok(TweetCycle {
            run_id: self.run_id,
            state: GenerateImages {
                topic: self.state.topic,
                user_id: self.state.user_id,
                tweet_text: self.state.tweet_text,
                audio_path: self.state.audio_path,
                srt_file,
            },
        })
    }
}

impl TweetCycle<GenerateImages> {
    // We should seperate out parse srt
    /// 5. Parse the SRT & create images for each word
    pub async fn generate_images(self) -> Result<TweetCycle<ImagesGenerated>> {
        let subtitles = subtitle_hub::parse_srt(&self.state.srt_file)?;
        println!("Parsed {} subtitle lines.", subtitles.len());

        image_action::create_images_for_subtitles(self.run_id, &subtitles).await?;
        Ok(TweetCycle {
            run_id: self.run_id,
            state: ImagesGenerated {
                topic: self.state.topic,
                user_id: self.state.user_id,
                tweet_text: self.state.tweet_text,
                audio_path: self.state.audio_path,
                srt_file: self.state.srt_file,
            },
        })
    }
}

impl TweetCycle<ImagesGenerated> {
    /// 6. (Optional) Build an MP4 slideshow, post final MP4, etc.
    /// For demonstration, we skip to “Complete.”
    pub fn create_video_from_images(self) -> TweetCycle<ImagesCombinedIntoVideoPlusAudio> {
        let _result = ffmpeg_wrapper::create_video_from_filelist_and_audio(
            self.run_id,
            &self.state.audio_path,
        );
        // tweet_center::post_tweet_with_video(...);

        TweetCycle {
            run_id: self.run_id,
            state: ImagesCombinedIntoVideoPlusAudio {
                topic: self.state.topic,
                user_id: self.state.user_id,
                tweet_text: self.state.tweet_text,
                audio_path: self.state.audio_path,
                srt_file: self.state.srt_file,
            },
        }
    }
}

impl TweetCycle<ImagesCombinedIntoVideoPlusAudio> {
    /// 6. (Optional) Build an MP4 slideshow, post final MP4, etc.
    /// For demonstration, we skip to “Complete.”
    pub fn complete(self) -> TweetCycle<Complete> {
        println!("Slideshow or final video generation can go here...");
        //ffmpeg_wrapper::create_video_from_filelist_and_audio(&self.state.audio_path)?;
        //tweet_center::post_tweet_with_video(...);

        TweetCycle {
            run_id: self.run_id,
            state: Complete,
        }
    }
}

// -------------------------------------------------------
// Example: tying it all together in a run function
// -------------------------------------------------------

pub async fn run_tweet_cycle(
    scraper: &mut Scraper,
    openai_client: &providers::openai::Client,
) -> Result<()> {
    //let run_id = 1740592533;
    //
    //let sub = subtitle_hub::SubtitleLine {
    //    start: 1.0,
    //    end: 2.0,
    //    text: "noice orca".to_string(),
    //};
    //
    //let subtitles = vec![sub];
    //image_action::create_images_for_subtitles(run_id, &subtitles).await?;
    ////
    ////
    ////let audio_path = format!("./tmp/{}/tts.mp3", run_id);
    ////let _result = ffmpeg_wrapper::create_video_from_filelist_and_audio(run_id, &audio_path);
    //return Ok(());

    //let run_id = 1739943571;
    //let audio_path = "./tmp/1739943571/tts.mp3";
    //let srt_file = srt::generate_subtitles(&run_id.to_string(), audio_path)?;
    //println!("SRT file: {:?}", srt_file);
    //
    //return Ok(())https://twitter.com/lz_web3;
    let run_id = chrono::Local::now().timestamp();
    // let run_id = 1739864879;

    // We can skip all these steps
    let _final_cycle = TweetCycle::new(run_id)
        .select_user()
        .await?
        .generate_topic(scraper, openai_client)
        .await?
        .generate_tweet_text(openai_client)
        .await?
        .generate_audio()
        .await?
        .generate_subtitles()
        .await?
        .generate_images()
        .await?
        .create_video_from_images();

    // If needed, you can keep `_final_cycle` to do something with the final state
    // e.g., return data or finalize the tweet with video, etc.

    Ok(())
}
