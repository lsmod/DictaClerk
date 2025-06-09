pub mod audio;
pub mod clipboard;
pub mod encoder;
pub mod profiles;
pub mod settings;
pub mod shortcut;
pub mod system_tray;
pub mod whisper;

pub use audio::{
    init_audio_capture, is_recording, start_capture, stop_capture, subscribe_rms, AudioCaptureState,
};
pub use clipboard::{
    copy_to_clipboard, get_clipboard_info, init_clipboard_service, is_clipboard_initialized,
    ClipboardServiceState,
};
pub use encoder::{encode_wav_to_ogg, get_encoder_info};
pub use profiles::{
    apply_profile_to_text, get_active_profile, load_profiles, select_profile, ProfileAppState,
};
pub use settings::{
    load_settings, save_profiles, save_settings, v1_save_profiles, v1_save_settings,
    validate_shortcut_conflict,
};
pub use shortcut::{
    auto_init_shortcut_mgr, check_shortcut_available, get_shortcut_status, init_shortcut_mgr,
    register_all_profile_shortcuts, register_global_shortcut, register_profile_shortcut,
    toggle_record, toggle_record_with_tray, unregister_all_profile_shortcuts,
    unregister_global_shortcut, unregister_profile_shortcut, update_global_shortcut,
    ShortcutMgrState,
};
pub use system_tray::{
    close_settings_window, handle_window_close, hide_main_window, init_system_tray,
    is_settings_window_open, is_window_hidden, open_settings_window, show_main_window,
    show_window_and_start_recording, toggle_main_window, update_tray_global_shortcut,
    update_tray_status, SystemTrayState,
};
pub use whisper::{
    get_whisper_info, init_whisper_client, is_whisper_initialized, transcribe_audio,
    transcribe_recorded_audio, WhisperClientState,
};

// New orchestration command for complete workflow
use crate::audio::AudioCapture;
use crate::services::ProfileEngine;
use tauri::State;

