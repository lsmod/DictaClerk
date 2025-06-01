use crate::audio::{Encoder, EncodingEvent, OggInfo, OggOpusEncoder};
use std::path::PathBuf;
use tokio::sync::mpsc;

/// Encode a WAV file to OGG/Opus format
#[tauri::command]
pub async fn encode_wav_to_ogg(
    wav_path: String,
    output_path: Option<String>,
) -> Result<OggInfo, String> {
    let wav_path = PathBuf::from(wav_path);
    let output_path = output_path.map(PathBuf::from);

    let encoder = OggOpusEncoder::new();

    // Create a channel for progress events (optional for this command)
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Spawn a task to handle events (for now just log them)
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                EncodingEvent::Progress {
                    bytes_processed,
                    estimated_total,
                } => {
                    println!(
                        "Encoding progress: {}/{} bytes",
                        bytes_processed, estimated_total
                    );
                }
                EncodingEvent::SizeAlmostLimit { estimated_size } => {
                    println!("Warning: Size approaching limit: {} bytes", estimated_size);
                }
                EncodingEvent::Completed { final_info } => {
                    println!("Encoding completed: {:?}", final_info);
                }
                EncodingEvent::Error { message } => {
                    println!("Encoding error: {}", message);
                }
            }
        }
    });

    encoder
        .encode(&wav_path, output_path.as_deref(), Some(tx))
        .await
        .map_err(|e| e.to_string())
}

/// Get encoder configuration and capabilities
#[tauri::command]
pub fn get_encoder_info() -> serde_json::Value {
    serde_json::json!({
        "default_bitrate": 32000,
        "supported_formats": ["WAV"],
        "output_format": "OGG/Opus",
        "size_limit_mb": 23,
        "forecast_accuracy": "≤2%"
    })
}
