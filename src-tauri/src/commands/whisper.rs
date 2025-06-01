use crate::audio::{Encoder, OggOpusEncoder};
use crate::services::{OpenAIWhisperClient, TranscriptionResponse, WhisperClient, WhisperError};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Global state for the Whisper client
pub type WhisperClientState = Arc<Mutex<Option<Arc<dyn WhisperClient + Send + Sync>>>>;

/// Initialize the Whisper client with API key
#[tauri::command]
pub async fn init_whisper_client(
    api_key: String,
    state: State<'_, WhisperClientState>,
) -> Result<String, String> {
    if api_key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let client =
        Arc::new(OpenAIWhisperClient::new(api_key)) as Arc<dyn WhisperClient + Send + Sync>;
    let mut state_guard = state.lock().await;
    *state_guard = Some(client);

    Ok("Whisper client initialized successfully".to_string())
}

/// Transcribe an OGG audio file using the Whisper API
#[tauri::command]
pub async fn transcribe_audio(
    file_path: String,
    prompt: Option<String>,
    state: State<'_, WhisperClientState>,
) -> Result<TranscriptionResponse, String> {
    let state_guard = state.lock().await;

    if let Some(ref client) = *state_guard {
        let path = PathBuf::from(file_path);

        client
            .transcribe(&path, prompt)
            .await
            .map_err(|e| format!("Transcription failed: {}", e))
    } else {
        Err("Whisper client not initialized. Call init_whisper_client first.".to_string())
    }
}

/// Complete workflow: encode WAV to OGG and transcribe
/// This combines the encoding and transcription steps as specified in E3-01
#[tauri::command]
pub async fn transcribe_recorded_audio(
    wav_file_path: String,
    prompt: Option<String>,
    state: State<'_, WhisperClientState>,
) -> Result<TranscriptionResponse, String> {
    let state_guard = state.lock().await;

    if let Some(ref client) = *state_guard {
        let wav_path = PathBuf::from(wav_file_path);

        // Step 1: Encode WAV to OGG
        let encoder = OggOpusEncoder::new();
        let ogg_info = encoder
            .encode(&wav_path, None, None)
            .await
            .map_err(|e| format!("Encoding failed: {}", e))?;

        // Step 2: Transcribe the OGG file
        let transcript = client
            .transcribe(&ogg_info.path, prompt)
            .await
            .map_err(|e| format!("Transcription failed: {}", e))?;

        // Step 3: Clean up the temporary OGG file (optional)
        if let Err(e) = tokio::fs::remove_file(&ogg_info.path).await {
            eprintln!("Warning: Failed to clean up temporary OGG file: {}", e);
        }

        Ok(transcript)
    } else {
        Err("Whisper client not initialized. Call init_whisper_client first.".to_string())
    }
}

/// Get Whisper client configuration and capabilities
#[tauri::command]
pub fn get_whisper_info() -> serde_json::Value {
    serde_json::json!({
        "supported_formats": ["OGG/Opus"],
        "max_file_size_mb": 25,
        "max_duration_seconds": 600,
        "models": ["whisper-1"],
        "features": [
            "automatic_speech_recognition",
            "language_detection",
            "prompt_guided_transcription",
            "retry_on_failures",
            "exponential_backoff"
        ]
    })
}

/// Check if Whisper client is initialized
#[tauri::command]
pub async fn is_whisper_initialized(state: State<'_, WhisperClientState>) -> Result<bool, String> {
    let state_guard = state.lock().await;
    Ok(state_guard.is_some())
}

/// Convert WhisperError to user-friendly error message
#[allow(dead_code)] // Public API for future UI error formatting
pub fn format_whisper_error(error: &WhisperError) -> String {
    match error {
        WhisperError::FileTooLarge { size, max } => {
            format!(
                "Audio file is too large: {:.1}MB (maximum: {:.1}MB)",
                *size as f64 / (1024.0 * 1024.0),
                *max as f64 / (1024.0 * 1024.0)
            )
        }
        WhisperError::FileIo(e) => format!("File error: {}", e),
        WhisperError::Network(msg) => format!("Network error: {}", msg),
        WhisperError::Server { status, message } => {
            format!("Server error ({}): {}", status, message)
        }
        WhisperError::Api(msg) => format!("API error: {}", msg),
        WhisperError::InvalidResponse(msg) => format!("Invalid response: {}", msg),
        WhisperError::RateLimit { message } => format!("Rate limited: {}", message),
        WhisperError::Timeout { timeout_seconds } => {
            format!("Request timed out after {}s", timeout_seconds)
        }
    }
}
