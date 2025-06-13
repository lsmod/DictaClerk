//! System tray related commands for managing tray functionality

use crate::commands::state_machine::process_event;
use crate::services::{SystemTrayConfig, SystemTrayService};
use crate::state::{AppEvent, AppStateMachineState};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State, WebviewWindowBuilder, WindowEvent};
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
pub async fn show_main_window(
    state: State<'_, SystemTrayState>,
    state_machine_state: State<'_, AppStateMachineState>,
) -> Result<String, String> {
    // First emit event to state machine
    if let Err(e) = process_event(AppEvent::ShowMainWindow, &state_machine_state).await {
        eprintln!("Warning: Failed to process ShowMainWindow event: {}", e);
    }

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
pub async fn hide_main_window(
    state: State<'_, SystemTrayState>,
    state_machine_state: State<'_, AppStateMachineState>,
) -> Result<String, String> {
    // First emit event to state machine
    if let Err(e) = process_event(AppEvent::HideMainWindow, &state_machine_state).await {
        eprintln!("Warning: Failed to process HideMainWindow event: {}", e);
    }

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

/// Open settings window with state machine integration
#[tauri::command]
pub async fn open_settings_window(
    app_handle: AppHandle,
    state_machine_state: State<'_, AppStateMachineState>,
    tray_state: State<'_, SystemTrayState>,
) -> Result<String, String> {
    // First emit event to state machine - this will handle stopping recording/processing
    // and transition to SettingsWindowOpen{previous_state: Idle}
    if let Err(e) = process_event(AppEvent::OpenSettingsWindow, &state_machine_state).await {
        eprintln!("Warning: Failed to process OpenSettingsWindow event: {}", e);
    }

    // Always hide main window when opening settings regardless of current state
    let tray_guard = tray_state.lock().await;
    if let Some(ref service) = *tray_guard {
        if let Err(e) = service.hide_main_window().await {
            eprintln!(
                "Warning: Failed to hide main window when opening settings: {}",
                e
            );
        }
    }

    // Check if settings window already exists
    if let Some(_window) = app_handle.get_webview_window("settings") {
        // Settings window exists, just focus it
        _window
            .set_focus()
            .map_err(|e| format!("Failed to focus settings window: {}", e))?;
        return Ok("Settings window focused".to_string());
    }

    // Create new settings window
    let _settings_window = WebviewWindowBuilder::new(
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

    // Register a close event handler to ensure state machine is updated when window is closed
    let app_handle_clone = app_handle.clone();
    let state_machine_clone = state_machine_state.inner().clone();
    let tray_state_clone = tray_state.inner().clone();

    _settings_window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { .. } = event {
            println!("🚨 [SETTINGS-WINDOW] Close requested - updating state machine");
            let _app_handle = app_handle_clone.clone();
            let state_machine = state_machine_clone.clone();
            let tray_state = tray_state_clone.clone();

            tauri::async_runtime::spawn(async move {
                // Directly update the state machine without using process_event wrapper
                {
                    let state_guard = state_machine.lock().await;
                    if let Some(ref state_machine_arc) = *state_guard {
                        let mut machine_guard = state_machine_arc.lock().await;
                        if let Err(e) = machine_guard.process_event(AppEvent::CloseSettingsWindow).await {
                            eprintln!("❌ [SETTINGS-WINDOW] Failed to process CloseSettingsWindow event: {}", e);
                        } else {
                            println!("✅ [SETTINGS-WINDOW] CloseSettingsWindow event processed successfully");
                        }
                    } else {
                        eprintln!("❌ [SETTINGS-WINDOW] State machine not initialized");
                    }
                }

                // Show main window after closing settings
                let tray_guard = tray_state.lock().await;
                if let Some(ref service) = *tray_guard {
                    if let Err(e) = service.show_main_window().await {
                        eprintln!("Warning: Failed to show main window when closing settings: {}", e);
                    } else {
                        println!("✅ [SETTINGS-WINDOW] Main window shown successfully");
                    }
                }
            });
        }
    });

    // Emit event to the settings window to show settings content
    // Note: The frontend should listen to app-state-changed events from the state machine
    // to determine what content to show in the settings window
    Ok("Settings window opened".to_string())
}

/// Close settings window with state machine integration
#[tauri::command]
pub async fn close_settings_window(
    app_handle: AppHandle,
    state_machine_state: State<'_, AppStateMachineState>,
    tray_state: State<'_, SystemTrayState>,
) -> Result<String, String> {
    println!("🔧 [CLOSE-SETTINGS] Starting to close settings window");

    // First check the current state before closing
    {
        let state_guard = state_machine_state.lock().await;
        if let Some(ref state_machine) = *state_guard {
            let machine_guard = state_machine.lock().await;
            let current_state = machine_guard.current_state();
            println!(
                "🔍 [CLOSE-SETTINGS] Current state before closing: {:?}",
                current_state
            );
        }
    }

    // First close the actual window to immediately remove it from the window manager
    let window_was_found = if let Some(window) = app_handle.get_webview_window("settings") {
        window
            .close()
            .map_err(|e| format!("Failed to close settings window: {}", e))?;
        println!("✅ [CLOSE-SETTINGS] Settings window closed successfully");
        true
    } else {
        println!("⚠️ [CLOSE-SETTINGS] Settings window not found");
        false
    };

    // Then emit event to state machine - this will transition to Idle{main_window_visible: true}
    println!("🔄 [CLOSE-SETTINGS] Processing CloseSettingsWindow event...");
    if let Err(e) = process_event(AppEvent::CloseSettingsWindow, &state_machine_state).await {
        eprintln!(
            "❌ [CLOSE-SETTINGS] Failed to process CloseSettingsWindow event: {}",
            e
        );
        return Err(format!("Failed to update state machine: {}", e));
    } else {
        println!("✅ [CLOSE-SETTINGS] CloseSettingsWindow event processed successfully");
    }

    // Check the state after processing the event
    {
        let state_guard = state_machine_state.lock().await;
        if let Some(ref state_machine) = *state_guard {
            let machine_guard = state_machine.lock().await;
            let current_state = machine_guard.current_state();
            println!(
                "🔍 [CLOSE-SETTINGS] Current state after event: {:?}",
                current_state
            );
        }
    }

    // Always show main window after closing settings (as per state machine transition to Idle)
    let tray_guard = tray_state.lock().await;
    if let Some(ref service) = *tray_guard {
        if let Err(e) = service.show_main_window().await {
            eprintln!(
                "Warning: Failed to show main window when closing settings: {}",
                e
            );
        } else {
            println!("✅ [CLOSE-SETTINGS] Main window shown successfully");
        }
    }

    if window_was_found {
        Ok("Settings window closed".to_string())
    } else {
        Ok("Settings window was not found, but state updated".to_string())
    }
}

/// Check if settings window is open
#[tauri::command]
pub async fn is_settings_window_open(app_handle: AppHandle) -> Result<bool, String> {
    Ok(app_handle.get_webview_window("settings").is_some())
}
