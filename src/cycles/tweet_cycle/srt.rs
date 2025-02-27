use agent_twitter_client::scraper::Scraper;
use anyhow::{anyhow, Result};
use rig::{completion::Prompt, providers};
use std::{fs, path::Path};

pub fn generate_subtitles(id: &str, audio_path: &str) -> Result<(String, String)> {
    println!("Starting transcription");
    subtitle_hub::run_docker_transcription(id, audio_path)?;
    println!("Finished transcription");
    let srt_file = format!("./tmp/{}/{}.srt", id, "tts");
    println!("Using SRT File: {}", srt_file);
    let srt_output_path = subtitle_hub::convert(id, &srt_file)?;
    println!("Finished converting Subtitles");
    let ass_path = format!("./tmp/{}/tts.ass", id);
    let ass_subtitles = convert_srt_to_ass(&srt_output_path, &ass_path);
    Ok((srt_output_path, ass_subtitles))
}

fn convert_srt_to_ass(srt_path: &str, ass_path: &str) -> String {
    let status = std::process::Command::new("ffmpeg")
        .args(&["-i", srt_path, ass_path])
        .status()
        .expect("Failed to execute ffmpeg");

    if status.success() {
        println!("Successfully converted {} to {}", srt_path, ass_path);
    } else {
        eprintln!("Failed to convert {} to {}", srt_path, ass_path);
    }

    ass_path.to_string()
}
