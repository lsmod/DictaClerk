pub mod audio;
pub mod commands;
pub mod config;
pub mod services;

use commands::{
    apply_profile_to_text, auto_init_shortcut_mgr, check_shortcut_available, close_settings_window,
    copy_to_clipboard, encode_wav_to_ogg, format_text_with_gpt, get_active_profile,
    get_clipboard_info, get_encoder_info, get_gpt_info, get_shortcut_status, get_whisper_info,
    handle_window_close, hide_main_window, init_audio_capture, init_clipboard_service,
    init_gpt_client, init_shortcut_mgr, init_system_tray, init_whisper_client,
    is_clipboard_initialized, is_gpt_initialized, is_recording, is_settings_window_open,
    is_whisper_initialized, is_window_hidden, load_profiles, load_settings, open_settings_window,
    register_all_profile_shortcuts, register_global_shortcut, register_profile_shortcut,
    save_profiles, save_settings, select_profile, show_main_window,
    show_window_and_start_recording, start_capture, stop_capture,
    stop_recording_and_process_to_clipboard, subscribe_rms, toggle_main_window, toggle_record,
    toggle_record_with_tray, transcribe_audio, transcribe_recorded_audio,
    unregister_all_profile_shortcuts, unregister_global_shortcut, unregister_profile_shortcut,
    update_global_shortcut, update_tray_global_shortcut, update_tray_status, v1_save_profiles,
    v1_save_settings, validate_shortcut_conflict, AudioCaptureState, ClipboardServiceState,
    GptClientState, ProfileAppState, ShortcutMgrState, SystemTrayState, WhisperClientState,
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
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(Arc::new(Mutex::new(None)) as AudioCaptureState)
        .manage(Arc::new(Mutex::new(None)) as WhisperClientState)
        .manage(Arc::new(Mutex::new(None)) as GptClientState)
        .manage(Arc::new(Mutex::new(None)) as ShortcutMgrState)
        .manage(Arc::new(Mutex::new(None)) as ClipboardServiceState)
        .manage(Arc::new(Mutex::new(None)) as SystemTrayState)
        .manage(
            std::sync::Mutex::new(commands::profiles::ProfileState::default()) as ProfileAppState,
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            init_audio_capture,
            start_capture,
            stop_capture,
            stop_recording_and_process_to_clipboard,
            is_recording,
            subscribe_rms,
            encode_wav_to_ogg,
            get_encoder_info,
            init_whisper_client,
            transcribe_audio,
            transcribe_recorded_audio,
            get_whisper_info,
            is_whisper_initialized,
            init_gpt_client,
            format_text_with_gpt,
            get_gpt_info,
            is_gpt_initialized,
            init_shortcut_mgr,
            auto_init_shortcut_mgr,
            toggle_record,
            toggle_record_with_tray,
            get_shortcut_status,
            register_global_shortcut,
            unregister_global_shortcut,
            update_global_shortcut,
            register_profile_shortcut,
            unregister_profile_shortcut,
            register_all_profile_shortcuts,
            unregister_all_profile_shortcuts,
            check_shortcut_available,
            init_clipboard_service,
            copy_to_clipboard,
            is_clipboard_initialized,
            get_clipboard_info,
            init_system_tray,
            show_main_window,
            hide_main_window,
            toggle_main_window,
            show_window_and_start_recording,
            handle_window_close,
            update_tray_status,
            is_window_hidden,
            update_tray_global_shortcut,
            open_settings_window,
            close_settings_window,
            is_settings_window_open,
            load_profiles,
            select_profile,
            get_active_profile,
            apply_profile_to_text,
            load_settings,
            save_settings,
            save_profiles,
            validate_shortcut_conflict,
            v1_save_settings,
            v1_save_profiles
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
