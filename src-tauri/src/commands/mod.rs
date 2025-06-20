pub mod audio;
pub mod clipboard;
pub mod encoder;
pub mod error_recovery;
pub mod gpt;
pub mod profiles;
pub mod settings;
pub mod shortcut;
pub mod state_machine;
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
pub use error_recovery::{
    acknowledge_error_via_state_machine, disable_auto_recovery_via_state_machine,
    enable_auto_recovery_via_state_machine, get_error_state, reset_app_state_via_state_machine,
    retry_backend_connection,
};
pub use gpt::{
    format_text_with_gpt, get_gpt_info, init_gpt_client, is_gpt_initialized, GptClientState,
};
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
pub use state_machine::{
    get_current_state, has_modal_window_open, init_state_machine, is_app_processing,
    is_app_recording, should_main_window_be_visible, start_recording_via_state_machine,
    stop_recording_via_state_machine,
};
pub use system_tray::{
    close_settings_window, handle_window_close, hide_main_window, init_system_tray,
    is_settings_window_open, is_window_hidden, open_settings_window, show_main_window,
    show_window_and_start_recording, toggle_main_window, update_tray_global_shortcut,
    update_tray_status, SystemTrayState,
};
pub use whisper::{
    get_whisper_info, init_whisper_client, is_whisper_initialized, test_api_key, transcribe_audio,
    transcribe_recorded_audio, WhisperClientState,
};

// New orchestration command for complete workflow
use crate::audio::AudioCapture;
use crate::services::ProfileEngine;
use tauri::State;

