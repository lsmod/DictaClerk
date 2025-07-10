use crate::state::recording_state_machine::AppStateMachine;
use crate::state::{AppEvent, AppState};
/// Event processing tests
///
/// Tests for event processing logic, ensuring events are properly handled
/// and result in correct state transitions.
use std::path::PathBuf;
use std::time::SystemTime;

#[test]
fn test_recording_events() {
    // Test StartRecording event
    let idle_state = AppState::Idle {
        main_window_visible: true,
    };
    let start_event = AppEvent::StartRecording;
    let result = AppStateMachine::validate_transition_static(&idle_state, &start_event);
    assert!(result.is_ok());
    assert!(matches!(result.unwrap(), AppState::Recording { .. }));

    // Test StopRecording event
    let recording_state = AppState::Recording {
        started_at: SystemTime::now(),
    };
    let stop_event = AppEvent::StopRecording;
    let result = AppStateMachine::validate_transition_static(&recording_state, &stop_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::ProcessingTranscription { .. }
    ));

    // Test CancelRecording event
    let recording_state = AppState::Recording {
        started_at: SystemTime::now(),
    };
    let cancel_event = AppEvent::CancelRecording;
    let result = AppStateMachine::validate_transition_static(&recording_state, &cancel_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::Idle {
            main_window_visible: true
        }
    ));

    // Test ToggleRecording event from idle
    let idle_state = AppState::Idle {
        main_window_visible: false,
    };
    let toggle_event = AppEvent::ToggleRecording;
    let result = AppStateMachine::validate_transition_static(&idle_state, &toggle_event);
    assert!(result.is_ok());
    assert!(matches!(result.unwrap(), AppState::Recording { .. }));

    // Test ToggleRecording event from recording (should stop)
    let recording_state = AppState::Recording {
        started_at: SystemTime::now(),
    };
    let toggle_event = AppEvent::ToggleRecording;
    let result = AppStateMachine::validate_transition_static(&recording_state, &toggle_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::ProcessingTranscription { .. }
    ));
}

#[test]
fn test_window_management_events() {
    // Test ShowMainWindow event
    let hidden_idle = AppState::Idle {
        main_window_visible: false,
    };
    let show_event = AppEvent::ShowMainWindow;
    let result = AppStateMachine::validate_transition_static(&hidden_idle, &show_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::Idle {
            main_window_visible: true
        }
    ));

    // Test HideMainWindow event
    let visible_idle = AppState::Idle {
        main_window_visible: true,
    };
    let hide_event = AppEvent::HideMainWindow;
    let result = AppStateMachine::validate_transition_static(&visible_idle, &hide_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::Idle {
            main_window_visible: false
        }
    ));

    // Test OpenSettingsWindow event
    let idle_state = AppState::Idle {
        main_window_visible: false,
    };
    let open_settings_event = AppEvent::OpenSettingsWindow;
    let result = AppStateMachine::validate_transition_static(&idle_state, &open_settings_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::SettingsWindowOpen { .. }
    ));

    // Test CloseSettingsWindow event
    // Note: The actual implementation always returns main_window_visible: true
    let settings_state = AppState::SettingsWindowOpen {
        previous_state: Box::new(AppState::Idle {
            main_window_visible: false,
        }),
    };
    let close_settings_event = AppEvent::CloseSettingsWindow;
    let result =
        AppStateMachine::validate_transition_static(&settings_state, &close_settings_event);
    assert!(result.is_ok());
    // The actual implementation always sets main_window_visible: true when closing settings
    assert!(matches!(
        result.unwrap(),
        AppState::Idle {
            main_window_visible: true
        }
    ));
}

