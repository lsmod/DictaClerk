use crate::state::recording_state_machine::AppStateMachine;
use crate::state::{AppEvent, AppState};
/// Comprehensive transition matrix tests for the state machine
use std::path::PathBuf;
use std::time::SystemTime;

#[test]
fn test_idle_to_recording_transitions() {
    let state = AppState::Idle {
        main_window_visible: true,
    };
    let event = AppEvent::StartRecording;
    let result = AppStateMachine::validate_transition_static(&state, &event);
    assert!(result.is_ok());
    assert!(matches!(result.unwrap(), AppState::Recording { .. }));
}

#[test]
fn test_recording_to_processing_transitions() {
    let state = AppState::Recording {
        started_at: SystemTime::now(),
    };
    let event = AppEvent::StopRecording;
    let result = AppStateMachine::validate_transition_static(&state, &event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::ProcessingTranscription { .. }
    ));
}

#[test]
fn test_processing_pipeline() {
    // Transcription -> GPT Formatting
    let state = AppState::ProcessingTranscription {
        wav_path: PathBuf::from("/tmp/test.wav"),
        started_at: SystemTime::now(),
    };
    let event = AppEvent::TranscriptionComplete {
        transcript: "Test".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&state, &event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::ProcessingGPTFormatting { .. }
    ));

    // GPT Formatting -> Clipboard
    let state = AppState::ProcessingGPTFormatting {
        original_transcript: "Test".to_string(),
        profile_id: "test".to_string(),
        started_at: SystemTime::now(),
    };
    let event = AppEvent::GPTFormattingComplete {
        formatted_text: "Formatted".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&state, &event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::ProcessingClipboard { .. }
    ));

    // Clipboard -> Complete
    let state = AppState::ProcessingClipboard {
        original_transcript: "Test".to_string(),
        text: "Text".to_string(),
        started_at: SystemTime::now(),
    };
    let event = AppEvent::ClipboardCopyComplete;
    let result = AppStateMachine::validate_transition_static(&state, &event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::ProcessingComplete { .. }
    ));
}

#[test]
fn test_error_state_recovery() {
    let error_states = vec![
        AppState::TranscriptionError {
            error: "Test".to_string(),
            wav_path: PathBuf::from("/tmp/test.wav"),
            main_window_visible: true,
        },
        AppState::GPTFormattingError {
            error: "Test".to_string(),
            transcript: "Test".to_string(),
            main_window_visible: true,
        },
        AppState::ClipboardError {
            error: "Test".to_string(),
            text: "Test".to_string(),
            main_window_visible: true,
        },
        AppState::ProfileValidationError {
            error: "Test".to_string(),
            main_window_visible: true,
        },
    ];

    for state in error_states {
        let event = AppEvent::AcknowledgeError;
        let result = AppStateMachine::validate_transition_static(&state, &event);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), AppState::Idle { .. }));
    }
}

#[test]
fn test_profile_editor_workflow() {
    // Settings -> New Profile Editor
    let state = AppState::SettingsWindowOpen {
        previous_state: Box::new(AppState::Idle {
            main_window_visible: true,
        }),
    };
    let event = AppEvent::StartNewProfile;
    let result = AppStateMachine::validate_transition_static(&state, &event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::NewProfileEditorOpen { .. }
    ));

    // New Profile Editor -> Settings (save)
    let state = AppState::NewProfileEditorOpen {
        settings_context: Box::new(AppState::SettingsWindowOpen {
            previous_state: Box::new(AppState::Idle {
                main_window_visible: true,
            }),
        }),
    };
    let event = AppEvent::SaveProfile {
        profile_data: "{}".to_string(),
    };
    let result = AppStateMachine::validate_transition_static(&state, &event);
    assert!(result.is_ok());
    assert!(matches!(
        result.unwrap(),
        AppState::SettingsWindowOpen { .. }
    ));
}

#[test]
fn test_invalid_transitions() {
    let state = AppState::Idle {
        main_window_visible: true,
    };
    let invalid_events = vec![
        AppEvent::StopRecording,
        AppEvent::TranscriptionComplete {
            transcript: "test".to_string(),
        },
        AppEvent::GPTFormattingComplete {
            formatted_text: "test".to_string(),
        },
        AppEvent::ClipboardCopyComplete,
    ];

    for event in invalid_events {
        let result = AppStateMachine::validate_transition_static(&state, &event);
        assert!(result.is_err());
    }
}

#[test]
fn test_reset_functionality() {
    let states = vec![
        AppState::Recording {
            started_at: SystemTime::now(),
        },
        AppState::ProcessingTranscription {
            wav_path: PathBuf::from("/tmp/test.wav"),
            started_at: SystemTime::now(),
        },
        AppState::TranscriptionError {
            error: "Test".to_string(),
            wav_path: PathBuf::from("/tmp/test.wav"),
            main_window_visible: false,
        },
    ];

    for state in states {
        let event = AppEvent::Reset;
        let result = AppStateMachine::validate_transition_static(&state, &event);
        assert!(result.is_ok());
        assert!(matches!(
            result.unwrap(),
            AppState::Idle {
                main_window_visible: true
            }
        ));
    }
}
