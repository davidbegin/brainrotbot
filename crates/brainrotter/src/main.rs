#![allow(dead_code)]

use anyhow::{bail, Result};
use std::env;
use std::process::Command;
use std::str;

fn main() -> anyhow::Result<()> {
    // Now we need to iterate through all these videos
    let files = download_all_videos()?;
    println!("{:?}", files);

    for file in files {
        let video1 = &file;
        let video2 = "slime.mp4";
        let stacking_choice = "v";
        let output_path = format!("brainrot_{}", file);

        println!("Processing: {} + {} -> {}", video1, video2, output_path);
        brainrot(video1, video2, stacking_choice, &output_path)?;
    }

    return Ok(());
}
/// Combines two videos side-by-side (h) or stacked (v).
///
/// * `video1` - Path to the first video file.
/// * `video2` - Path to the second video file.
/// * `stacking_choice` - 'h' for horizontal split, 'v' for vertical.
/// * `output_path` - Path for the output file.
///
/// Returns an error if any of the ffmpeg/ffprobe commands fail.
pub fn brainrot(
    video1: &str,
    video2: &str,
    stacking_choice: &str,
    output_path: &str,
) -> Result<()> {
    // Validate stacking choice early
    if stacking_choice != "h" && stacking_choice != "v" {
        bail!("Invalid stacking choice (must be 'h' or 'v')");
    }

    // Get the duration of the first video
    let duration = get_video_duration(video1)?;

    // Build the ffmpeg filter based on stacking choice
    let filter = if stacking_choice == "h" {
        // Two 540x1920 side-by-side
        "[0:v]scale=540:1920,setsar=1[vid1]; \
         [1:v]scale=540:1920,setsar=1[vid2]; \
         [vid1][vid2]hstack=inputs=2[v]"
    } else {
        // Two 1080x960 stacked vertically
        "[0:v]scale=1080:960,setsar=1[vid1]; \
         [1:v]scale=1080:960,setsar=1[vid2]; \
         [vid1][vid2]vstack=inputs=2[v]"
    };

    // Spawn ffmpeg with the constructed arguments
    let status = Command::new("ffmpeg")
        .args(&[
            "-i",
            video1,
            "-stream_loop",
            "-1",
            "-i",
            video2,
            "-filter_complex",
            filter,
            "-map",
            "[v]",
            "-map",
            "0:a?",
            "-t",
            &duration,
            "-s",
            "1080x1920",
            "-y", // Overwrite output file if exists
            output_path,
        ])
        .status()?;

    // Check the result of the ffmpeg invocation
    if !status.success() {
        bail!("Failed to combine video files via ffmpeg.");
    }

    println!("Video files have been combined successfully!");
    Ok(())
}

/// Retrieves the duration of a video in seconds as a string.
///
/// Uses `ffprobe` under the hood. Returns an error if ffprobe fails or
/// if the duration output is empty.
fn get_video_duration(video_path: &str) -> Result<String> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            video_path,
        ])
        .output()?;

    if !output.status.success() {
        bail!("Failed to run ffprobe on '{}'", video_path);
    }

    let duration = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if duration.is_empty() {
        bail!("Duration not found for '{}'", video_path);
    }

    Ok(duration)
}

use serde::Deserialize;
use serde_json;
use std::error::Error;
use std::fs;

// Top-level struct which matches the JSON structure:
// {
//   "ip_assets": [...]
// }
#[derive(Deserialize, Debug)]
struct Root {
    // assets: Vec<IpAsset>,
    ip_assets: Vec<IpAsset>,
}

#[derive(Deserialize, Debug)]
struct IpAsset {
    // token_id: Option<u16>,
    token_id: Option<String>,
    token_address: Option<String>,
    token_name: Option<String>,
    token_symbol: Option<String>,
    token_type: Option<String>,
    total_supply: Option<String>,
    holders: Option<String>,

    // `metadata` is an Option because some entries might omit it
    metadata: Option<Metadata>,

    image_url: Option<String>,
    animation_url: Option<String>,
    owner: Option<String>,
}

// This struct matches the "metadata" object inside each IpAsset.
#[derive(Deserialize, Debug)]
struct Metadata {
    // `attributes` is an array of objects with trait_type, value, and optional max_value
    attributes: Option<Vec<Attribute>>,

    description: Option<String>,
    external_url: Option<String>,
    image: Option<String>,
    name: Option<String>,

    // Ok now
    mediaType: Option<String>,
    mediaUrl: Option<String>,
}

// Each entry in the `attributes` array has at least trait_type and value,
// plus an optional `max_value`.
#[derive(Deserialize, Debug)]
struct Attribute {
    trait_type: Option<String>,
    // `value` can be a string, number, or boolean in the JSON; we can store as `serde_json::Value`.
    value: serde_json::Value,
    // Some attribute objects have `max_value`, others do not, so we make it optional.
    max_value: Option<u64>,
}

fn download_all_videos() -> Result<Vec<String>> {
    // Load the JSON file. Update "data.json" to your filename/path.
    // let data = fs::read_to_string("ip_assets_2.json")?;
    let data = fs::read_to_string("ip_assets.json")?;

    // Parse the entire JSON into our `Root` struct.
    let root: Root = serde_json::from_str(&data)?;

    println!("Total assets: {}", root.ip_assets.len());

    let mut downloaded_files = Vec::new();

    // Example: iterate and print out the "owner" plus any attribute details
    for (_i, asset) in root.ip_assets.iter().enumerate() {
        // If `metadata` exists, we can look at attributes and others
        if let Some(md) = &asset.metadata {
            //println!("Metadata Name: {:?}", md.name);
            //println!("Metadata Description: {:?}", md.description);
            if md.mediaType == Some("video/mp4".to_string()) {
                println!("Found a video asset: {:?}", md.mediaUrl);
                if let Some(url) = &md.mediaUrl {
                    let filename = format!("{}.mp4", url.replace("/", "_").replace(":", "_"));
                    println!("Downloading {} to {}", url, filename);
                    let status = Command::new("curl")
                        .args(&["-L", "-o", &filename, url])
                        .status()?;
                    if !status.success() {
                        println!("Failed to download {}", url);
                    } else {
                        println!("Successfully downloaded {}", url);
                        downloaded_files.push(filename);
                    }
                }
            }
        }
    }

    Ok(downloaded_files)
}