#[test]
fn test_profile_management_events() {
    // Test StartNewProfile event
    let settings_state = AppState::SettingsWindowOpen {
        previous_state: Box::new(AppState::Idle {
            main_window_visible: true,
        }),
    };
    let start_new_event = AppEvent::StartNewProfile;
    let result = AppStateMachine::validate_transition_static(&settings_state, &start_new_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::NewProfileEditorOpen { .. }
    ));

    // Test StartEditProfile event
    let settings_state = AppState::SettingsWindowOpen {
        previous_state: Box::new(AppState::Idle {
            main_window_visible: true,
        }),
    };
    let start_edit_event = AppEvent::StartEditProfile {
        profile_id: "test_profile".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&settings_state, &start_edit_event);
    assert!(result.is_ok());
    if let AppState::EditProfileEditorOpen { profile_id, .. } = result.unwrap() {
        assert_eq!(profile_id, "test_profile");
    } else {
        panic!("Expected EditProfileEditorOpen state");
    }

    // Test SaveProfile event
    let new_profile_state = AppState::NewProfileEditorOpen {
        settings_context: Box::new(AppState::SettingsWindowOpen {
            previous_state: Box::new(AppState::Idle {
                main_window_visible: true,
            }),
        }),
    };
    let save_event = AppEvent::SaveProfile {
        profile_data: r#"{"name": "Test Profile"}"#.to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&new_profile_state, &save_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::SettingsWindowOpen { .. }
    ));

    // Test CancelProfileEdit event
    let new_profile_state = AppState::NewProfileEditorOpen {
        settings_context: Box::new(AppState::SettingsWindowOpen {
            previous_state: Box::new(AppState::Idle {
                main_window_visible: true,
            }),
        }),
    };
    let cancel_event = AppEvent::CancelProfileEdit;
    let result = AppStateMachine::validate_transition_static(&new_profile_state, &cancel_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::SettingsWindowOpen { .. }
    ));

    // Test DeleteProfile event - only works from EditProfileEditorOpen state
    let edit_profile_state = AppState::EditProfileEditorOpen {
        profile_id: "test_profile".to_string(),
        settings_context: Box::new(AppState::SettingsWindowOpen {
            previous_state: Box::new(AppState::Idle {
                main_window_visible: true,
            }),
        }),
    };
    let delete_event = AppEvent::DeleteProfile {
        profile_id: "test_profile".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&edit_profile_state, &delete_event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::SettingsWindowOpen { .. }
    ));

    // Test SelectProfile event
    let idle_state = AppState::Idle {
        main_window_visible: true,
    };
    let select_event = AppEvent::SelectProfile {
        profile_id: "test_profile".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&idle_state, &select_event);
    assert!(result.is_ok());
    assert!(matches!(result.unwrap(), AppState::Idle { .. }));
}

