pub mod audio;
mod commands;
pub mod services;

use commands::{
    encode_wav_to_ogg, get_encoder_info, init_audio_capture, is_recording, start_capture,
    stop_capture, subscribe_rms, AudioCaptureState,
};
use std::sync::Arc;
use tokio::sync::Mutex;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Mutex::new(None)) as AudioCaptureState)
        .invoke_handler(tauri::generate_handler![
            greet,
            init_audio_capture,
            start_capture,
            stop_capture,
            is_recording,
            subscribe_rms,
            encode_wav_to_ogg,
            get_encoder_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