/// Complete workflow: Stop recording → Transcribe → GPT-4 Format → Copy to clipboard
#[tauri::command]
pub async fn stop_recording_and_process_to_clipboard(
    audio_state: State<'_, AudioCaptureState>,
    whisper_state: State<'_, WhisperClientState>,
    clipboard_state: State<'_, ClipboardServiceState>,
    profile_state: State<'_, ProfileAppState>,
    gpt_state: State<'_, GptClientState>,
    state_machine_state: State<'_, crate::state::AppStateMachineState>,
) -> Result<String, String> {
    eprintln!("🔄 [PROCESSING] Starting complete workflow...");
    eprintln!(
        "📊 [PROCESSING] Function called from: {}",
        std::backtrace::Backtrace::force_capture()
    );

    // 1. Stop recording and get WAV file path
    eprintln!("📱 [PROCESSING] Step 1: Stopping recording...");

    // Emit state transition to ProcessingTranscription
    if let Err(e) = crate::commands::state_machine::process_event(
        crate::state::AppEvent::StopRecording,
        &state_machine_state,
    )
    .await
    {
        eprintln!(
            "⚠️  Warning: Failed to transition to processing state: {}",
            e
        );
    }

    let wav_path = {
        let audio_guard = audio_state.lock().await;
        if let Some(ref capture) = *audio_guard {
            if !capture.is_recording() {
                let error_msg = "Not currently recording";
                eprintln!("❌ [PROCESSING] Error: {}", error_msg);

                // Emit error state
                if let Err(e) = crate::commands::state_machine::process_event(
                    crate::state::AppEvent::TranscriptionError {
                        error: error_msg.to_string(),
                    },
                    &state_machine_state,
                )
                .await
                {
                    eprintln!("⚠️  Warning: Failed to emit error state: {}", e);
                }

                return Err(error_msg.to_string());
            }
            eprintln!("🛑 [PROCESSING] Stopping audio capture...");
            capture.stop_capture().await.map_err(|e| {
                let error_msg = format!("Failed to stop recording: {}", e);
                eprintln!("❌ [PROCESSING] Error: {}", error_msg);
                error_msg
            })?
        } else {
            let error_msg = "Audio capture not initialized";
            eprintln!("❌ [PROCESSING] Error: {}", error_msg);
            return Err(error_msg.to_string());
        }
    };
    eprintln!(
        "✅ [PROCESSING] Step 1 complete: WAV file saved to {:?}",
        wav_path
    );

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

    // 3. Load profile data if available
    eprintln!("💭 Step 3: Loading profile data...");
    let (profile_data, prompt) = if let Some(profile_id) = &active_profile_id {
        // Load profiles to get the profile data
        match load_profiles().await {
            Ok(profile_collection) => {
                let engine = ProfileEngine::new();
                match engine.find_profile_by_id(&profile_collection, profile_id) {
                    Ok(profile) => {
                        let prompt = profile.prompt.as_ref().map(|s| s.to_string());
                        eprintln!("✅ Found profile: {} (ID: {})", profile.name, profile.id);
                        (Some(profile.clone()), prompt)
                    }
                    Err(e) => {
                        eprintln!("⚠️  Warning: Profile not found: {}", e);
                        (None, None)
                    }
                }
            }
            Err(e) => {
                eprintln!("⚠️  Warning: Failed to load profiles: {}", e);
                (None, None)
            }
        }
    } else {
        (None, None)
    };
    eprintln!("✅ Step 3 complete: Profile loaded");

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
    let transcript = match transcribe_recorded_audio(
        wav_path.to_string_lossy().to_string(),
        prompt,
        whisper_state,
    )
    .await
    {
        Ok(transcript) => transcript,
        Err(e) => {
            let error_msg = format!("Transcription failed: {}", e);
            eprintln!("❌ Error: {}", error_msg);

            // Emit transcription error state
            if let Err(e) = crate::commands::state_machine::process_event(
                crate::state::AppEvent::TranscriptionError {
                    error: error_msg.clone(),
                },
                &state_machine_state,
            )
            .await
            {
                eprintln!("⚠️  Warning: Failed to emit transcription error: {}", e);
            }

            return Err(error_msg);
        }
    };
    eprintln!(
        "✅ Step 5 complete: Transcribed {} characters",
        transcript.text.len()
    );

    // Emit transcription complete event
    if let Err(e) = crate::commands::state_machine::process_event(
        crate::state::AppEvent::TranscriptionComplete {
            transcript: transcript.text.clone(),
        },
        &state_machine_state,
    )
    .await
    {
        eprintln!("⚠️  Warning: Failed to emit transcription complete: {}", e);
    }

    // Emit processing data updated event so frontend gets the transcript data
    eprintln!("📊 [PROCESSING] Emitting processing-data-updated event with transcript");
    let transcript_text = transcript.text.clone(); // Clone early to avoid borrowing issues
    if let Some(state_machine) = state_machine_state.lock().await.as_ref() {
        let state_machine_guard = state_machine.lock().await;
        if let Err(e) = state_machine_guard.emit_event(
            "processing-data-updated",
            serde_json::json!({
                "original_transcript": transcript_text.clone(),
                "final_text": null,
                "profile_id": active_profile_id
            }),
        ) {
            eprintln!("⚠️  Warning: Failed to emit processing-data-updated: {}", e);
        }
    } else {
        eprintln!("⚠️  Warning: State machine not available for processing-data-updated event");
    }

    // 6. Apply GPT-4 formatting (conditional)
    eprintln!("🤖 Step 6: Checking for GPT-4 formatting...");
    let final_text = if let Some(profile) = profile_data {
        if profile.id == "1" {
            // Profile 1 = clipboard profile - no GPT-4 formatting
            eprintln!("ℹ️  Using clipboard profile (ID: 1) - skipping GPT-4 formatting");

            // Skip GPT formatting and go directly to clipboard
            if let Err(e) = crate::commands::state_machine::process_event(
                crate::state::AppEvent::SkipFormattingToClipboard {
                    transcript: transcript_text.clone(),
                },
                &state_machine_state,
            )
            .await
            {
                eprintln!("⚠️  Warning: Failed to emit skip formatting event: {}", e);
            }

            transcript_text.clone()
        } else if profile.prompt.is_some() && !profile.prompt.as_ref().unwrap().is_empty() {
            // Use GPT-4 formatting
            eprintln!(
                "🧠 Attempting GPT-4 formatting with profile: {}",
                profile.name
            );
            match format_text_with_gpt(
                transcript_text.clone(),
                profile.prompt.unwrap_or_default(),
                profile.example_input.unwrap_or_default(),
                profile.example_output.unwrap_or_default(),
                gpt_state,
            )
            .await
            {
                Ok(formatted) => {
                    eprintln!("✅ GPT-4 formatting successful");
                    eprintln!(
                        "🔍 GPT-4 formatted text: {}",
                        &formatted.chars().take(100).collect::<String>()
                    );

                    // Emit GPT formatting complete
                    if let Err(e) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::GPTFormattingComplete {
                            formatted_text: formatted.clone(),
                        },
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!("⚠️  Warning: Failed to emit GPT formatting complete: {}", e);
                    }

                    formatted
                }
                Err(e) => {
                    eprintln!(
                        "⚠️  GPT-4 formatting failed, using original transcript: {}",
                        e
                    );

                    // Emit GPT formatting error but continue with original transcript
                    if let Err(err) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::GPTFormattingError {
                            error: e.to_string(),
                        },
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!("⚠️  Warning: Failed to emit GPT formatting error: {}", err);
                    }

                    // Still transition to clipboard with original text
                    if let Err(err) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::SkipFormattingToClipboard {
                            transcript: transcript_text.clone(),
                        },
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!(
                            "⚠️  Warning: Failed to emit skip formatting after error: {}",
                            err
                        );
                    }

                    transcript_text.clone() // Fallback to original
                }
            }
        } else {
            // Profile has no prompt - use original transcript
            eprintln!("ℹ️  Profile has no prompt - using original transcript");

            // Skip GPT formatting and go directly to clipboard
            if let Err(e) = crate::commands::state_machine::process_event(
                crate::state::AppEvent::SkipFormattingToClipboard {
                    transcript: transcript_text.clone(),
                },
                &state_machine_state,
            )
            .await
            {
                eprintln!("⚠️  Warning: Failed to emit skip formatting event: {}", e);
            }

            transcript_text.clone()
        }
    } else {
        // No profile selected - use original transcript
        eprintln!("ℹ️  No profile selected - using original transcript");

        // Skip GPT formatting and go directly to clipboard
        if let Err(e) = crate::commands::state_machine::process_event(
            crate::state::AppEvent::SkipFormattingToClipboard {
                transcript: transcript_text.clone(),
            },
            &state_machine_state,
        )
        .await
        {
            eprintln!("⚠️  Warning: Failed to emit skip formatting event: {}", e);
        }

        transcript_text.clone()
    };
    eprintln!(
        "✅ Step 6 complete: Final text ready ({} characters)",
        final_text.len()
    );

    // Emit final processing data updated event with both transcript and final text
    eprintln!("📊 [PROCESSING] Emitting final processing-data-updated event");
    if let Some(state_machine) = state_machine_state.lock().await.as_ref() {
        let state_machine_guard = state_machine.lock().await;
        if let Err(e) = state_machine_guard.emit_event(
            "processing-data-updated",
            serde_json::json!({
                "original_transcript": transcript_text.clone(),
                "final_text": final_text.clone(),
                "profile_id": active_profile_id
            }),
        ) {
            eprintln!(
                "⚠️  Warning: Failed to emit final processing-data-updated: {}",
                e
            );
        }
    } else {
        eprintln!(
            "⚠️  Warning: State machine not available for final processing-data-updated event"
        );
    }

    // 7. Copy processed text to clipboard
    eprintln!("📋 Step 7: Copying to clipboard...");
    eprintln!("🔍 DEBUG: Clipboard content analysis:");
    eprintln!(
        "   📊 Text length: {} characters",
        final_text.chars().count()
    );
    eprintln!("   📊 Text bytes: {} bytes", final_text.len());
    if !final_text.is_empty() {
        let preview_chars = final_text.chars().take(100).collect::<String>();
        eprintln!(
            "   📝 First {} chars: {:?}",
            preview_chars.chars().count(),
            preview_chars
        );
        if final_text.chars().count() > 100 {
            let last_chars = final_text.chars().rev().take(50).collect::<Vec<_>>();
            let last_chars_str: String = last_chars.into_iter().rev().collect();
            eprintln!("   📝 Last 50 chars: {:?}", last_chars_str);
        }
        eprintln!("   🔤 Contains newlines: {}", final_text.contains('\n'));
        eprintln!("   🔤 Contains tabs: {}", final_text.contains('\t'));
        eprintln!("   🔤 Non-ASCII chars: {}", !final_text.is_ascii());
    } else {
        eprintln!("   ⚠️  WARNING: Empty text being copied to clipboard!");
    }

    {
        let clipboard_guard = clipboard_state.lock().await;
        if let Some(ref clipboard) = *clipboard_guard {
            eprintln!("   📋 Attempting clipboard copy...");
            match clipboard.copy(&final_text).await {
                Ok(_) => {
                    eprintln!("   ✅ Clipboard copy operation completed successfully");
                    // Note: ClipboardCopyComplete event will be emitted after cleanup
                }
                Err(e) => {
                    let error_msg = format!("Failed to copy to clipboard: {}", e);
                    eprintln!("❌ Error: {}", error_msg);

                    // Emit clipboard error
                    if let Err(err) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::ClipboardError {
                            error: error_msg.clone(),
                        },
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!("⚠️  Warning: Failed to emit clipboard error: {}", err);
                    }

                    return Err(error_msg);
                }
            }
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

    // 9. Transition to processing complete state (stay here for reformatting)
    eprintln!("🎯 [PROCESSING] Step 9: Transitioning to processing complete state...");
    if let Err(e) = crate::commands::state_machine::process_event(
        crate::state::AppEvent::ClipboardCopyComplete,
        &state_machine_state,
    )
    .await
    {
        eprintln!(
            "⚠️  Warning: Failed to transition to processing complete: {}",
            e
        );
    } else {
        eprintln!("✅ [PROCESSING] Step 9 complete: Transitioned to processing complete state");
    }

    let success_msg = "Transcription copied to clipboard";
    eprintln!("🎉 Workflow complete: {}", success_msg);
    eprintln!("📊 [PROCESSING] Final state: ProcessingComplete - ready for reformatting with different profiles");
    Ok(success_msg.to_string())
}

