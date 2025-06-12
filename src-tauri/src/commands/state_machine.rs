//! State machine related commands for managing global application state

use crate::audio::capture::AudioCapture;
use crate::state::{AppEvent, AppStateMachineBuilder, AppStateMachineState};
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

/// Initialize the application state machine
#[tauri::command]
pub async fn init_state_machine(
    app_handle: AppHandle,
    state: State<'_, AppStateMachineState>,
) -> Result<String, String> {
    let state_machine = Arc::new(Mutex::new(
        AppStateMachineBuilder::new().build(app_handle.clone()),
    ));

    let mut state_guard = state.lock().await;
    *state_guard = Some(state_machine);

    Ok("State machine initialized successfully".to_string())
}

/// Process an event through the state machine
pub async fn process_event(
    event: AppEvent,
    state: &State<'_, AppStateMachineState>,
) -> Result<(), String> {
    let state_guard = state.lock().await;

    if let Some(ref state_machine) = *state_guard {
        let mut machine_guard = state_machine.lock().await;
        machine_guard
            .process_event(event)
            .await
            .map_err(|e| format!("Failed to process state machine event: {}", e))?;
        Ok(())
    } else {
        Err("State machine not initialized".to_string())
    }
}

/// Get the current state from the state machine (for debugging)
#[tauri::command]
pub async fn get_current_state(state: State<'_, AppStateMachineState>) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref state_machine) = *state_guard {
        let machine_guard = state_machine.lock().await;
        Ok(format!("{:?}", machine_guard.current_state()))
    } else {
        Err("State machine not initialized".to_string())
    }
}

/// Check if the application is currently recording
#[tauri::command]
pub async fn is_app_recording(state: State<'_, AppStateMachineState>) -> Result<bool, String> {
    let state_guard = state.lock().await;

    if let Some(ref state_machine) = *state_guard {
        let machine_guard = state_machine.lock().await;
        Ok(machine_guard.is_recording())
    } else {
        Err("State machine not initialized".to_string())
    }
}

/// Check if the application is currently processing
#[tauri::command]
pub async fn is_app_processing(state: State<'_, AppStateMachineState>) -> Result<bool, String> {
    let state_guard = state.lock().await;

    if let Some(ref state_machine) = *state_guard {
        let machine_guard = state_machine.lock().await;
        Ok(machine_guard.is_processing())
    } else {
        Err("State machine not initialized".to_string())
    }
}

/// Check if main window should be visible according to state machine
#[tauri::command]
pub async fn should_main_window_be_visible(
    state: State<'_, AppStateMachineState>,
) -> Result<bool, String> {
    let state_guard = state.lock().await;

    if let Some(ref state_machine) = *state_guard {
        let machine_guard = state_machine.lock().await;
        Ok(machine_guard.is_main_window_visible())
    } else {
        Err("State machine not initialized".to_string())
    }
}

/// Check if any modal window is open according to state machine
#[tauri::command]
pub async fn has_modal_window_open(state: State<'_, AppStateMachineState>) -> Result<bool, String> {
    let state_guard = state.lock().await;

    if let Some(ref state_machine) = *state_guard {
        let machine_guard = state_machine.lock().await;
        Ok(machine_guard.has_modal_window_open())
    } else {
        Err("State machine not initialized".to_string())
    }
}

/// Start recording through state machine
#[tauri::command]
pub async fn start_recording_via_state_machine(
    state: State<'_, AppStateMachineState>,
    audio_state: State<'_, crate::commands::AudioCaptureState>,
) -> Result<String, String> {
    // Process event through state machine first
    process_event(crate::state::AppEvent::StartRecording, &state).await?;

    // Then actually start the audio capture
    let audio_guard = audio_state.lock().await;
    if let Some(ref capture) = *audio_guard {
        capture
            .start_capture()
            .await
            .map_err(|e| format!("Failed to start audio capture: {}", e))?;
        Ok("Recording started".to_string())
    } else {
        Err("Audio capture not initialized".to_string())
    }
}

/// Stop recording through state machine
#[tauri::command]
pub async fn stop_recording_via_state_machine(
    state: State<'_, AppStateMachineState>,
    audio_state: State<'_, crate::commands::AudioCaptureState>,
) -> Result<String, String> {
    // Process event through state machine first
    process_event(crate::state::AppEvent::StopRecording, &state).await?;

    // Then actually stop the audio capture
    let audio_guard = audio_state.lock().await;
    if let Some(ref capture) = *audio_guard {
        let path = capture
            .stop_capture()
            .await
            .map_err(|e| format!("Failed to stop audio capture: {}", e))?;
        Ok(format!(
            "Recording stopped. File: {}",
            path.to_string_lossy()
        ))
    } else {
        Err("Audio capture not initialized".to_string())
    }
}
