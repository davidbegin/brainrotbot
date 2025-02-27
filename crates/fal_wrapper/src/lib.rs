use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::Utc;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

/// Response from Fal when you fetch the final result.
///
/// Adjust the fields to match exactly what the Fal API returns.
/// For example, if the final JSON looks like:
///
/// ```json
/// {
///   "images": [ { "url": "", "content_type": "image/jpeg" } ],
///   "prompt": "",
///   "timings": { ... },
///   "seed": 12345,
///   "has_nsfw_concepts": [ false ]
/// }
/// ```
#[derive(Debug, Deserialize)]
pub struct FalOutput {
    pub images: Option<Vec<ImageInfo>>,
    pub prompt: Option<String>,
    pub timings: Option<serde_json::Value>, // define a struct if you know the schema
    pub seed: Option<u64>,
    pub has_nsfw_concepts: Option<Vec<bool>>,
}

/// Represents each image object in the "images" array.
#[derive(Debug, Deserialize)]
pub struct ImageInfo {
    pub url: Option<String>,
    #[serde(rename = "content_type")]
    pub content_type: Option<String>,
}

/// Immediate response from generation (POST).
/// We assume it returns a JSON with at least a `request_id`.
#[derive(Debug, Deserialize)]
pub struct GenerationResponse {
    pub request_id: Option<String>,

    // Some Fal endpoints might return the image immediately in base64 form:
    pub image_base64: Option<String>,

    // Possibly other fields
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

/// JSON structure for the POST body that starts the generation job.
#[derive(Debug, Serialize)]
struct GenerateImageRequest<'a> {
    prompt: &'a str,
}

/// Run the full flow:
/// 1) Generate image request
/// 2) Poll until completed
/// 3) Fetch final result
/// 4) Save raw JSON
/// 5) Iterate and download each image by URL
/// 6) Return `FalOutput`
pub async fn fal_demo() -> Result<FalOutput> {
    // Load FAL_API_KEY from environment
    let fal_key = std::env::var("FAL_API_KEY")
        .map_err(|_| anyhow!("FAL_API_KEY environment variable not set"))?;

    // Example usage:
    let endpoint = "https://queue.fal.run/fal-ai/fast-sdxl";
    let prompt = "The coolest turtle ever ALIVE";

    println!("Starting job with prompt: {prompt}");

    // 1) Submit the generation job (POST)
    let gen_response = generate_image(endpoint, &fal_key, prompt).await?;
    println!("Immediate generation response: {gen_response:?}");

    // 2) Extract request_id from the immediate response
    let request_id = match gen_response.request_id {
        Some(id) => id,
        None => {
            println!("No 'request_id' found in generation response. Stopping here.");
            return Err(anyhow!("No request_id returned by generation"));
        }
    };

    // 3) Poll the status endpoint until the job is "completed" or we reach max tries
    let max_retries = 30;
    let poll_interval = Duration::from_secs(2);

    for attempt in 1..=max_retries {
        sleep(poll_interval).await;
        let status_json = get_request_status(&request_id, &fal_key).await?;

        // Suppose the status JSON has: { "status": "completed" }
        let status_str = status_json
            .get("status")
            .and_then(|s| s.as_str())
            .unwrap_or("unknown");

        println!("Polling attempt {attempt}: status = {status_str}");

        if status_str.eq_ignore_ascii_case("completed") {
            println!("Request {request_id} is completed!");
            break;
        }

        if attempt == max_retries {
            return Err(anyhow!("Job did not complete after {max_retries} attempts"));
        }
    }

    // 4) Fetch the final result
    let final_json = get_request_result(&request_id, &fal_key).await?;

    // 5) Save the raw JSON to disk
    let filename = format!("final_result_{}.json", Utc::now().timestamp());
    std::fs::write(&filename, serde_json::to_string_pretty(&final_json)?)?;
    println!("Saved final JSON to: {filename}");

    // 6) Parse the final JSON into `FalOutput`
    let fal_output: FalOutput = serde_json::from_value(final_json)?;

    // 7) Download and save each returned image (if URLs exist)
    if let Some(images) = &fal_output.images {
        let download_client = build_client(&fal_key)?;
        let timestamp = Utc::now().timestamp();

        for (i, image_info) in images.iter().enumerate() {
            if let Some(url) = &image_info.url {
                let resp = download_client.get(url).send().await?.error_for_status()?;
                let image_bytes = resp.bytes().await?;

                // Guess an appropriate file extension
                let extension = extension_from_content_type(image_info.content_type.as_deref());
                let image_filename = format!("final_image_{timestamp}_{i}.{extension}");
                std::fs::write(&image_filename, &image_bytes)?;
                println!("Downloaded image {i} saved to: {image_filename}");
            }
        }
    }

    // Return the final Fal output struct
    Ok(fal_output)
}

/// POST an image generation request.
/// Returns the `GenerationResponse`, including a `request_id` if available.
/// Also handles immediate base64 output if provided by the endpoint.
pub async fn generate_image(
    endpoint: &str,
    fal_key: &str,
    prompt: &str,
) -> Result<GenerationResponse> {
    let client = build_client(fal_key)?;
    let request_body = GenerateImageRequest { prompt };

    let resp = client
        .post(endpoint)
        .json(&request_body)
        .send()
        .await?
        .error_for_status()?;

    // Parse the entire JSON as `GenerationResponse`
    let parsed: GenerationResponse = resp.json().await?;

    println!("Generation response: {parsed:?}");

    // If there's an immediate base64 image, save it
    if let Some(image_data) = &parsed.image_base64 {
        let image_bytes = base64_to_bytes(image_data)?;
        let filename = format!("generated_image_{}.png", Utc::now().timestamp());
        std::fs::write(&filename, image_bytes)?;
        println!("Immediate image saved as: {filename}");
    }

    Ok(parsed)
}

/// GET the request status from:
/// `https://queue.fal.run/fal-ai/lightning-models/requests/$REQUEST_ID/status`
async fn get_request_status(request_id: &str, fal_key: &str) -> Result<serde_json::Value> {
    let client = build_client(fal_key)?;
    let url = format!("https://queue.fal.run/fal-ai/lightning-models/requests/{request_id}/status");

    let resp = client.get(&url).send().await?.error_for_status()?;
    Ok(resp.json().await?)
}

/// GET the final result once the request is completed:
/// `https://queue.fal.run/fal-ai/lightning-models/requests/$REQUEST_ID`
async fn get_request_result(request_id: &str, fal_key: &str) -> Result<serde_json::Value> {
    let client = build_client(fal_key)?;
    let url = format!("https://queue.fal.run/fal-ai/lightning-models/requests/{request_id}");

    let resp = client.get(&url).send().await?.error_for_status()?;
    Ok(resp.json().await?)
}

/// Helper: Build a reqwest client with the required headers
fn build_client(fal_key: &str) -> Result<reqwest::Client> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let auth_header_value = format!("Key {fal_key}");
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&auth_header_value)
            .map_err(|_| anyhow!("Invalid authorization header"))?,
    );

    Ok(reqwest::Client::builder()
        .default_headers(headers)
        .build()?)
}

/// Helper: decode base64 image data
fn base64_to_bytes(data: &str) -> Result<Vec<u8>> {
    STANDARD
        .decode(data)
        .map_err(|e| anyhow!("Base64 decode error: {e}"))
}

/// Helper: guess the file extension from `content_type`.
fn extension_from_content_type(content_type: Option<&str>) -> &'static str {
    match content_type {
        Some("image/jpeg") => "jpg",
        Some("image/png") => "png",
        _ => "bin", // fallback if unknown
    }
}
