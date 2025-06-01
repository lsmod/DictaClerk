use crate::audio::{AudioCapture, LiveAudioCapture};
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

/// Global state for the audio capture service
pub type AudioCaptureState = Arc<Mutex<Option<Arc<LiveAudioCapture>>>>;

/// Initialize the audio capture service
#[tauri::command]
pub async fn init_audio_capture(
    app_handle: AppHandle,
    state: State<'_, AudioCaptureState>,
) -> Result<String, String> {
    let capture = LiveAudioCapture::new(app_handle)
        .map_err(|e| format!("Failed to initialize audio capture: {}", e))?;

    let mut state_guard = state.lock().await;
    *state_guard = Some(Arc::new(capture));

    Ok("Audio capture initialized successfully".to_string())
}

/// Start audio capture
#[tauri::command]
pub async fn start_capture(state: State<'_, AudioCaptureState>) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref capture) = *state_guard {
        let path = capture
            .start_capture()
            .await
            .map_err(|e| format!("Failed to start capture: {}", e))?;

        Ok(path.to_string_lossy().to_string())
    } else {
        Err("Audio capture not initialized".to_string())
    }
}

/// Stop audio capture
#[tauri::command]
pub async fn stop_capture(state: State<'_, AudioCaptureState>) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref capture) = *state_guard {
        let path = capture
            .stop_capture()
            .await
            .map_err(|e| format!("Failed to stop capture: {}", e))?;

        Ok(path.to_string_lossy().to_string())
    } else {
        Err("Audio capture not initialized".to_string())
    }
}

/// Check if currently recording
#[tauri::command]
pub async fn is_recording(state: State<'_, AudioCaptureState>) -> Result<bool, String> {
    let state_guard = state.lock().await;

    if let Some(ref capture) = *state_guard {
        Ok(capture.is_recording())
    } else {
        Ok(false)
    }
}

/// Subscribe to RMS updates (callback-based, the actual RMS data is sent via events)
#[tauri::command]
pub async fn subscribe_rms(state: State<'_, AudioCaptureState>) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref _capture) = *state_guard {
        // The RMS callback is handled internally and emits events to the frontend
        // This command just confirms subscription
        Ok("Subscribed to RMS updates".to_string())
    } else {
        Err("Audio capture not initialized".to_string())
    }
}
