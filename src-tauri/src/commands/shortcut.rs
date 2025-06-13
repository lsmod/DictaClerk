//! Shortcut-related commands for managing global keyboard shortcuts

use crate::audio::capture::AudioCapture;
use crate::commands::{AudioCaptureState, SystemTrayState};
use crate::services::{ShortcutMgr, ShortcutMgrConfig};
use crate::state::AppStateMachineState;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

/// Global state for the shortcut manager
pub type ShortcutMgrState = Arc<Mutex<Option<Arc<ShortcutMgr>>>>;

/// Global state for debouncing shortcut calls
static LAST_SHORTCUT_CALL: std::sync::Mutex<Option<Instant>> = std::sync::Mutex::new(None);

/// Load global shortcut from settings.json
fn load_global_shortcut_from_settings() -> String {
    use crate::utils::find_config_file_path;

    // Use the proper config file path resolution
    if let Some(settings_path) = find_config_file_path("settings.json") {
        if let Ok(content) = std::fs::read_to_string(&settings_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(shortcut) = json.get("global_shortcut").and_then(|v| v.as_str()) {
                    println!("Loaded global shortcut from settings: {}", shortcut);
                    return shortcut.to_string();
                }
            }
        }
    }

    // Default shortcut if settings file not found or doesn't contain shortcut
    println!("Using default global shortcut: CmdOrCtrl+Shift+F9");
    "CmdOrCtrl+Shift+F9".to_string()
}

/// Initialize the shortcut manager
#[tauri::command]
pub async fn init_shortcut_mgr(
    app_handle: AppHandle,
    global_shortcut: Option<String>,
    state: State<'_, ShortcutMgrState>,
) -> Result<String, String> {
    let shortcut = global_shortcut.unwrap_or_else(load_global_shortcut_from_settings);

    let config = ShortcutMgrConfig {
        global_shortcut: shortcut.clone(),
        show_error_toasts: true,
    };

    let mgr = Arc::new(ShortcutMgr::new(app_handle, config));

    // Register the shortcut immediately
    if let Err(e) = mgr.register_hotkey().await {
        return Err(format!(
            "Failed to register global shortcut '{}': {}",
            shortcut, e
        ));
    }

    let mut state_guard = state.lock().await;
    *state_guard = Some(mgr);

    Ok(format!(
        "Shortcut manager initialized with shortcut: {}",
        shortcut
    ))
}

/// Auto-initialize shortcut manager during app startup
#[tauri::command]
pub async fn auto_init_shortcut_mgr(
    app_handle: AppHandle,
    state: State<'_, ShortcutMgrState>,
) -> Result<String, String> {
    init_shortcut_mgr(app_handle, None, state).await
}