#[test]
fn test_processing_completion_events() {
    // Test TranscriptionComplete event
    let transcription_state = AppState::ProcessingTranscription {
        wav_path: PathBuf::from("/tmp/test.wav"),
        started_at: SystemTime::now(),
    };
    let complete_event = AppEvent::TranscriptionComplete {
        transcript: "Test transcript".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&transcription_state, &complete_event);
    assert!(result.is_ok());
    if let AppState::ProcessingGPTFormatting {
        original_transcript,
        ..
    } = result.unwrap()
    {
        assert_eq!(original_transcript, "Test transcript");
    } else {
        panic!("Expected ProcessingGPTFormatting state");
    }

    // Test GPTFormattingComplete event
    let gpt_state = AppState::ProcessingGPTFormatting {
        original_transcript: "Original transcript".to_string(),
        profile_id: "test_profile".to_string(),
        started_at: SystemTime::now(),
    };
    let complete_event = AppEvent::GPTFormattingComplete {
        formatted_text: "Formatted text".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&gpt_state, &complete_event);
    assert!(result.is_ok());
    if let AppState::ProcessingClipboard {
        original_transcript,
        text,
        ..
    } = result.unwrap()
    {
        assert_eq!(original_transcript, "Original transcript");
        assert_eq!(text, "Formatted text");
    } else {
        panic!("Expected ProcessingClipboard state");
    }

    // Test ClipboardCopyComplete event
    let clipboard_state = AppState::ProcessingClipboard {
        original_transcript: "Original transcript".to_string(),
        text: "Text to copy".to_string(),
        started_at: SystemTime::now(),
    };
    let complete_event = AppEvent::ClipboardCopyComplete;
    let result = AppStateMachine::validate_transition_static(&clipboard_state, &complete_event);
    assert!(result.is_ok());
    if let AppState::ProcessingComplete {
        original_transcript,
        final_text,
        ..
    } = result.unwrap()
    {
        assert_eq!(original_transcript, "Original transcript");
        assert_eq!(final_text, "Text to copy");
    } else {
        panic!("Expected ProcessingComplete state");
    }

    // Test SkipFormattingToClipboard event
    let transcription_state = AppState::ProcessingTranscription {
        wav_path: PathBuf::from("/tmp/test.wav"),
        started_at: SystemTime::now(),
    };
    let skip_event = AppEvent::SkipFormattingToClipboard {
        transcript: "Raw transcript".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&transcription_state, &skip_event);
    assert!(result.is_ok());
    if let AppState::ProcessingClipboard {
        original_transcript,
        text,
        ..
    } = result.unwrap()
    {
        assert_eq!(original_transcript, "Raw transcript");
        assert_eq!(text, "Raw transcript");
    } else {
        panic!("Expected ProcessingClipboard state");
    }
}

#[test]
fn test_error_events() {
    // Test TranscriptionError event
    let transcription_state = AppState::ProcessingTranscription {
        wav_path: PathBuf::from("/tmp/test.wav"),
        started_at: SystemTime::now(),
    };
    let error_event = AppEvent::TranscriptionError {
        error: "Transcription failed".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&transcription_state, &error_event);
    assert!(result.is_ok());
    if let AppState::TranscriptionError {
        error, wav_path, ..
    } = result.unwrap()
    {
        assert_eq!(error, "Transcription failed");
        assert_eq!(wav_path, PathBuf::from("/tmp/test.wav"));
    } else {
        panic!("Expected TranscriptionError state");
    }

    // Test GPTFormattingError event
    let gpt_state = AppState::ProcessingGPTFormatting {
        original_transcript: "Test transcript".to_string(),
        profile_id: "test_profile".to_string(),
        started_at: SystemTime::now(),
    };
    let error_event = AppEvent::GPTFormattingError {
        error: "GPT formatting failed".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&gpt_state, &error_event);
    assert!(result.is_ok());
    if let AppState::GPTFormattingError {
        error, transcript, ..
    } = result.unwrap()
    {
        assert_eq!(error, "GPT formatting failed");
        assert_eq!(transcript, "Test transcript");
    } else {
        panic!("Expected GPTFormattingError state");
    }

    // Test ClipboardError event
    let clipboard_state = AppState::ProcessingClipboard {
        original_transcript: "Test transcript".to_string(),
        text: "Test text".to_string(),
        started_at: SystemTime::now(),
    };
    let error_event = AppEvent::ClipboardError {
        error: "Clipboard failed".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&clipboard_state, &error_event);
    assert!(result.is_ok());
    if let AppState::ClipboardError { error, text, .. } = result.unwrap() {
        assert_eq!(error, "Clipboard failed");
        assert_eq!(text, "Test text");
    } else {
        panic!("Expected ClipboardError state");
    }

    // Note: ProfileValidationError event is not currently implemented in the state machine
    // It's defined in the enum but has no transition handlers, so we don't test it
}

