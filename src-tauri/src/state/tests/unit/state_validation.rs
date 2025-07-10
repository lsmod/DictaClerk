use crate::state::AppState;
/// State validation tests
///
/// Tests for state validation logic, ensuring states are properly constructed
/// and maintain their invariants.
use std::path::PathBuf;
use std::time::SystemTime;

#[test]
fn test_idle_state_properties() {
    let visible_idle = AppState::Idle {
        main_window_visible: true,
    };
    let hidden_idle = AppState::Idle {
        main_window_visible: false,
    };

    // Test that idle states are properly constructed
    assert!(matches!(
        visible_idle,
        AppState::Idle {
            main_window_visible: true
        }
    ));
    assert!(matches!(
        hidden_idle,
        AppState::Idle {
            main_window_visible: false
        }
    ));
}

#[test]
fn test_recording_state_properties() {
    let recording = AppState::Recording {
        started_at: SystemTime::now(),
    };
    assert!(matches!(recording, AppState::Recording { .. }));
}

#[test]
fn test_processing_state_properties() {
    let transcription = AppState::ProcessingTranscription {
        wav_path: PathBuf::from("/tmp/test.wav"),
        started_at: SystemTime::now(),
    };
    assert!(matches!(
        transcription,
        AppState::ProcessingTranscription { .. }
    ));

    let gpt_formatting = AppState::ProcessingGPTFormatting {
        original_transcript: "Test transcript".to_string(),
        profile_id: "test_profile".to_string(),
        started_at: SystemTime::now(),
    };
    assert!(matches!(
        gpt_formatting,
        AppState::ProcessingGPTFormatting { .. }
    ));

    let clipboard = AppState::ProcessingClipboard {
        original_transcript: "Test transcript".to_string(),
        text: "Test text".to_string(),
        started_at: SystemTime::now(),
    };
    assert!(matches!(clipboard, AppState::ProcessingClipboard { .. }));

    let complete = AppState::ProcessingComplete {
        original_transcript: "Test transcript".to_string(),
        final_text: "Final text".to_string(),
        profile_id: Some("test_profile".to_string()),
        completed_at: SystemTime::now(),
    };
    assert!(matches!(complete, AppState::ProcessingComplete { .. }));
}

#[test]
fn test_error_state_properties() {
    let transcription_error = AppState::TranscriptionError {
        error: "Transcription failed".to_string(),
        wav_path: PathBuf::from("/tmp/test.wav"),
        main_window_visible: true,
    };
    assert!(matches!(
        transcription_error,
        AppState::TranscriptionError { .. }
    ));

    let gpt_error = AppState::GPTFormattingError {
        error: "GPT formatting failed".to_string(),
        transcript: "Test transcript".to_string(),
        main_window_visible: false,
    };
    assert!(matches!(gpt_error, AppState::GPTFormattingError { .. }));

    let clipboard_error = AppState::ClipboardError {
        error: "Clipboard failed".to_string(),
        text: "Test text".to_string(),
        main_window_visible: true,
    };
    assert!(matches!(clipboard_error, AppState::ClipboardError { .. }));

    let profile_error = AppState::ProfileValidationError {
        error: "Profile validation failed".to_string(),
        main_window_visible: false,
    };
    assert!(matches!(
        profile_error,
        AppState::ProfileValidationError { .. }
    ));
}

#[test]
fn test_window_state_properties() {
    let settings_window = AppState::SettingsWindowOpen {
        previous_state: Box::new(AppState::Idle {
            main_window_visible: true,
        }),
    };
    assert!(matches!(
        settings_window,
        AppState::SettingsWindowOpen { .. }
    ));

    let new_profile_editor = AppState::NewProfileEditorOpen {
        settings_context: Box::new(AppState::SettingsWindowOpen {
            previous_state: Box::new(AppState::Idle {
                main_window_visible: true,
            }),
        }),
    };
    assert!(matches!(
        new_profile_editor,
        AppState::NewProfileEditorOpen { .. }
    ));

    let edit_profile_editor = AppState::EditProfileEditorOpen {
        profile_id: "test_profile".to_string(),
        settings_context: Box::new(AppState::SettingsWindowOpen {
            previous_state: Box::new(AppState::Idle {
                main_window_visible: true,
            }),
        }),
    };
    assert!(matches!(
        edit_profile_editor,
        AppState::EditProfileEditorOpen { .. }
    ));
}

#[test]
fn test_nested_state_preservation() {
    // Test that nested states properly preserve their context
    let original_idle = AppState::Idle {
        main_window_visible: false,
    };
    let settings_state = AppState::SettingsWindowOpen {
        previous_state: Box::new(original_idle.clone()),
    };

    // Verify that the nested state preserves the original context
    if let AppState::SettingsWindowOpen { previous_state } = settings_state {
        assert!(matches!(
            *previous_state,
            AppState::Idle {
                main_window_visible: false
            }
        ));
    } else {
        panic!("Expected SettingsWindowOpen state");
    }
}