/// Toggle recording state with tray icon update
/// This is the command called by the global shortcut
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn toggle_record_with_tray(
    _app_handle: AppHandle,
    state_machine_state: State<'_, AppStateMachineState>,
    tray_state: State<'_, SystemTrayState>,
    audio_state: State<'_, crate::commands::AudioCaptureState>,
    whisper_state: State<'_, crate::commands::WhisperClientState>,
    clipboard_state: State<'_, crate::commands::ClipboardServiceState>,
    profile_state: State<'_, crate::commands::ProfileAppState>,
    gpt_state: State<'_, crate::commands::GptClientState>,
) -> Result<String, String> {
    println!("🎯 [SHORTCUT] toggle_record_with_tray called");

    // Debounce rapid calls (prevent double-triggering)
    const DEBOUNCE_DURATION: Duration = Duration::from_millis(500);
    let now = Instant::now();

    {
        let mut last_call = LAST_SHORTCUT_CALL.lock().unwrap();
        if let Some(last_time) = *last_call {
            if now.duration_since(last_time) < DEBOUNCE_DURATION {
                println!("🚫 [SHORTCUT] Debounced - too soon after last call");
                return Ok("Shortcut call debounced".to_string());
            }
        }
        *last_call = Some(now);
    }

    // Check if settings window is open - if so, completely ignore the shortcut
    // COMMENTED OUT: This causes race conditions between window closing and state machine updates
    // if app_handle.get_webview_window("settings").is_some() {
    //     println!("🚫 [SHORTCUT] Settings window open - ignoring shortcut");
    //     return Ok("Global shortcut ignored - settings window is open".to_string());
    // }

    // Check if we're in SettingsWindowOpen state - use state machine as single source of truth
    {
        let state_guard = state_machine_state.lock().await;
        if let Some(ref state_machine) = *state_guard {
            let machine_guard = state_machine.lock().await;
            let current_state = machine_guard.current_state();
            println!(
                "🔍 [SHORTCUT] Current state machine state: {:?}",
                current_state
            );

            if matches!(
                current_state,
                crate::state::AppState::SettingsWindowOpen { .. }
            ) {
                println!("🚫 [SHORTCUT] In settings window state - ignoring shortcut");
                return Ok("Global shortcut ignored - in settings window state".to_string());
            } else {
                println!("✅ [SHORTCUT] Not in settings window state, proceeding...");
            }
        } else {
            println!("❌ [SHORTCUT] State machine not found");
        }
    }

    // Get current state from state machine (source of truth)
    let current_state = {
        let state_guard = state_machine_state.lock().await;
        if let Some(ref state_machine) = *state_guard {
            let machine_guard = state_machine.lock().await;
            let state = machine_guard.current_state().clone();
            println!("📋 [SHORTCUT] Current state machine state: {:?}", state);
            state
        } else {
            println!("❌ [SHORTCUT] State machine not initialized");
            return Err("State machine not initialized".to_string());
        }
    };

    // Check if window is hidden and show it if needed
    let is_window_hidden = {
        let tray_guard = tray_state.lock().await;
        if let Some(ref service) = *tray_guard {
            service.is_window_hidden().await
        } else {
            false
        }
    };

    if is_window_hidden {
        println!("👁️ [SHORTCUT] Window is hidden, showing it first...");
        // Process show window event through state machine
        if let Err(e) = crate::commands::state_machine::process_event(
            crate::state::AppEvent::ShowMainWindow,
            &state_machine_state,
        )
        .await
        {
            eprintln!("Warning: Failed to process ShowMainWindow event: {}", e);
        }

        // Show the window using tray service
        let tray_guard = tray_state.lock().await;
        if let Some(ref service) = *tray_guard {
            service
                .show_main_window()
                .await
                .map_err(|e| format!("Failed to show main window: {}", e))?;
        }
    }

    // Handle recording toggle based on current state machine state
    match current_state {
        crate::state::AppState::Idle { .. } | crate::state::AppState::ProcessingComplete { .. } => {
            // Start recording (from Idle or ProcessingComplete state)
            println!(
                "🎙️ [SHORTCUT] Starting recording from {:?} state...",
                if matches!(current_state, crate::state::AppState::Idle { .. }) {
                    "Idle"
                } else {
                    "ProcessingComplete"
                }
            );

            // Process start recording event through state machine
            if let Err(e) = crate::commands::state_machine::process_event(
                crate::state::AppEvent::ToggleRecording,
                &state_machine_state,
            )
            .await
            {
                return Err(format!("Failed to process start recording event: {}", e));
            }

            // Actually start the audio capture
            let audio_guard = audio_state.lock().await;
            if let Some(ref capture) = *audio_guard {
                let path = capture
                    .start_capture()
                    .await
                    .map_err(|e| format!("Failed to start audio capture: {}", e))?;
                println!("✅ [SHORTCUT] Recording started successfully");
                Ok(format!(
                    "Recording started. File: {}",
                    path.to_string_lossy()
                ))
            } else {
                Err("Audio capture not initialized".to_string())
            }
        }
        crate::state::AppState::Recording { .. } => {
            // Stop recording
            println!("🛑 [SHORTCUT] Stopping recording from Recording state...");

            // Process stop recording event through state machine
            if let Err(e) = crate::commands::state_machine::process_event(
                crate::state::AppEvent::ToggleRecording,
                &state_machine_state,
            )
            .await
            {
                return Err(format!("Failed to process stop recording event: {}", e));
            }

            // Instead of just stopping audio capture, trigger the full processing workflow
            println!("🔄 [SHORTCUT] Triggering full processing workflow...");
            println!("🔍 [SHORTCUT] This should start transcription and processing");

            // Call the same command that the stop button uses
            match crate::commands::stop_recording_and_process_to_clipboard(
                audio_state,
                whisper_state,
                clipboard_state,
                profile_state,
                gpt_state,
                state_machine_state,
            )
            .await
            {
                Ok(result) => {
                    println!(
                        "✅ [SHORTCUT] Full processing workflow completed: {}",
                        result
                    );
                    Ok(result)
                }
                Err(e) => {
                    println!("❌ [SHORTCUT] Full processing workflow failed: {}", e);
                    Err(e)
                }
            }
        }
        _ => {
            // In actual processing states (not ProcessingComplete) - ignore toggle
            println!("⏸️ [SHORTCUT] In processing state - ignoring toggle recording");
            Ok("Recording toggle ignored - app is processing".to_string())
        }
    }
}