/// Reformat the completed text with a different profile
/// This command is used when processing is complete and the user wants to reformat with a different profile
#[tauri::command]
pub async fn reformat_with_profile(
    profile_id: String,
    state_machine_state: tauri::State<'_, crate::state::AppStateMachineState>,
    gpt_state: tauri::State<'_, GptClientState>,
    clipboard_state: tauri::State<'_, ClipboardServiceState>,
) -> Result<String, String> {
    eprintln!(
        "🔄 [REFORMAT] Starting reformat with profile: {}",
        profile_id
    );

    // Get the current state to extract the original transcript
    let original_transcript = {
        if let Some(state_machine) = state_machine_state.lock().await.as_ref() {
            let state_machine_guard = state_machine.lock().await;
            match state_machine_guard.current_state() {
                crate::state::recording_state_machine::AppState::ProcessingComplete {
                    original_transcript,
                    ..
                } => original_transcript.clone(),
                _ => {
                    let error_msg = "Cannot reformat: not in ProcessingComplete state".to_string();
                    eprintln!("❌ [REFORMAT] Error: {}", error_msg);
                    return Err(error_msg);
                }
            }
        } else {
            let error_msg = "State machine not available".to_string();
            eprintln!("❌ [REFORMAT] Error: {}", error_msg);
            return Err(error_msg);
        }
    };

    eprintln!(
        "📝 [REFORMAT] Original transcript: {} characters",
        original_transcript.len()
    );

    // Emit ReformatWithProfile event to transition state
    if let Err(e) = crate::commands::state_machine::process_event(
        crate::state::AppEvent::ReformatWithProfile {
            profile_id: profile_id.clone(),
        },
        &state_machine_state,
    )
    .await
    {
        let error_msg = format!("Failed to start reformat: {}", e);
        eprintln!("❌ [REFORMAT] Error: {}", error_msg);
        return Err(error_msg);
    }

    // Load the selected profile
    eprintln!("💭 [REFORMAT] Loading profile data for: {}", profile_id);
    let profile = match load_profiles().await {
        Ok(profile_collection) => {
            let engine = ProfileEngine::new();
            match engine.find_profile_by_id(&profile_collection, &profile_id) {
                Ok(profile) => Some(profile.clone()),
                Err(e) => {
                    eprintln!("⚠️  [REFORMAT] Warning: Profile not found: {}", e);
                    None
                }
            }
        }
        Err(e) => {
            eprintln!("⚠️  [REFORMAT] Warning: Failed to load profiles: {}", e);
            None
        }
    };

    // Apply formatting based on profile
    let final_text = if let Some(profile) = profile {
        if profile.id == "1" {
            // Profile 1 = clipboard profile - no GPT-4 formatting
            eprintln!("ℹ️  [REFORMAT] Using clipboard profile (ID: 1) - skipping GPT-4 formatting");

            // Skip GPT formatting and go directly to clipboard
            if let Err(e) = crate::commands::state_machine::process_event(
                crate::state::AppEvent::SkipFormattingToClipboard {
                    transcript: original_transcript.clone(),
                },
                &state_machine_state,
            )
            .await
            {
                eprintln!(
                    "⚠️  [REFORMAT] Warning: Failed to emit skip formatting event: {}",
                    e
                );
            }

            original_transcript.clone()
        } else if profile.prompt.is_some() && !profile.prompt.as_ref().unwrap().is_empty() {
            // Use GPT-4 formatting
            eprintln!(
                "🧠 [REFORMAT] Applying GPT-4 formatting with profile: {}",
                profile.name
            );
            match format_text_with_gpt(
                original_transcript.clone(),
                profile.prompt.unwrap_or_default(),
                profile.example_input.unwrap_or_default(),
                profile.example_output.unwrap_or_default(),
                gpt_state,
            )
            .await
            {
                Ok(formatted) => {
                    eprintln!("✅ [REFORMAT] GPT-4 formatting successful");

                    // Emit GPT formatting complete
                    if let Err(e) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::GPTFormattingComplete {
                            formatted_text: formatted.clone(),
                        },
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!(
                            "⚠️  [REFORMAT] Warning: Failed to emit GPT formatting complete: {}",
                            e
                        );
                    }

                    formatted
                }
                Err(e) => {
                    eprintln!(
                        "⚠️  [REFORMAT] GPT-4 formatting failed, using original transcript: {}",
                        e
                    );

                    // Emit GPT formatting error but continue with original transcript
                    if let Err(err) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::GPTFormattingError {
                            error: e.to_string(),
                        },
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!(
                            "⚠️  [REFORMAT] Warning: Failed to emit GPT formatting error: {}",
                            err
                        );
                    }

                    // Still transition to clipboard with original text
                    if let Err(err) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::SkipFormattingToClipboard {
                            transcript: original_transcript.clone(),
                        },
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!("⚠️  [REFORMAT] Warning: Failed to emit skip formatting after error: {}", err);
                    }

                    original_transcript.clone()
                }
            }
        } else {
            // Profile has no prompt - use original transcript
            eprintln!("ℹ️  [REFORMAT] Profile has no prompt - using original transcript");

            // Skip GPT formatting and go directly to clipboard
            if let Err(e) = crate::commands::state_machine::process_event(
                crate::state::AppEvent::SkipFormattingToClipboard {
                    transcript: original_transcript.clone(),
                },
                &state_machine_state,
            )
            .await
            {
                eprintln!(
                    "⚠️  [REFORMAT] Warning: Failed to emit skip formatting event: {}",
                    e
                );
            }

            original_transcript.clone()
        }
    } else {
        eprintln!("ℹ️  [REFORMAT] Profile not found - using original transcript");

        // Skip GPT formatting and go directly to clipboard
        if let Err(e) = crate::commands::state_machine::process_event(
            crate::state::AppEvent::SkipFormattingToClipboard {
                transcript: original_transcript.clone(),
            },
            &state_machine_state,
        )
        .await
        {
            eprintln!(
                "⚠️  [REFORMAT] Warning: Failed to emit skip formatting event: {}",
                e
            );
        }

        original_transcript.clone()
    };

    eprintln!("📋 [REFORMAT] Copying reformatted text to clipboard...");

    // Copy to clipboard
    {
        let clipboard_guard = clipboard_state.lock().await;
        if let Some(ref clipboard) = *clipboard_guard {
            match clipboard.copy(&final_text).await {
                Ok(_) => {
                    eprintln!("✅ [REFORMAT] Text copied to clipboard successfully");

                    // Emit clipboard copy complete
                    if let Err(e) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::ClipboardCopyComplete,
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!(
                            "⚠️  [REFORMAT] Warning: Failed to emit clipboard copy complete: {}",
                            e
                        );
                    }
                }
                Err(e) => {
                    let error_msg = format!("Failed to copy to clipboard: {}", e);
                    eprintln!("❌ [REFORMAT] Error: {}", error_msg);

                    // Emit clipboard error
                    if let Err(err) = crate::commands::state_machine::process_event(
                        crate::state::AppEvent::ClipboardError {
                            error: error_msg.clone(),
                        },
                        &state_machine_state,
                    )
                    .await
                    {
                        eprintln!(
                            "⚠️  [REFORMAT] Warning: Failed to emit clipboard error: {}",
                            err
                        );
                    }

                    return Err(error_msg);
                }
            }
        } else {
            let error_msg = "Clipboard service not initialized";
            eprintln!("❌ [REFORMAT] Error: {}", error_msg);
            return Err(error_msg.to_string());
        }
    }

    eprintln!(
        "✅ [REFORMAT] Reformat completed successfully with profile: {}",
        profile_id
    );
    Ok(format!("Text reformatted with profile: {}", profile_id))
}
