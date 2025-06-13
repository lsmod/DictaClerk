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
    eprintln!("🎙️ [AUDIO-INIT] init_audio_capture called");

    // Check if already initialized
    {
        let state_guard = state.lock().await;
        if state_guard.is_some() {
            eprintln!("⚠️ [AUDIO-INIT] Audio capture already initialized");
            return Ok("Audio capture already initialized".to_string());
        }
    }

    eprintln!("🔧 [AUDIO-INIT] Creating new LiveAudioCapture instance...");
    let capture = LiveAudioCapture::new(app_handle).map_err(|e| {
        eprintln!("❌ [AUDIO-INIT] Failed to create LiveAudioCapture: {}", e);
        format!("Failed to initialize audio capture: {}", e)
    })?;

    eprintln!("✅ [AUDIO-INIT] LiveAudioCapture created successfully");
    eprintln!("🔒 [AUDIO-INIT] Storing audio capture in global state...");

    let mut state_guard = state.lock().await;
    *state_guard = Some(Arc::new(capture));

    eprintln!("🎉 [AUDIO-INIT] Audio capture initialization completed successfully");
    Ok("Audio capture initialized successfully".to_string())
}

/// Start audio capture
#[tauri::command]
pub async fn start_capture(state: State<'_, AudioCaptureState>) -> Result<String, String> {
    eprintln!("🚀 [AUDIO-START] start_capture called");

    let state_guard = state.lock().await;

    if let Some(ref capture) = *state_guard {
        eprintln!("📡 [AUDIO-START] Audio capture found, checking current status...");
        let already_recording = capture.is_recording();
        eprintln!("📊 [AUDIO-START] Already recording: {}", already_recording);

        if already_recording {
            eprintln!("⚠️ [AUDIO-START] Warning: Audio capture already recording");
        }

        eprintln!("🎙️ [AUDIO-START] Starting audio capture...");
        let path = capture.start_capture().await.map_err(|e| {
            eprintln!("❌ [AUDIO-START] Failed to start capture: {}", e);
            format!("Failed to start capture: {}", e)
        })?;

        let now_recording = capture.is_recording();
        eprintln!("✅ [AUDIO-START] Audio capture started successfully!");
        eprintln!("📊 [AUDIO-START] Now recording: {}", now_recording);
        eprintln!("📁 [AUDIO-START] Recording path: {:?}", path);

        Ok(path.to_string_lossy().to_string())
    } else {
        eprintln!("❌ [AUDIO-START] Audio capture not initialized");
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
        let recording = capture.is_recording();
        eprintln!("📊 [AUDIO-CHECK] is_recording check: {}", recording);
        Ok(recording)
    } else {
        eprintln!("❌ [AUDIO-CHECK] Audio capture not initialized, returning false");
        Ok(false)
    }
}

/// Subscribe to RMS updates (callback-based, the actual RMS data is sent via events)
#[tauri::command]
pub async fn subscribe_rms(state: State<'_, AudioCaptureState>) -> Result<String, String> {
    eprintln!("📡 [RMS-SUB] subscribe_rms called");

    let state_guard = state.lock().await;

    if let Some(ref capture) = *state_guard {
        let is_recording = capture.is_recording();
        eprintln!(
            "📊 [RMS-SUB] Audio capture found, currently recording: {}",
            is_recording
        );

        // The RMS callback is handled internally and emits events to the frontend
        // This command just confirms subscription
        eprintln!("✅ [RMS-SUB] RMS subscription confirmed");
        Ok("Subscribed to RMS updates".to_string())
    } else {
        eprintln!("❌ [RMS-SUB] Audio capture not initialized");
        Err("Audio capture not initialized".to_string())
    }
}