/// Toggle recording state - original function for backward compatibility
#[tauri::command]
pub async fn toggle_record(audio_state: State<'_, AudioCaptureState>) -> Result<String, String> {
    let state_guard = audio_state.lock().await;

    if let Some(ref capture) = *state_guard {
        let is_currently_recording = capture.is_recording();

        if is_currently_recording {
            // Stop recording
            let path = capture
                .stop_capture()
                .await
                .map_err(|e| format!("Failed to stop capture: {}", e))?;

            Ok(format!(
                "Recording stopped. File saved: {}",
                path.to_string_lossy()
            ))
        } else {
            // Start recording
            let path = capture
                .start_capture()
                .await
                .map_err(|e| format!("Failed to start capture: {}", e))?;

            Ok(format!(
                "Recording started. Temp file: {}",
                path.to_string_lossy()
            ))
        }
    } else {
        Err("Audio capture not initialized".to_string())
    }
}

/// Get shortcut manager status
#[tauri::command]
pub async fn get_shortcut_status(
    state: State<'_, ShortcutMgrState>,
) -> Result<serde_json::Value, String> {
    let state_guard = state.lock().await;

    if let Some(ref mgr) = *state_guard {
        let is_registered = mgr.is_registered().await;
        let shortcut = mgr.get_shortcut();

        Ok(serde_json::json!({
            "initialized": true,
            "registered": is_registered,
            "shortcut": shortcut,
            "status": if is_registered { "active" } else { "inactive" }
        }))
    } else {
        Ok(serde_json::json!({
            "initialized": false,
            "registered": false,
            "shortcut": null,
            "status": "not_initialized"
        }))
    }
}

/// Register global shortcut
#[tauri::command]
pub async fn register_global_shortcut(
    state: State<'_, ShortcutMgrState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref mgr) = *state_guard {
        mgr.register_hotkey()
            .await
            .map_err(|e| format!("Failed to register shortcut: {}", e))?;

        Ok(format!(
            "Global shortcut '{}' registered successfully",
            mgr.get_shortcut()
        ))
    } else {
        Err("Shortcut manager not initialized".to_string())
    }
}

/// Unregister global shortcut
#[tauri::command]
pub async fn unregister_global_shortcut(
    state: State<'_, ShortcutMgrState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref mgr) = *state_guard {
        mgr.unregister()
            .await
            .map_err(|e| format!("Failed to unregister shortcut: {}", e))?;

        Ok("Global shortcut unregistered successfully".to_string())
    } else {
        Err("Shortcut manager not initialized".to_string())
    }
}