/// Complete workflow: Stop recording → Transcribe → Apply profile → Copy to clipboard
#[tauri::command]
pub async fn stop_recording_and_process_to_clipboard(
    audio_state: State<'_, AudioCaptureState>,
    whisper_state: State<'_, WhisperClientState>,
    clipboard_state: State<'_, ClipboardServiceState>,
    profile_state: State<'_, ProfileAppState>,
) -> Result<String, String> {
    eprintln!("🔄 Starting complete workflow...");

    // 1. Stop recording and get WAV file path
    eprintln!("📱 Step 1: Stopping recording...");
    let wav_path = {
        let audio_guard = audio_state.lock().await;
        if let Some(ref capture) = *audio_guard {
            if !capture.is_recording() {
                let error_msg = "Not currently recording";
                eprintln!("❌ Error: {}", error_msg);
                return Err(error_msg.to_string());
            }
            eprintln!("🛑 Stopping audio capture...");
            capture.stop_capture().await.map_err(|e| {
                let error_msg = format!("Failed to stop recording: {}", e);
                eprintln!("❌ Error: {}", error_msg);
                error_msg
            })?
        } else {
            let error_msg = "Audio capture not initialized";
            eprintln!("❌ Error: {}", error_msg);
            return Err(error_msg.to_string());
        }
    };
    eprintln!("✅ Step 1 complete: WAV file saved to {:?}", wav_path);

    // Debug: Additional WAV file information
    match tokio::fs::metadata(&wav_path).await {
        Ok(metadata) => {
            eprintln!("🔍 DEBUG: WAV file details:");
            eprintln!(
                "   📁 Full path: {:?}",
                wav_path.canonicalize().unwrap_or_else(|_| wav_path.clone())
            );
            eprintln!(
                "   📊 File size: {} bytes ({:.2} KB)",
                metadata.len(),
                metadata.len() as f64 / 1024.0
            );
            eprintln!(
                "   ⏰ Modified: {:?}",
                metadata
                    .modified()
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            );
        }
        Err(e) => {
            eprintln!("⚠️  Warning: Could not read WAV file metadata: {}", e);
        }
    }

    // 2. Get active profile ID first
    eprintln!("👤 Step 2: Getting active profile...");
    let active_profile_id = {
        let profile_guard = profile_state.lock().unwrap();
        profile_guard.active_profile_id.clone()
    }; // Guard is dropped here
    eprintln!(
        "✅ Step 2 complete: Active profile ID: {:?}",
        active_profile_id
    );

    // 3. Get profile prompt if available
    eprintln!("💭 Step 3: Loading profile prompt...");
    let prompt = if let Some(profile_id) = &active_profile_id {
        // Load profiles to get the profile data
        match load_profiles().await {
            Ok(profile_collection) => {
                let engine = ProfileEngine::new();
                engine
                    .find_profile_by_id(&profile_collection, profile_id)
                    .ok()
                    .and_then(|p| p.prompt.clone())
            }
            Err(e) => {
                eprintln!("⚠️  Warning: Failed to load profiles: {}", e);
                None
            }
        }
    } else {
        None
    };
    eprintln!("✅ Step 3 complete: Prompt: {:?}", prompt);

    // 4. Check if whisper client is initialized
    eprintln!("🤖 Step 4: Checking Whisper client...");
    {
        let whisper_guard = whisper_state.lock().await;
        if whisper_guard.is_none() {
            let error_msg =
                "Whisper client not initialized. Please check your API key in settings.";
            eprintln!("❌ Error: {}", error_msg);
            return Err(error_msg.to_string());
        }
    } // Drop the guard here
    eprintln!("✅ Step 4 complete: Whisper client is ready");

    // 5. Transcribe the WAV file using Whisper
    eprintln!("🎙️  Step 5: Transcribing audio...");
    let transcript = transcribe_recorded_audio(
        wav_path.to_string_lossy().to_string(),
        prompt,
        whisper_state,
    )
    .await
    .map_err(|e| {
        let error_msg = format!("Transcription failed: {}", e);
        eprintln!("❌ Error: {}", error_msg);
        error_msg
    })?;
    eprintln!(
        "✅ Step 5 complete: Transcribed {} characters",
        transcript.text.len()
    );

    // 6. Apply active profile to the transcribed text
    eprintln!("⚙️  Step 6: Applying profile formatting...");
    let processed_text = if let Some(active_profile_id) = active_profile_id {
        // Apply profile using the existing apply_profile_to_text command
        apply_profile_to_text(active_profile_id, transcript.text)
            .await
            .map_err(|e| {
                let error_msg = format!("Profile application failed: {}", e);
                eprintln!("❌ Error: {}", error_msg);
                error_msg
            })?
    } else {
        // No active profile, use raw transcript
        eprintln!("ℹ️  No active profile, using raw transcript");
        transcript.text
    };
    eprintln!(
        "✅ Step 6 complete: Processed {} characters",
        processed_text.len()
    );

    // 7. Copy processed text to clipboard
    eprintln!("📋 Step 7: Copying to clipboard...");
    eprintln!("🔍 DEBUG: Clipboard content analysis:");
    eprintln!("   📊 Text length: {} characters", processed_text.len());
    eprintln!("   📊 Text bytes: {} bytes", processed_text.len());
    if !processed_text.is_empty() {
        let preview_len = std::cmp::min(100, processed_text.len());
        eprintln!(
            "   📝 First {} chars: {:?}",
            preview_len,
            &processed_text[..preview_len]
        );
        if processed_text.len() > 100 {
            let end_start = std::cmp::max(0, processed_text.len().saturating_sub(50));
            eprintln!("   📝 Last 50 chars: {:?}", &processed_text[end_start..]);
        }
        eprintln!("   🔤 Contains newlines: {}", processed_text.contains('\n'));
        eprintln!("   🔤 Contains tabs: {}", processed_text.contains('\t'));
        eprintln!("   🔤 Non-ASCII chars: {}", !processed_text.is_ascii());
    } else {
        eprintln!("   ⚠️  WARNING: Empty text being copied to clipboard!");
    }

    {
        let clipboard_guard = clipboard_state.lock().await;
        if let Some(ref clipboard) = *clipboard_guard {
            eprintln!("   📋 Attempting clipboard copy...");
            clipboard.copy(&processed_text).await.map_err(|e| {
                let error_msg = format!("Failed to copy to clipboard: {}", e);
                eprintln!("❌ Error: {}", error_msg);
                error_msg
            })?;
            eprintln!("   ✅ Clipboard copy operation completed successfully");
        } else {
            let error_msg = "Clipboard service not initialized";
            eprintln!("❌ Error: {}", error_msg);
            return Err(error_msg.to_string());
        }
    }
    eprintln!("✅ Step 7 complete: Text copied to clipboard");

    // 8. Clean up temporary WAV file
    eprintln!("🧹 Step 8: Cleaning up temporary files...");
    if let Err(e) = tokio::fs::remove_file(&wav_path).await {
        eprintln!("⚠️  Warning: Failed to clean up temporary WAV file: {}", e);
    } else {
        eprintln!("✅ Step 8 complete: Temporary file cleaned up");
    }

    let success_msg = "Transcription copied to clipboard";
    eprintln!("🎉 Workflow complete: {}", success_msg);
    Ok(success_msg.to_string())
}
