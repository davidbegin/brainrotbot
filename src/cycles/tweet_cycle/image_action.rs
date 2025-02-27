//#![allow(dead_code)]
//#![allow(unused_imports)]
//
//use agent_twitter_client::scraper::Scraper;
//use anyhow::{anyhow, bail, Result};
//use reqwest::Client;
//use rig::{completion::Prompt, providers};
//use serde::{Deserialize, Serialize};
//use std::{fs, path::Path};
//
//use subtitle_hub;
//
//// Prepare the request payload.
//#[derive(Serialize)]
//struct FalRequest<'a> {
//    prompt: &'a str,
//    // You can add more fields if needed
//    // e.g. negative_prompt, num_images, etc.
//}
//
//#[derive(Debug, Deserialize)]
//struct FalImage {
//    #[serde(rename = "base64")]
//    base64: String,
//}
//
//// So I don't think we have ID Yet
//#[derive(Debug, Deserialize)]
//struct FalResponse {
//    request_id: String,
//    status: String,
//    images: Option<Vec<FalImage>>,
//}
//
//// Raw status response from Fal: {"images":[{"url":"https://v3.fal.media/files/penguin/geVAn5_K0P5ssyjlAvM0H.jpeg","width":1024,"height":1024,"content_type":"image/jpeg"}],"timings":{"inference":2.130447831004858},"seed":14461671801311135666,"has_nsfw_concepts":[false],"prompt":"noice"}
//#[derive(Debug, Deserialize)]
//struct FalStatusResponse {
//    request_id: Option<String>,
//    status: Option<String>,
//    images: Option<Vec<FalStatusImage>>,
//    timings: Option<FalTimings>,
//    seed: Option<u64>,
//    has_nsfw_concepts: Option<Vec<bool>>,
//    prompt: Option<String>,
//}
//
//#[derive(Debug, Deserialize)]
//struct FalStatusImage {
//    #[serde(rename = "base64", default)]
//    base64: String,
//    url: Option<String>,
//    width: Option<u32>,
//    height: Option<u32>,
//    content_type: Option<String>,
//}
//
//#[derive(Debug, Deserialize)]
//struct FalTimings {
//    inference: f64,
//}
//// This does the 4-step process: POST -> get ID -> poll -> retrieve final image.
//async fn fal_generate_and_wait(endpoint: &str, fal_api_key: &str, prompt: &str) -> Result<String> {
//    let client = Client::new();
//
//    // 1) Send the initial POST request to start the job
//    let request_body = FalRequest { prompt };
//    let post_resp = client
//        .post(endpoint)
//        .header("Authorization", format!("Key {}", fal_api_key))
//        .json(&request_body)
//        .send()
//        .await?;
//
//    if !post_resp.status().is_success() {
//        bail!(
//            "Fal create-image request failed, status: {}",
//            post_resp.status()
//        );
//    }
//
//    let fal_initial_text = post_resp.text().await?;
//    println!("Raw response from Fal: {}", fal_initial_text);
//    let fal_initial: FalResponse = serde_json::from_str(&fal_initial_text).map_err(|e| {
//        anyhow!(
//            "Failed to parse Fal response: {}, response: {}",
//            e,
//            fal_initial_text
//        )
//    })?;
//    let request_id = fal_initial.request_id;
//
//    // 2) Build the status endpoint for polling
//    //    e.g. "https://queue.fal.run/fal-ai/fast-sdxl/<request_id>"
//    let status_endpoint = format!("{}/requests/{}", endpoint.trim_end_matches('/'), request_id);
//
//    // Status Endpoint: https://queue.fal.run/fal-ai/fast-sdxl/5d0fceae-8d19-429f-b6f2-8ff3569c25ad
//    // https://queue.fal.run/fal-ai/fast-sdxl/requests/$REQUEST_ID/status \
//    println!("Status Endpoint: {}", status_endpoint);
//
//    // 3) Poll until the job is done or fails
//    loop {
//        // Sleep a bit to avoid hammering the endpoint
//        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
//
//        let get_resp = client
//            .get(&status_endpoint)
//            .header("Authorization", format!("Key {}", fal_api_key))
//            .send()
//            .await?;
//
//        if !get_resp.status().is_success() {
//            bail!("Fal polling request failed, status: {}", get_resp.status());
//        }
//
//        let fal_status_text = get_resp.text().await?;
//        println!("Raw status response from Fal: {}", fal_status_text);
//        let fal_status: FalStatusResponse =
//            serde_json::from_str(&fal_status_text).map_err(|e| {
//                anyhow!(
//                    "Failed to parse Fal status response: {}, response: {}",
//                    e,
//                    fal_status_text
//                )
//            })?;
//        match fal_status.status {
//            Some(status) => match status.as_str() {
//                "PENDING" | "STARTED" | "RUNNING" => {
//                    println!("Image generation still in progress…");
//                    // keep looping
//                }
//                "SUCCESS" => {
//                    // 4) Return the first Base64-encoded image (or decode it here if you prefer)
//                    if let Some(images) = fal_status.images {
//                        if let Some(first_image) = images.get(0) {
//                            return Ok(first_image.base64.clone());
//                        } else {
//                            bail!("No images array found in Fal's SUCCESS response.");
//                        }
//                    } else {
//                        bail!("Missing 'images' field in Fal's SUCCESS response.");
//                    }
//                }
//                other => {
//                    bail!("Fal request ended with status: {}", other);
//                }
//            },
//            None => {
//                // Assume success if status is missing
//                if let Some(images) = fal_status.images {
//                    if let Some(first_image) = images.get(0) {
//                        return Ok(first_image.base64.clone());
//                    } else {
//                        bail!("No images array found in Fal's response with missing status.");
//                    }
//                } else {
//                    bail!("Missing 'images' field in Fal's response with missing status.");
//                }
//            }
//        }
//    }
//}
//
//pub async fn create_images_for_subtitles(
//    run_id: i64,
//    subtitles: &[subtitle_hub::SubtitleLine],
//) -> Result<()> {
//    println!("Creating Images for Subtitles: {:?}", subtitles);
//
//    // Build a "filelist.txt" describing how each image is shown in the final slideshow.
//    let mut filelist = String::new();
//    let mut image_counter = 0;
//
//    let fal_key = std::env::var("FAL_API_KEY")
//        .map_err(|_| anyhow!("FAL_API_KEY environment variable not set"))?;
//
//    for (line_index, sub) in subtitles.iter().enumerate() {
//        let line_duration = sub.end - sub.start;
//        if line_duration <= 0.0 {
//            continue;
//        }
//        let words: Vec<&str> = sub.text.split_whitespace().collect();
//        if words.is_empty() {
//            continue;
//        }
//
//        let word_duration = line_duration / words.len() as f32;
//
//        for (i, word) in words.iter().enumerate() {
//            // TODO: Move this once image generation is working
//            if i >= 1 {
//                break;
//            }
//
//            // We'll call FAL to generate an image from this word (or full line).
//            let endpoint = "https://queue.fal.run/fal-ai/fast-sdxl";
//            let folder = format!("./tmp/{}", run_id);
//            let image_filename_base = format!("word_{line_index}_{image_counter}.png");
//            let image_filename = format!("{folder}/{image_filename_base}");
//
//            // Make sure directory exists
//            std::fs::create_dir_all(&folder)?;
//
//            // Instead of a direct call, we now do: (POST -> poll -> retrieve)
//            let image_base64 = fal_generate_and_wait(endpoint, &fal_key, word).await?;
//
//            let decoded_bytes =
//                base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &image_base64)
//                    .map_err(|e| anyhow!("Failed to decode Base64 image: {}", e))?;
//
//            // Write the decoded bytes to disk:
//            fs::write(&image_filename, decoded_bytes)?;
//
//            // Build out the ffmpeg filelist
//            filelist.push_str(&format!(
//                "file '{}'\n\
//                 duration {}\n",
//                image_filename_base, word_duration
//            ));
//
//            image_counter += 1;
//        }
//    }
//
//    // The FFmpeg concat demuxer requires the last image repeated
//    // (no "duration" line for the last one).
//    if image_counter > 0 {
//        let last_image = format!("word_{}_{}.png", subtitles.len() - 1, image_counter - 1);
//        filelist.push_str(&format!("file '{}'\n", last_image));
//    }
//
//    fs::write(format!("./tmp/{}/filelist.txt", run_id), filelist)?;
//    println!(
//        "Finished writing filelist.txt with {} images",
//        image_counter
//    );
//
//    Ok(())
//}
#![allow(dead_code)]
#![allow(unused_imports)]