/// Update global shortcut
#[tauri::command]
pub async fn update_global_shortcut(
    new_shortcut: String,
    state: State<'_, ShortcutMgrState>,
) -> Result<String, String> {
    let mut state_guard = state.lock().await;

    if let Some(ref mgr) = state_guard.clone() {
        // Create a new manager with the updated shortcut
        let config = ShortcutMgrConfig {
            global_shortcut: new_shortcut.clone(),
            show_error_toasts: true,
        };

        // Unregister the old shortcut
        if let Err(e) = mgr.unregister().await {
            eprintln!("Warning: Failed to unregister old shortcut: {}", e);
        }

        // Create new manager and register new shortcut
        let new_mgr = Arc::new(ShortcutMgr::new(mgr.get_app_handle().clone(), config));

        new_mgr
            .register_hotkey()
            .await
            .map_err(|e| format!("Failed to register new shortcut: {}", e))?;

        // Update the state
        *state_guard = Some(new_mgr);

        Ok(format!("Global shortcut updated to '{}'", new_shortcut))
    } else {
        Err("Shortcut manager not initialized".to_string())
    }
}

/// Register a profile shortcut
#[tauri::command]
pub async fn register_profile_shortcut(
    profile_id: String,
    shortcut: String,
    state: State<'_, ShortcutMgrState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref mgr) = *state_guard {
        mgr.register_profile_shortcut(profile_id.clone(), shortcut.clone())
            .await
            .map_err(|e| format!("Failed to register profile shortcut: {}", e))?;

        Ok(format!(
            "Profile shortcut '{}' registered for profile '{}'",
            shortcut, profile_id
        ))
    } else {
        Err("Shortcut manager not initialized".to_string())
    }
}

/// Unregister a profile shortcut
#[tauri::command]
pub async fn unregister_profile_shortcut(
    profile_id: String,
    state: State<'_, ShortcutMgrState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref mgr) = *state_guard {
        mgr.unregister_profile_shortcut(&profile_id)
            .await
            .map_err(|e| format!("Failed to unregister profile shortcut: {}", e))?;

        Ok(format!(
            "Profile shortcut unregistered for profile '{}'",
            profile_id
        ))
    } else {
        Err("Shortcut manager not initialized".to_string())
    }
}

/// Register all profile shortcuts from profiles.json
#[tauri::command]
pub async fn register_all_profile_shortcuts(
    state: State<'_, ShortcutMgrState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref mgr) = *state_guard {
        // Load profiles from profiles.json
        let profiles_content = load_profiles_json()?;
        let profile_engine = crate::services::ProfileEngine::new();
        let profiles = profile_engine
            .load_profiles_from_json(&profiles_content)
            .map_err(|e| format!("Failed to parse profiles: {}", e))?;

        mgr.register_profile_shortcuts(&profiles)
            .await
            .map_err(|e| format!("Failed to register profile shortcuts: {}", e))?;

        let shortcut_count = profiles
            .profiles
            .iter()
            .filter(|p| p.shortcut.is_some() && !p.shortcut.as_ref().unwrap().trim().is_empty())
            .count();

        Ok(format!("Registered {} profile shortcuts", shortcut_count))
    } else {
        Err("Shortcut manager not initialized".to_string())
    }
}

/// Unregister all profile shortcuts
#[tauri::command]
pub async fn unregister_all_profile_shortcuts(
    state: State<'_, ShortcutMgrState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref mgr) = *state_guard {
        mgr.unregister_all_profile_shortcuts()
            .await
            .map_err(|e| format!("Failed to unregister profile shortcuts: {}", e))?;

        Ok("All profile shortcuts unregistered".to_string())
    } else {
        Err("Shortcut manager not initialized".to_string())
    }
}

/// Check if a shortcut is available (not conflicting)
#[tauri::command]
pub async fn check_shortcut_available(
    shortcut: String,
    state: State<'_, ShortcutMgrState>,
) -> Result<bool, String> {
    let state_guard = state.lock().await;

    if let Some(ref mgr) = *state_guard {
        let is_registered = mgr.is_shortcut_registered(&shortcut).await;
        Ok(!is_registered)
    } else {
        // If shortcut manager is not initialized, we can't check conflicts
        Ok(true)
    }
}

/// Helper function to load profiles.json content
fn load_profiles_json() -> Result<String, String> {
    use crate::utils::find_config_file_path;

    let profiles_path = find_config_file_path("profiles.json")
        .ok_or_else(|| "Could not determine profiles.json path".to_string())?;

    std::fs::read_to_string(&profiles_path)
        .map_err(|e| format!("Failed to read {}: {}", profiles_path.display(), e))
}
