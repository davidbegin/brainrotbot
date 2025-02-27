use anyhow::{anyhow, Result};
use chrono::Utc;
use std::process::Command;

/// Builds a slideshow MP4 from images described in `filelist.txt` plus the audio track.
pub fn create_video_from_filelist_and_audio(run_id: i64, audio_path: &str) -> Result<()> {
    let timestamp = chrono::Local::now().timestamp();
    let output_file = format!("./tmp/{}/{}.mp4", run_id, timestamp);

    println!("\n~~~ Creating Video ~~~");
    println!("\tRun ID: {}", run_id);
    println!("\tAudio Path: {}", audio_path);
    println!("\tOutput File: {}\n", output_file);

    let filelist = format!("./tmp/{}/filelist.txt", run_id);
    let srt_file = format!("./tmp/{}/tts.ass", run_id);
    // let srt_file = format!("./tmp/{}/tts.srt", run_id);

    let filter = format!("pad=ceil(iw/2)*2:ceil(ih/2)*2");
    let args = vec![
        "-y", // overwrite
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        &filelist,
        "-i",
        audio_path,
        "-i",
        &srt_file,
        "-c:v",
        "libx264",
        "-vf",
        &filter,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        // "-shortest", // stop when audio ends
        "-loglevel",
        "error",
        &output_file,
    ];

    println!("Running ffmpeg command:");
    println!("ffmpeg {}", args.join(" "));

    let status = Command::new("ffmpeg").args(&args).status()?;

    if !status.success() {
        return Err(anyhow!("ffmpeg failed with status: {:?}", status));
    }

    let final_output = format!("./tmp/{}/final_output.mp4", run_id);
    let subtitle_filter = format!("ass={}", srt_file);

    // This subtitle file isn't working
    println!("Running ffmpeg command:");
    println!(
        "ffmpeg -y -i {} -vf {} -c:a copy -loglevel error {}",
        output_file, subtitle_filter, final_output
    );

    let status = Command::new("ffmpeg")
        .args(&[
            "-y",
            "-i",
            &output_file,
            "-vf",
            &subtitle_filter,
            "-c:a",
            "copy",
            "-loglevel",
            "error",
            &final_output,
        ])
        .status()?;

    if !status.success() {
        return Err(anyhow!("ffmpeg failed with status: {:?}", status));
    }
    println!("Created slideshow: final_output.mp4");
    Ok(())
}

fn add_subtitles_to_video(video_file: &str, subtitle_file: &str, output_file: &str) {
    // Example ffmpeg command:
    // ffmpeg -i input.mp4 -vf subtitles=subs.srt -c:a copy output.mp4
    println!("Subtitles Time");
    // "subtitles={}:force_style='PrimaryColour=&H00FFFF&'",
    let status = Command::new("ffmpeg")
        .args(&[
            "-i",
            video_file,
            "-vf",
            &format!("subtitles={}", subtitle_file),
            "-c:a",
            "copy",
            output_file,
        ])
        .status()
        .expect("Failed to execute ffmpeg");

    if status.success() {
        println!("Subtitles added to {}", output_file);
    } else {
        eprintln!("Failed to add subtitles to {}", video_file);
    }
}
