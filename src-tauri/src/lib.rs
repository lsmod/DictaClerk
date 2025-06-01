pub mod audio;
mod commands;
pub mod config;
pub mod services;

use commands::{
    encode_wav_to_ogg, get_encoder_info, get_whisper_info, init_audio_capture, init_whisper_client,
    is_recording, is_whisper_initialized, start_capture, stop_capture, subscribe_rms,
    transcribe_audio, transcribe_recorded_audio, AudioCaptureState, WhisperClientState,
};
use config::validate_config_files;
use std::sync::Arc;
use tokio::sync::Mutex;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Validate configuration files before starting the application
    if let Err(e) = validate_config_files() {
        eprintln!("Configuration validation failed: {}", e);
        std::process::exit(1);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Mutex::new(None)) as AudioCaptureState)
        .manage(Arc::new(Mutex::new(None)) as WhisperClientState)
        .invoke_handler(tauri::generate_handler![
            greet,
            init_audio_capture,
            start_capture,
            stop_capture,
            is_recording,
            subscribe_rms,
            encode_wav_to_ogg,
            get_encoder_info,
            init_whisper_client,
            transcribe_audio,
            transcribe_recorded_audio,
            get_whisper_info,
            is_whisper_initialized
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
