//! Error recovery commands that integrate with the state machine

use crate::commands::state_machine::process_event;
use crate::state::{AppEvent, AppStateMachineState};
use tauri::{AppHandle, Emitter, State};

/// Acknowledge error and return to idle state through state machine
#[tauri::command]
pub async fn acknowledge_error_via_state_machine(
    state_machine_state: State<'_, AppStateMachineState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    // Process error acknowledgment through state machine
    process_event(AppEvent::AcknowledgeError, &state_machine_state).await?;

    // Emit event to frontend about error recovery
    if let Err(e) = app_handle.emit("error-acknowledged", ()) {
        eprintln!("Warning: Failed to emit error-acknowledged event: {}", e);
    }

    Ok("Error acknowledged and state reset to idle".to_string())
}

/// Reset application to idle state (hard reset)
#[tauri::command]
pub async fn reset_app_state_via_state_machine(
    state_machine_state: State<'_, AppStateMachineState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    // Process reset through state machine
    process_event(AppEvent::Reset, &state_machine_state).await?;

    // Emit event to frontend about state reset
    if let Err(e) = app_handle.emit("app-state-reset", ()) {
        eprintln!("Warning: Failed to emit app-state-reset event: {}", e);
    }

    Ok("Application state reset to idle".to_string())
}

/// Enable auto-recovery mode through state machine
#[tauri::command]
pub async fn enable_auto_recovery_via_state_machine(
    app_handle: AppHandle,
) -> Result<String, String> {
    // Emit auto-recovery changed event
    if let Err(e) = app_handle.emit(
        "auto-recovery-changed",
        serde_json::json!({ "enabled": true }),
    ) {
        eprintln!("Warning: Failed to emit auto-recovery-changed event: {}", e);
    }

    Ok("Auto-recovery mode enabled".to_string())
}

/// Disable auto-recovery mode through state machine
#[tauri::command]
pub async fn disable_auto_recovery_via_state_machine(
    app_handle: AppHandle,
) -> Result<String, String> {
    // Emit auto-recovery changed event
    if let Err(e) = app_handle.emit(
        "auto-recovery-changed",
        serde_json::json!({ "enabled": false }),
    ) {
        eprintln!("Warning: Failed to emit auto-recovery-changed event: {}", e);
    }

    Ok("Auto-recovery mode disabled".to_string())
}

/// Retry backend connection with proper error handling
#[tauri::command]
pub async fn retry_backend_connection(app_handle: AppHandle) -> Result<String, String> {
    // Emit connection retry event
    if let Err(e) = app_handle.emit("backend-connection-retry", ()) {
        eprintln!(
            "Warning: Failed to emit backend-connection-retry event: {}",
            e
        );
    }

    // The actual reconnection logic should be handled by the frontend
    // by re-establishing event listeners
    Ok("Backend connection retry initiated".to_string())
}

/// Get current error state from state machine
#[tauri::command]
pub async fn get_error_state(
    state_machine_state: State<'_, AppStateMachineState>,
) -> Result<String, String> {
    let state_guard = state_machine_state.lock().await;

    if let Some(ref state_machine) = *state_guard {
        let machine_guard = state_machine.lock().await;
        let current_state = machine_guard.current_state();

        // Check if current state is an error state using matches! macro
        let is_error_state = matches!(
            current_state,
            crate::state::recording_state_machine::AppState::TranscriptionError { .. }
                | crate::state::recording_state_machine::AppState::GPTFormattingError { .. }
                | crate::state::recording_state_machine::AppState::ClipboardError { .. }
                | crate::state::recording_state_machine::AppState::ProfileValidationError { .. }
        );

        if is_error_state {
            Ok(format!("Error state: {:?}", current_state))
        } else {
            Ok("No error state".to_string())
        }
    } else {
        Err("State machine not initialized".to_string())
    }
}
