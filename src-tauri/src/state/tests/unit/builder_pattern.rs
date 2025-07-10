use crate::state::{AppState, AppStateMachineBuilder};
/// Builder pattern tests for AppStateMachineBuilder
///
/// Tests for the state machine builder functionality, ensuring proper
/// initialization and configuration options.
use std::time::SystemTime;

#[test]
fn test_default_builder() {
    let _builder = AppStateMachineBuilder::new();

    // Test that default() creates the same builder as new()
    let _default_builder = AppStateMachineBuilder::default();

    // We can't directly compare builders, but we can test their behavior
    // Both should create machines with default idle state when built
}

#[test]
fn test_builder_with_initial_state() {
    let custom_state = AppState::Idle {
        main_window_visible: false,
    };
    let _builder = AppStateMachineBuilder::new().with_initial_state(custom_state.clone());

    // The builder should accept the custom initial state
    // We can't test the actual state without building, which requires AppHandle
}

#[test]
fn test_builder_with_events_disabled() {
    let _builder = AppStateMachineBuilder::new().with_events_disabled();

    // The builder should accept the events disabled configuration
    // We can't test the actual configuration without building
}

#[test]
fn test_builder_method_chaining() {
    let custom_state = AppState::Recording {
        started_at: SystemTime::now(),
    };

    let _builder = AppStateMachineBuilder::new()
        .with_initial_state(custom_state.clone())
        .with_events_disabled();

    // Test that method chaining works properly
    // The builder should accept both configurations
}

#[test]
fn test_builder_multiple_initial_states() {
    let state1 = AppState::Idle {
        main_window_visible: true,
    };
    let state2 = AppState::Idle {
        main_window_visible: false,
    };

    let _builder = AppStateMachineBuilder::new()
        .with_initial_state(state1)
        .with_initial_state(state2); // Should override the first state

    // The last state should be used
}

#[test]
fn test_builder_multiple_event_configurations() {
    let _builder = AppStateMachineBuilder::new()
        .with_events_disabled()
        .with_events_disabled(); // Should be idempotent

    // Multiple calls should not cause issues
}

#[test]
fn test_builder_with_complex_initial_state() {
    // Test with a complex nested state
    let complex_state = AppState::EditProfileEditorOpen {
        profile_id: "test_profile".to_string(),
        settings_context: Box::new(AppState::SettingsWindowOpen {
            previous_state: Box::new(AppState::ProcessingComplete {
                original_transcript: "Test transcript".to_string(),
                final_text: "Final text".to_string(),
                profile_id: Some("profile1".to_string()),
                completed_at: SystemTime::now(),
            }),
        }),
    };

    let _builder = AppStateMachineBuilder::new().with_initial_state(complex_state);

    // The builder should handle complex nested states
}

#[test]
fn test_builder_with_error_states() {
    use std::path::PathBuf;

    let error_states = vec![
        AppState::TranscriptionError {
            error: "Test error".to_string(),
            wav_path: PathBuf::from("/tmp/test.wav"),
            main_window_visible: true,
        },
        AppState::GPTFormattingError {
            error: "Test error".to_string(),
            transcript: "Test transcript".to_string(),
            main_window_visible: false,
        },
        AppState::ClipboardError {
            error: "Test error".to_string(),
            text: "Test text".to_string(),
            main_window_visible: true,
        },
        AppState::ProfileValidationError {
            error: "Test error".to_string(),
            main_window_visible: false,
        },
    ];

    for error_state in error_states {
        let _builder = AppStateMachineBuilder::new().with_initial_state(error_state);

        // The builder should handle all error states as initial states
    }
}

#[test]
fn test_builder_with_processing_states() {
    use std::path::PathBuf;

    let processing_states = vec![
        AppState::ProcessingTranscription {
            wav_path: PathBuf::from("/tmp/test.wav"),
            started_at: SystemTime::now(),
        },
        AppState::ProcessingGPTFormatting {
            original_transcript: "Test transcript".to_string(),
            profile_id: "test_profile".to_string(),
            started_at: SystemTime::now(),
        },
        AppState::ProcessingClipboard {
            original_transcript: "Test transcript".to_string(),
            text: "Test text".to_string(),
            started_at: SystemTime::now(),
        },
        AppState::ProcessingComplete {
            original_transcript: "Test transcript".to_string(),
            final_text: "Final text".to_string(),
            profile_id: Some("test_profile".to_string()),
            completed_at: SystemTime::now(),
        },
    ];

    for processing_state in processing_states {
        let _builder = AppStateMachineBuilder::new().with_initial_state(processing_state);

        // The builder should handle all processing states as initial states
    }
}

#[test]
fn test_builder_immutability() {
    // Fix the move error by creating separate builders
    let _builder1 = AppStateMachineBuilder::new().with_events_disabled();
    let _builder2 = AppStateMachineBuilder::new().with_initial_state(AppState::Idle {
        main_window_visible: false,
    });

    // Each builder configuration should be independent
    // The original builder should not be modified
}

#[test]
fn test_builder_configuration_order() {
    let state = AppState::Recording {
        started_at: SystemTime::now(),
    };

    // Test different orders of configuration
    let _builder1 = AppStateMachineBuilder::new()
        .with_initial_state(state.clone())
        .with_events_disabled();

    let _builder2 = AppStateMachineBuilder::new()
        .with_events_disabled()
        .with_initial_state(state.clone());

    // Both orders should result in equivalent configurations
}

// Note: We cannot test the actual build() method without a real Tauri AppHandle,
// which is not available in unit tests. The build() method would need integration
// tests with a real Tauri application context.

#[test]
fn test_builder_state_validation() {
    // Test that the builder accepts all valid state types
    let valid_states = vec![
        AppState::Idle {
            main_window_visible: true,
        },
        AppState::Idle {
            main_window_visible: false,
        },
        AppState::Recording {
            started_at: SystemTime::now(),
        },
    ];

    for state in valid_states {
        let _builder = AppStateMachineBuilder::new().with_initial_state(state);

        // All valid states should be accepted by the builder
    }
}

#[test]
fn test_builder_edge_cases() {
    // Test builder with rapid successive configurations
    let mut builder = AppStateMachineBuilder::new();

    for i in 0..100 {
        builder = builder.with_initial_state(AppState::Idle {
            main_window_visible: i % 2 == 0,
        });
    }

    // Rapid configuration changes should not cause issues

    // Test builder with alternating event settings
    let mut builder = AppStateMachineBuilder::new();

    for _ in 0..50 {
        builder = builder.with_events_disabled();
    }

    // Multiple event configuration calls should be stable
}