#[test]
fn test_system_events() {
    // Test Reset event from various states
    let states_to_test = vec![
        AppState::Recording {
            started_at: SystemTime::now(),
        },
        AppState::ProcessingTranscription {
            wav_path: PathBuf::from("/tmp/test.wav"),
            started_at: SystemTime::now(),
        },
        AppState::TranscriptionError {
            error: "Error".to_string(),
            wav_path: PathBuf::from("/tmp/test.wav"),
            main_window_visible: true,
        },
    ];

    for state in states_to_test {
        let reset_event = AppEvent::Reset;
        let result = AppStateMachine::validate_transition_static(&state, &reset_event);
        assert!(result.is_ok());
        assert!(matches!(
            result.unwrap(),
            AppState::Idle {
                main_window_visible: true
            }
        ));
    }

    // Test AcknowledgeError event from error states
    let error_states = vec![
        AppState::TranscriptionError {
            error: "Test error".to_string(),
            wav_path: PathBuf::from("/tmp/test.wav"),
            main_window_visible: false,
        },
        AppState::GPTFormattingError {
            error: "Test error".to_string(),
            transcript: "Test transcript".to_string(),
            main_window_visible: true,
        },
        AppState::ClipboardError {
            error: "Test error".to_string(),
            text: "Test text".to_string(),
            main_window_visible: false,
        },
        AppState::ProfileValidationError {
            error: "Test error".to_string(),
            main_window_visible: true,
        },
    ];

    for error_state in error_states {
        let expected_visibility = match &error_state {
            AppState::TranscriptionError {
                main_window_visible,
                ..
            }
            | AppState::GPTFormattingError {
                main_window_visible,
                ..
            }
            | AppState::ClipboardError {
                main_window_visible,
                ..
            }
            | AppState::ProfileValidationError {
                main_window_visible,
                ..
            } => *main_window_visible,
            _ => true,
        };

        let ack_event = AppEvent::AcknowledgeError;
        let result = AppStateMachine::validate_transition_static(&error_state, &ack_event);
        assert!(result.is_ok());
        if let AppState::Idle {
            main_window_visible,
        } = result.unwrap()
        {
            assert_eq!(main_window_visible, expected_visibility);
        } else {
            panic!("Expected Idle state");
        }
    }
}

#[test]
fn test_event_data_preservation() {
    // Test that event data is properly preserved through state transitions

    // TranscriptionComplete preserves transcript
    let transcription_state = AppState::ProcessingTranscription {
        wav_path: PathBuf::from("/tmp/test.wav"),
        started_at: SystemTime::now(),
    };
    let complete_event = AppEvent::TranscriptionComplete {
        transcript: "Preserved transcript".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&transcription_state, &complete_event);
    assert!(result.is_ok());
    if let AppState::ProcessingGPTFormatting {
        original_transcript,
        ..
    } = result.unwrap()
    {
        assert_eq!(original_transcript, "Preserved transcript");
    }

    // GPTFormattingComplete preserves both original and formatted text
    let gpt_state = AppState::ProcessingGPTFormatting {
        original_transcript: "Original preserved".to_string(),
        profile_id: "test_profile".to_string(),
        started_at: SystemTime::now(),
    };
    let complete_event = AppEvent::GPTFormattingComplete {
        formatted_text: "Formatted preserved".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&gpt_state, &complete_event);
    assert!(result.is_ok());
    if let AppState::ProcessingClipboard {
        original_transcript,
        text,
        ..
    } = result.unwrap()
    {
        assert_eq!(original_transcript, "Original preserved");
        assert_eq!(text, "Formatted preserved");
    }

    // Error events preserve relevant data
    let gpt_state = AppState::ProcessingGPTFormatting {
        original_transcript: "Original for error".to_string(),
        profile_id: "test_profile".to_string(),
        started_at: SystemTime::now(),
    };
    let error_event = AppEvent::GPTFormattingError {
        error: "Preserved error message".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&gpt_state, &error_event);
    assert!(result.is_ok());
    if let AppState::GPTFormattingError {
        error, transcript, ..
    } = result.unwrap()
    {
        assert_eq!(error, "Preserved error message");
        assert_eq!(transcript, "Original for error");
    }
}
