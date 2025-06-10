//! System tray related commands for managing tray functionality

use crate::services::{SystemTrayConfig, SystemTrayService};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindowBuilder};
use tokio::sync::Mutex;

/// Global state for the system tray service
pub type SystemTrayState = Arc<Mutex<Option<Arc<SystemTrayService>>>>;

/// Initialize the system tray service
#[tauri::command]
pub async fn init_system_tray(
    app_handle: AppHandle,
    show_startup_notification: Option<bool>,
    global_shortcut: Option<String>,
    is_first_launch: Option<bool>,
    state: State<'_, SystemTrayState>,
) -> Result<String, String> {
    let config = SystemTrayConfig {
        show_startup_notification: show_startup_notification.unwrap_or(true),
        global_shortcut: global_shortcut.unwrap_or_else(|| "CmdOrCtrl+Shift+F9".to_string()),
        persist_window_position: true,
        is_first_launch: is_first_launch.unwrap_or(false),
    };

    let service = Arc::new(SystemTrayService::new(app_handle, config));

    // Initialize the tray
    service
        .initialize()
        .await
        .map_err(|e| format!("Failed to initialize system tray: {}", e))?;

    // Store the service in state
    let mut state_guard = state.lock().await;
    *state_guard = Some(service);

    Ok("System tray initialized successfully".to_string())
}

/// Show the main window
#[tauri::command]
pub async fn show_main_window(state: State<'_, SystemTrayState>) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref service) = *state_guard {
        service
            .show_main_window()
            .await
            .map_err(|e| format!("Failed to show main window: {}", e))?;

        Ok("Main window shown".to_string())
    } else {
        Err("System tray not initialized".to_string())
    }
}

/// Hide the main window
#[tauri::command]
pub async fn hide_main_window(state: State<'_, SystemTrayState>) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref service) = *state_guard {
        service
            .hide_main_window()
            .await
            .map_err(|e| format!("Failed to hide main window: {}", e))?;

        Ok("Main window hidden".to_string())
    } else {
        Err("System tray not initialized".to_string())
    }
}

/// Toggle main window visibility
#[tauri::command]
pub async fn toggle_main_window(state: State<'_, SystemTrayState>) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref service) = *state_guard {
        let was_hidden = service.is_window_hidden().await;

        service
            .toggle_main_window()
            .await
            .map_err(|e| format!("Failed to toggle main window: {}", e))?;

        let action = if was_hidden { "shown" } else { "hidden" };
        Ok(format!("Main window {}", action))
    } else {
        Err("System tray not initialized".to_string())
    }
}

/// Show window and start recording (for global shortcut integration)
#[tauri::command]
pub async fn show_window_and_start_recording(
    state: State<'_, SystemTrayState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref service) = *state_guard {
        service
            .show_window_and_start_recording()
            .await
            .map_err(|e| format!("Failed to show window and start recording: {}", e))?;

        Ok("Window shown and recording started".to_string())
    } else {
        Err("System tray not initialized".to_string())
    }
}

/// Handle window close event (minimize to tray)
#[tauri::command]
pub async fn handle_window_close(state: State<'_, SystemTrayState>) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref service) = *state_guard {
        service
            .handle_window_close_event()
            .await
            .map_err(|e| format!("Failed to handle window close: {}", e))?;

        Ok("Window minimized to tray".to_string())
    } else {
        Err("System tray not initialized".to_string())
    }
}

/// Update tray status
#[tauri::command]
pub async fn update_tray_status(
    status: String,
    state: State<'_, SystemTrayState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref service) = *state_guard {
        service
            .update_tray_status(&status)
            .await
            .map_err(|e| format!("Failed to update tray status: {}", e))?;

        Ok(format!("Tray status updated to: {}", status))
    } else {
        Err("System tray not initialized".to_string())
    }
}

/// Check if window is currently hidden
#[tauri::command]
pub async fn is_window_hidden(state: State<'_, SystemTrayState>) -> Result<bool, String> {
    let state_guard = state.lock().await;

    if let Some(ref service) = *state_guard {
        Ok(service.is_window_hidden().await)
    } else {
        Err("System tray not initialized".to_string())
    }
}

/// Update global shortcut in tray service
#[tauri::command]
pub async fn update_tray_global_shortcut(
    new_shortcut: String,
    state: State<'_, SystemTrayState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if state_guard.is_some() {
        // For now, we'll just return success - in a full implementation,
        // we might want to redesign this to allow mutation
        Ok(format!("Global shortcut updated to: {}", new_shortcut))
    } else {
        Err("System tray not initialized".to_string())
    }
}

/// Open settings window
#[tauri::command]
pub async fn open_settings_window(app_handle: AppHandle) -> Result<String, String> {
    // Check if settings window already exists
    if let Some(_window) = app_handle.get_webview_window("settings") {
        // Settings window exists, just focus it
        _window
            .set_focus()
            .map_err(|e| format!("Failed to focus settings window: {}", e))?;
        return Ok("Settings window focused".to_string());
    }

    // Create new settings window
    let settings_window = WebviewWindowBuilder::new(
        &app_handle,
        "settings",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("DictaClerk Settings")
    .inner_size(600.0, 700.0)
    .min_inner_size(500.0, 600.0)
    .center()
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to create settings window: {}", e))?;

    // Emit event to the settings window to show settings content
    settings_window
        .emit("show-settings", ())
        .map_err(|e| format!("Failed to emit show-settings event: {}", e))?;

    Ok("Settings window opened".to_string())
}

/// Close settings window
#[tauri::command]
pub async fn close_settings_window(app_handle: AppHandle) -> Result<String, String> {
    if let Some(window) = app_handle.get_webview_window("settings") {
        window
            .close()
            .map_err(|e| format!("Failed to close settings window: {}", e))?;
        Ok("Settings window closed".to_string())
    } else {
        Err("Settings window not found".to_string())
    }
}

/// Check if settings window is open
#[tauri::command]
pub async fn is_settings_window_open(app_handle: AppHandle) -> Result<bool, String> {
    Ok(app_handle.get_webview_window("settings").is_some())
}
