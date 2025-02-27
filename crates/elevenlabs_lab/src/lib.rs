#![allow(unused_imports)]
#![allow(dead_code)]

use agent_twitter_client::{
    scraper::Scraper,
    tweets::{create_tweet_request, upload_media},
};
use anyhow::{anyhow, Result};
use chrono::Utc;
use elevenlabs_rs::utils::play;
use elevenlabs_rs::{ElevenLabsClient, Model, PreMadeVoiceID, TextToSpeech, TextToSpeechBody};
use std::{env, fs};

/// Saves TTS audio to `./tmp/<timestamp>.mp3` using ElevenLabs.
/// Requires the environment variable `ELEVENLABS_API_KEY`.
///
pub async fn save_tts_audio(id: &str, text: &str) -> Result<String> {
    let api_key =
        env::var("ELEVENLABS_API_KEY").expect("Missing ELEVENLABS_API_KEY environment variable");

    let client = ElevenLabsClient::new(api_key);

    // Use default voice settings via our pre-made voice.
    let model = Model::ElevenTurboV2;
    let voice_id = PreMadeVoiceID::Ethan;

    // This is pulling in the text to convert to audio
    let tts_body = TextToSpeechBody::new(text, model.clone());
    let tts_endpoint = TextToSpeech::new(voice_id, tts_body);

    let bytes = client.hit(tts_endpoint).await.map_err(|e| anyhow!(e))?;

    // Optionally, play the audio.
    play(bytes.clone()).map_err(|e| anyhow!(e))?;

    // fs::create_dir_all("./tmp")?;
    // let filename = format!("{}.mp3", Utc::now().timestamp());

    fs::create_dir_all(format!("./tmp/{}", id))?;
    let filename = format!("{}.mp3", "tts");
    let local_audio_path = format!("./tmp/{}/{}", id, filename);

    fs::write(&local_audio_path, &bytes).map_err(|e| {
        eprintln!("Error writing TTS file: {e:?}");
        anyhow!(e)
    })?;

    Ok(local_audio_path)
}
