//! Shortcut-related commands for managing global keyboard shortcuts

use crate::audio::capture::AudioCapture;
use crate::commands::{AudioCaptureState, SystemTrayState};
use crate::services::{ShortcutMgr, ShortcutMgrConfig};
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

/// Global state for the shortcut manager
pub type ShortcutMgrState = Arc<Mutex<Option<Arc<ShortcutMgr>>>>;

/// Load global shortcut from settings.json
fn load_global_shortcut_from_settings() -> String {
    let settings_paths = vec!["settings.json", "../settings.json", "../../settings.json"];

    for path in &settings_paths {
        if std::path::Path::new(path).exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(shortcut) = json.get("global_shortcut").and_then(|v| v.as_str()) {
                        return shortcut.to_string();
                    }
                }
            }
        }
    }

    // Try current directory approach
    if let Ok(current_dir) = std::env::current_dir() {
        let settings_in_current = current_dir.join("settings.json");
        if settings_in_current.exists() {
            if let Ok(content) = std::fs::read_to_string(&settings_in_current) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(shortcut) = json.get("global_shortcut").and_then(|v| v.as_str()) {
                        return shortcut.to_string();
                    }
                }
            }
        }
    }

    // Default shortcut
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

/// Toggle recording state with system tray integration - this is called by the global shortcut
#[tauri::command]
pub async fn toggle_record_with_tray(
    state_machine_state: State<'_, crate::state::AppStateMachineState>,
    tray_state: State<'_, SystemTrayState>,
) -> Result<String, String> {
    // First check if window is hidden
    let is_window_hidden = {
        let tray_guard = tray_state.lock().await;
        if let Some(ref service) = *tray_guard {
            service.is_window_hidden().await
        } else {
            false
        }
    };

    // If window is hidden, show it first
    if is_window_hidden {
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

    // Process toggle recording event through state machine
    if let Err(e) = crate::commands::state_machine::process_event(
        crate::state::AppEvent::ToggleRecording,
        &state_machine_state,
    )
    .await
    {
        return Err(format!("Failed to process toggle recording event: {}", e));
    }

    Ok("Recording toggled through state machine".to_string())
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
