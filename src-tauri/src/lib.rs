pub mod audio;
pub mod commands;
pub mod config;
pub mod services;
pub mod state;
pub mod utils;

use commands::{
    acknowledge_error_via_state_machine, apply_profile_to_text, auto_init_shortcut_mgr,
    check_shortcut_available, close_settings_window, copy_to_clipboard,
    disable_auto_recovery_via_state_machine, enable_auto_recovery_via_state_machine,
    encode_wav_to_ogg, format_text_with_gpt, get_active_profile, get_clipboard_info,
    get_current_state, get_encoder_info, get_error_state, get_gpt_info, get_shortcut_status,
    get_whisper_info, handle_window_close, has_modal_window_open, hide_main_window,
    init_audio_capture, init_clipboard_service, init_gpt_client, init_shortcut_mgr,
    init_state_machine, init_system_tray, init_whisper_client, is_app_processing, is_app_recording,
    is_clipboard_initialized, is_gpt_initialized, is_recording, is_settings_window_open,
    is_whisper_initialized, is_window_hidden, load_profiles, load_settings, open_settings_window,
    register_all_profile_shortcuts, register_global_shortcut, register_profile_shortcut,
    reset_app_state_via_state_machine, retry_backend_connection, save_profiles, save_settings,
    select_profile, settings::ensure_default_configs, should_main_window_be_visible,
    show_main_window, show_window_and_start_recording, start_capture,
    start_recording_via_state_machine, stop_capture, stop_recording_and_process_to_clipboard,
    stop_recording_via_state_machine, subscribe_rms, test_api_key, toggle_main_window,
    toggle_record, toggle_record_with_tray, transcribe_audio, transcribe_recorded_audio,
    unregister_all_profile_shortcuts, unregister_global_shortcut, unregister_profile_shortcut,
    update_global_shortcut, update_tray_global_shortcut, update_tray_status, v1_save_profiles,
    v1_save_settings, validate_shortcut_conflict, AudioCaptureState, ClipboardServiceState,
    GptClientState, ProfileAppState, ShortcutMgrState, SystemTrayState, WhisperClientState,
};
use config::validate_config_files;
use state::{AppStateMachineBuilder, AppStateMachineState};
use std::sync::Arc;
use tauri::{AppHandle, Listener, Manager};
use tokio::sync::Mutex;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Setup event listeners for backend-internal communication
fn setup_backend_event_listeners(app_handle: AppHandle) {
    // Listen for global shortcut toggle record events
    let app_handle_clone = app_handle.clone();
    app_handle.listen("global_shortcut_toggle_record", move |_event| {
        let app_handle = app_handle_clone.clone();
        tauri::async_runtime::spawn(async move {
            // Route through the toggle_record_with_tray command which handles state machine
            match app_handle.try_state::<crate::state::AppStateMachineState>() {
                Some(state_machine_state) => match app_handle.try_state::<SystemTrayState>() {
                    Some(tray_state) => match app_handle.try_state::<AudioCaptureState>() {
                        Some(audio_state) => match app_handle.try_state::<WhisperClientState>() {
                            Some(whisper_state) => match app_handle.try_state::<ClipboardServiceState>() {
                                Some(clipboard_state) => match app_handle.try_state::<ProfileAppState>() {
                                    Some(profile_state) => match app_handle.try_state::<GptClientState>() {
                                        Some(gpt_state) => {
                                            if let Err(e) = toggle_record_with_tray(
                                                app_handle.clone(),
                                                state_machine_state,
                                                tray_state,
                                                audio_state,
                                                whisper_state,
                                                clipboard_state,
                                                profile_state,
                                                gpt_state,
                                            )
                                            .await
                                            {
                                                eprintln!("Failed to toggle recording from global shortcut: {}", e);
                                            }
                                        }
                                        None => eprintln!("GPT client state not found for global shortcut"),
                                    },
                                    None => eprintln!("Profile state not found for global shortcut"),
                                },
                                None => eprintln!("Clipboard service state not found for global shortcut"),
                            },
                            None => eprintln!("Whisper client state not found for global shortcut"),
                        },
                        None => eprintln!("Audio capture state not found for global shortcut"),
                    },
                    None => eprintln!("System tray state not found for global shortcut"),
                },
                None => eprintln!("State machine not found for global shortcut"),
            }
        });
    });

    // Listen for profile selection events from shortcuts
    let app_handle_clone = app_handle.clone();
    app_handle.listen("global_shortcut_select_profile", move |event| {
        let app_handle = app_handle_clone.clone();
        tauri::async_runtime::spawn(async move {
            // Access the payload directly as Value since it's already JSON
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                if let Some(profile_id) = data.get("profile_id").and_then(|v| v.as_str()) {
                    match app_handle.try_state::<ProfileAppState>() {
                        Some(profile_state) => {
                            if let Err(e) = select_profile(
                                profile_id.to_string(),
                                profile_state,
                                app_handle.clone(),
                            )
                            .await
                            {
                                eprintln!("Failed to select profile from global shortcut: {}", e);
                            }
                        }
                        None => eprintln!("Profile state not found for profile shortcut"),
                    }
                }
            } else {
                eprintln!("Failed to parse profile selection event payload");
            }
        });
    });

    // Listen for tray double click events
    let app_handle_clone = app_handle.clone();
    app_handle.listen("tray_double_click_show_and_record", move |_event| {
        let app_handle = app_handle_clone.clone();
        tauri::async_runtime::spawn(async move {
            // Show window and start recording through state machine
            match app_handle.try_state::<crate::state::AppStateMachineState>() {
                Some(state_machine_state) => {
                    // First show the window
                    if let Err(e) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::ShowMainWindow,
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!(
                            "Failed to process ShowMainWindow from tray double click: {}",
                            e
                        );
                    }

                    // Then start recording
                    if let Err(e) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::StartRecordingFromTray,
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!("Failed to process StartRecordingFromTray: {}", e);
                    }
                }
                None => eprintln!("State machine not found for tray double click"),
            }
        });
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ensure default configuration files exist
    if let Err(e) = tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(ensure_default_configs())
    {
        eprintln!("Failed to ensure default configs: {}", e);
        // Don't exit here, let the app continue
    }

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
        .manage(Arc::new(Mutex::new(None)) as AppStateMachineState)
        .manage(
            std::sync::Mutex::new(commands::profiles::ProfileState::default()) as ProfileAppState,
        )
        .setup(|app| {
            let app_handle = app.handle().clone();
            let app_handle_for_setup = app_handle.clone(); // Clone for setup function

            // Initialize state machine with proper initial state (hidden)
            tauri::async_runtime::spawn(async move {
                // Initialize the state machine with window initially hidden
                let state_machine = Arc::new(Mutex::new(
                    AppStateMachineBuilder::new()
                        .with_initial_state(crate::state::AppState::Idle {
                            main_window_visible: false, // Start hidden as expected
                        })
                        .build(app_handle.clone()),
                ));

                // Set the state machine in global state
                if let Some(state) = app_handle.try_state::<AppStateMachineState>() {
                    let mut state_guard = state.lock().await;
                    *state_guard = Some(state_machine);
                }
            });

            // Setup event listeners for backend communication
            setup_backend_event_listeners(app_handle_for_setup);

            Ok(())
        })
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
            v1_save_profiles,
            init_state_machine,
            get_current_state,
            is_app_recording,
            is_app_processing,
            should_main_window_be_visible,
            has_modal_window_open,
            start_recording_via_state_machine,
            stop_recording_via_state_machine,
            acknowledge_error_via_state_machine,
            disable_auto_recovery_via_state_machine,
            enable_auto_recovery_via_state_machine,
            get_error_state,
            reset_app_state_via_state_machine,
            retry_backend_connection,
            test_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
