use anyhow::anyhow;
use anyhow::Result;
use regex::Regex;
use std::{env, fs, path::Path, process::Command};

/// Runs the whisperx Docker container to create an SRT file, using `audio_path`.
pub fn run_docker_transcription(id: &str, audio_path: &str) -> Result<()> {
    let audio_file_name = Path::new(audio_path)
        .file_name()
        .ok_or_else(|| anyhow!("Could not extract filename from audio path"))?
        .to_str()
        .ok_or_else(|| anyhow!("Invalid UTF-8 in audio filename"))?;

    let current_dir = env::current_dir()?;
    let current_dir_str = current_dir
        .to_str()
        .ok_or_else(|| anyhow!("Invalid current directory string"))?;

    // Create tmp directory if it doesn't exist
    fs::create_dir_all("./tmp")?;

    let output_dir = format!("./tmp/{}", id);

    println!("Running Docker command to generate SRT for '{audio_file_name}'...");
    let status = Command::new("docker")
        .args([
            "run",
            "-it",
            "-v",
            &format!("{current_dir_str}:/app"),
            "whisperx:large-v3-en",
            "--",
            "--device",
            "cpu",
            "--compute_type",
            "float32",
            "--highlight_words",
            "True",
            "--output_format",
            "srt",
            "--output_dir",
            &output_dir,
            audio_path,
        ])
        .status()?;

    if !status.success() {
        return Err(anyhow!("Docker command failed with status: {status:?}"));
    }

    // This is wrong
    //let srt_path = format!("./tmp/{}.srt", audio_file_name);
    //println!("SRT file saved to: {}", srt_path);
    Ok(())
}

pub fn convert(id: &str, input_path: &str) -> Result<String> {
    // Read the entire input file.
    println!("Reading input file: {input_path}");
    let content = fs::read_to_string(input_path)?;
    println!("Finished Reading input file: {input_path}");

    // Split into blocks. SRT blocks are separated by one or more blank lines.
    let block_re = Regex::new(r"\r?\n\r?\n")?;
    let blocks: Vec<&str> = block_re.split(&content).collect();

    // Regex to extract all text enclosed in <u> ... </u>.
    let tag_re = Regex::new(r"<u>(.*?)</u>")?;

    let mut new_entries = Vec::new();
    let mut new_index = 1;

    // Process each block.
    for block in blocks {
        if block.trim().is_empty() {
            continue;
        }

        // Split the block into lines.
        let lines: Vec<&str> = block.lines().collect();
        // A valid SRT entry should have at least three lines:
        // 1. Original numbering (ignored)
        // 2. Time range
        // 3. One or more lines of subtitle text.
        if lines.len() < 3 {
            continue;
        }

        // Keep the timestamp line (line 2).
        let timestamp = lines[1];
        // Join all text lines (lines 3 and onward) into one string.
        let text = lines[2..].join(" ");

        // Find all occurrences of <u>...</u>.
        let matches: Vec<&str> = tag_re.find_iter(&text).map(|m| m.as_str()).collect();

        // If no <u> tag was found, skip this entry.
        if matches.is_empty() {
            continue;
        }

        // Join all matches (if more than one) with a space.
        let new_text = matches.join(" ");

        // Assemble the new SRT entry with a new sequential index.
        let new_block = format!("{}\n{}\n{}\n", new_index, timestamp, new_text);
        new_entries.push(new_block);
        new_index += 1;
    }

    // Join the new entries with an empty line between blocks.
    let output_content = new_entries.join("\n");
    // let srt_output_path = format!("{input_path}");
    let srt_output_path = format!("./tmp/{}/final_srt.srt", id);
    //let srt_output_path = format!("{input_path}");
    println!("Writing output to: {}", srt_output_path);
    fs::write(srt_output_path.clone(), output_content)?;
    println!("Finished writing output to: {}", srt_output_path);

    Ok(srt_output_path)
}

/// Minimal representation of a subtitle line.
#[derive(Debug)]
pub struct SubtitleLine {
    pub start: f32, // in seconds
    pub end: f32,   // in seconds
    pub text: String,
}

/// Parse the SRT file into a list of `SubtitleLine`s.
/// This is a naive SRT parser that:
///  - Splits lines by blank lines
///  - Extracts start/end times from "HH:MM:SS,mmm --> HH:MM:SS,mmm"
///  - Joins all subsequent lines as `text`.
pub fn parse_srt(srt_path: &str) -> Result<Vec<SubtitleLine>> {
    let raw = fs::read_to_string(srt_path)?;
    let blocks: Vec<&str> = raw.split("\r\n\r\n").collect();

    let mut subtitles = Vec::new();
    for block in blocks {
        let lines: Vec<&str> = block.lines().collect();
        if lines.len() < 2 {
            continue;
        }
        // The first line might be an index like "1"
        // The second line usually has the times
        let times_line = lines.get(1).ok_or_else(|| anyhow!("Missing times line"))?;
        // Example: "00:00:01,000 --> 00:00:03,000"
        let times: Vec<&str> = times_line.split("-->").collect();
        if times.len() != 2 {
            continue;
        }
        let start = parse_srt_timestamp(times[0])?;
        let end = parse_srt_timestamp(times[1])?;
        let text = lines[2..].join(" ");

        subtitles.push(SubtitleLine { start, end, text });
    }
    Ok(subtitles)
}

/// Parse an "HH:MM:SS,mmm" string into seconds as an f32.
pub fn parse_srt_timestamp(timestamp: &str) -> Result<f32> {
    // Trim spaces
    let ts = timestamp.trim();
    let parts: Vec<&str> = ts.split(',').collect();
    if parts.len() != 2 {
        return Err(anyhow!("Invalid SRT timestamp format: {timestamp}"));
    }
    let time_part = parts[0]; // "HH:MM:SS"
    let ms_part = parts[1]; // "mmm"
    let hms: Vec<&str> = time_part.split(':').collect();
    if hms.len() != 3 {
        return Err(anyhow!("Invalid H:M:S format: {time_part}"));
    }
    let hours: f32 = hms[0].parse()?;
    let minutes: f32 = hms[1].parse()?;
    let seconds: f32 = hms[2].parse()?;
    let millis: f32 = ms_part.parse()?;
    Ok(hours * 3600.0 + minutes * 60.0 + seconds + millis / 1000.0)
}