use anyhow::{anyhow, bail, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path, time::Duration};

use subtitle_hub;

// -----------------------------------------------------------------------------
// Data models for FAL API requests/responses
// -----------------------------------------------------------------------------

#[derive(Serialize)]
struct FalRequest<'a> {
    prompt: &'a str,
}

#[derive(Debug, Deserialize)]
struct FalResponse {
    request_id: String,
    status: String,
    images: Option<Vec<FalImage>>,
}

#[derive(Debug, Deserialize)]
struct FalImage {
    #[serde(rename = "base64")]
    base64: String,
}

#[derive(Debug, Deserialize)]
struct FalStatusResponse {
    request_id: Option<String>,
    status: Option<String>,
    images: Option<Vec<FalStatusImage>>,
    timings: Option<FalTimings>,
    seed: Option<u64>,
    has_nsfw_concepts: Option<Vec<bool>>,
    prompt: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FalStatusImage {
    #[serde(rename = "base64", default)]
    base64: String,
    url: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    content_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FalTimings {
    inference: f64,
}

// -----------------------------------------------------------------------------
// A simple client encapsulating the Fal endpoint, key, and HTTP client
// -----------------------------------------------------------------------------

#[derive(Clone)]
pub struct FalClient {
    client: Client,
    endpoint: String,
    api_key: String,
}

impl FalClient {
    /// Create a new FalClient with the given endpoint and API key.
    pub fn new(endpoint: impl Into<String>, api_key: impl Into<String>) -> Self {
        FalClient {
            client: Client::new(),
            endpoint: endpoint.into(),
            api_key: api_key.into(),
        }
    }

    /// Main entrypoint to generate an image by prompt.
    /// 1) POST prompt -> get request ID
    /// 2) Poll until completion
    /// 3) Return base64-encoded image data.
    pub async fn generate_image(&self, prompt: &str) -> Result<String> {
        let request_id = self.start_generation(prompt).await?;
        self.poll_for_image(&request_id).await
    }

    /// Step 1: Start the generation request, returning the `request_id`.
    async fn start_generation(&self, prompt: &str) -> Result<String> {
        let req_body = FalRequest { prompt };
        let resp = self
            .client
            .post(&self.endpoint)
            .header("Authorization", format!("Key {}", self.api_key))
            .json(&req_body)
            .send()
            .await?;

        if !resp.status().is_success() {
            bail!("Fal create-image request failed, status: {}", resp.status());
        }

        let text = resp.text().await?;
        let parsed: FalResponse = serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse Fal response: {e}, raw: {text}"))?;
        Ok(parsed.request_id)
    }

    /// Step 2: Poll until the generation completes or fails. Return the first image's base64.
    async fn poll_for_image(&self, request_id: &str) -> Result<String> {
        let status_url = format!(
            "{}/requests/{}",
            self.endpoint.trim_end_matches('/'),
            request_id
        );

        loop {
            tokio::time::sleep(Duration::from_secs(3)).await;

            let resp = self
                .client
                .get(&status_url)
                .header("Authorization", format!("Key {}", self.api_key))
                .send()
                .await?;

            if !resp.status().is_success() {
                bail!("Fal polling request failed, status: {}", resp.status());
            }

            let status_text = resp.text().await?;
            let status_parsed: FalStatusResponse =
                serde_json::from_str(&status_text).map_err(|e| {
                    anyhow!("Failed to parse Fal status response: {e}, raw: {status_text}")
                })?;

            let status = status_parsed.status.as_deref().unwrap_or("SUCCESS");
            match status {
                "PENDING" | "STARTED" | "RUNNING" => {
                    // Still in progress; keep polling
                    continue;
                }
                "SUCCESS" => {
                    // Return the first base64 image
                    if let Some(images) = status_parsed.images {
                        if let Some(first) = images.first() {
                            return Ok(first.base64.clone());
                        }
                    }
                    bail!("No images found in SUCCESS response.");
                }
                other => bail!("Fal request ended with status: {}", other),
            }
        }
    }
}

// -----------------------------------------------------------------------------
// High-level function to create images for subtitles
// -----------------------------------------------------------------------------

pub async fn create_images_for_subtitles(
    run_id: i64,
    subtitles: &[subtitle_hub::SubtitleLine],
) -> Result<()> {
    println!("Creating Images for Subtitles: {:?}", subtitles);

    let fal_key = std::env::var("FAL_API_KEY")
        .map_err(|_| anyhow!("FAL_API_KEY environment variable not set"))?;
    let endpoint = "https://queue.fal.run/fal-ai/fast-sdxl";

    // Create the FalClient once
    let fal_client = FalClient::new(endpoint, fal_key);

    let folder = format!("./tmp/{run_id}");
    std::fs::create_dir_all(&folder)?;

    // Build a "filelist.txt" for the FFmpeg concat demuxer
    let mut filelist = String::new();
    let mut image_counter = 0;

    println!("About To Iterate through the subtitles to make images");
    // For each line, generate images for each word (or partial subset).
    for (line_index, sub) in subtitles.iter().enumerate() {
        let line_duration = sub.end - sub.start;
        if line_duration <= 0.0 {
            println!("Line Duration is under limit");
            continue;
        }

        let words: Vec<&str> = sub.text.split_whitespace().collect();
        if words.is_empty() {
            println!("Word empty returning");
            continue;
        }

        let word_duration = line_duration / words.len() as f32;

        // Example logic: only generate 1 image per line
        for (i, word) in words.iter().enumerate() {
            if i >= 1 {
                break; // Only the first word for demonstration
            }

            // Generate the image
            let b64_image = fal_client.generate_image(word).await?;

            // Decode and write to disk
            let decoded =
                base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &b64_image)?;
            let filename_base = format!("word_{line_index}_{image_counter}.png");
            let filename = format!("{folder}/{filename_base}");
            std::fs::write(&filename, decoded)?;

            // Append info to the filelist
            filelist.push_str(&format!(
                "file '{}'\n\
                 duration {}\n",
                filename_base, word_duration
            ));

            image_counter += 1;
        }
    }

    // FFmpeg concat demuxer requires repeating the last image without a duration.
    if image_counter > 0 {
        let last_image = format!("word_{}_{}.png", subtitles.len() - 1, image_counter - 1);
        filelist.push_str(&format!("file '{}'\n", last_image));
    }

    // Write out the filelist
    let filelist_path = format!("{folder}/filelist.txt");
    std::fs::write(&filelist_path, &filelist)?;
    println!(
        "Finished writing filelist.txt with {} images at {}",
        image_counter, filelist_path
    );

    Ok(())
}
