pub mod audio;
mod commands;
pub mod config;
pub mod services;

use commands::{
    auto_init_shortcut_mgr, check_shortcut_available, encode_wav_to_ogg, get_encoder_info,
    get_shortcut_status, get_whisper_info, init_audio_capture, init_shortcut_mgr,
    init_whisper_client, is_recording, is_whisper_initialized, register_all_profile_shortcuts,
    register_global_shortcut, register_profile_shortcut, start_capture, stop_capture,
    subscribe_rms, toggle_record, transcribe_audio, transcribe_recorded_audio,
    unregister_all_profile_shortcuts, unregister_global_shortcut, unregister_profile_shortcut,
    update_global_shortcut, AudioCaptureState, ShortcutMgrState, WhisperClientState,
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
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Arc::new(Mutex::new(None)) as AudioCaptureState)
        .manage(Arc::new(Mutex::new(None)) as WhisperClientState)
        .manage(Arc::new(Mutex::new(None)) as ShortcutMgrState)
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
            is_whisper_initialized,
            init_shortcut_mgr,
            auto_init_shortcut_mgr,
            toggle_record,
            get_shortcut_status,
            register_global_shortcut,
            unregister_global_shortcut,
            update_global_shortcut,
            register_profile_shortcut,
            unregister_profile_shortcut,
            register_all_profile_shortcuts,
            unregister_all_profile_shortcuts,
            check_shortcut_available
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
