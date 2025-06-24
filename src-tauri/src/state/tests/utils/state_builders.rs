/// Test state builders for creating test states and events
///
/// This module provides builder patterns and factory functions for creating
/// various application states and events used in testing.

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::state::{AppState, AppEvent};

/// Builder for creating test AppState instances
pub struct AppStateBuilder;

impl AppStateBuilder {
    /// Create an idle state with main window visible
    pub fn idle_visible() -> AppState {
        AppState::Idle {
            main_window_visible: true,
        }
    }

    /// Create an idle state with main window hidden
    pub fn idle_hidden() -> AppState {
        AppState::Idle {
            main_window_visible: false,
        }
    }

    /// Create a recording state with current timestamp
    pub fn recording() -> AppState {
        AppState::Recording {
            started_at: SystemTime::now(),
        }
    }

    /// Create a recording state with specific timestamp
    pub fn recording_at(started_at: SystemTime) -> AppState {
        AppState::Recording { started_at }
    }

    /// Create a transcription processing state
    pub fn processing_transcription() -> AppState {
        AppState::ProcessingTranscription {
            wav_path: PathBuf::from("/tmp/test.wav"),
            started_at: SystemTime::now(),
        }
    }

    /// Create a transcription processing state with custom path
    pub fn processing_transcription_with_path(wav_path: PathBuf) -> AppState {
        AppState::ProcessingTranscription {
            wav_path,
            started_at: SystemTime::now(),
        }
    }

    /// Create a GPT formatting processing state
    pub fn processing_gpt_formatting() -> AppState {
        AppState::ProcessingGPTFormatting {
            original_transcript: "Test transcript".to_string(),
            profile_id: "test_profile".to_string(),
            started_at: SystemTime::now(),
        }
    }

    /// Create a GPT formatting processing state with custom data
    pub fn processing_gpt_formatting_with_data(
        original_transcript: String,
        profile_id: String,
    ) -> AppState {
        AppState::ProcessingGPTFormatting {
            original_transcript,
            profile_id,
            started_at: SystemTime::now(),
        }
    }

    /// Create a clipboard processing state
    pub fn processing_clipboard() -> AppState {
        AppState::ProcessingClipboard {
            original_transcript: "Test transcript".to_string(),
            text: "Test text".to_string(),
            started_at: SystemTime::now(),
        }
    }

    /// Create a clipboard processing state with custom data
    pub fn processing_clipboard_with_data(
        original_transcript: String,
        text: String,
    ) -> AppState {
        AppState::ProcessingClipboard {
            original_transcript,
            text,
            started_at: SystemTime::now(),
        }
    }

    /// Create a processing complete state
    pub fn processing_complete() -> AppState {
        AppState::ProcessingComplete {
            original_transcript: "Test transcript".to_string(),
            final_text: "Test final text".to_string(),
            profile_id: Some("test_profile".to_string()),
            completed_at: SystemTime::now(),
        }
    }

    /// Create a processing complete state with custom data
    pub fn processing_complete_with_data(
        original_transcript: String,
        final_text: String,
        profile_id: Option<String>,
    ) -> AppState {
        AppState::ProcessingComplete {
            original_transcript,
            final_text,
            profile_id,
            completed_at: SystemTime::now(),
        }
    }

    /// Create a settings window open state
    pub fn settings_window_open(previous_state: AppState) -> AppState {
        AppState::SettingsWindowOpen {
            previous_state: Box::new(previous_state),
        }
    }

    /// Create a new profile editor open state
    pub fn new_profile_editor_open(settings_context: AppState) -> AppState {
        AppState::NewProfileEditorOpen {
            settings_context: Box::new(settings_context),
        }
    }

    /// Create an edit profile editor open state
    pub fn edit_profile_editor_open(profile_id: String, settings_context: AppState) -> AppState {
        AppState::EditProfileEditorOpen {
            profile_id,
            settings_context: Box::new(settings_context),
        }
    }

    /// Create a transcription error state
    pub fn transcription_error() -> AppState {
        AppState::TranscriptionError {
            error: "Test transcription error".to_string(),
            wav_path: PathBuf::from("/tmp/test.wav"),
            main_window_visible: true,
        }
    }

    /// Create a transcription error state with custom data
    pub fn transcription_error_with_data(
        error: String,
        wav_path: PathBuf,
        main_window_visible: bool,
    ) -> AppState {
        AppState::TranscriptionError {
            error,
            wav_path,
            main_window_visible,
        }
    }

    /// Create a GPT formatting error state
    pub fn gpt_formatting_error() -> AppState {
        AppState::GPTFormattingError {
            error: "Test GPT formatting error".to_string(),
            transcript: "Test transcript".to_string(),
            main_window_visible: true,
        }
    }

    /// Create a GPT formatting error state with custom data
    pub fn gpt_formatting_error_with_data(
        error: String,
        transcript: String,
        main_window_visible: bool,
    ) -> AppState {
        AppState::GPTFormattingError {
            error,
            transcript,
            main_window_visible,
        }
    }

    /// Create a clipboard error state
    pub fn clipboard_error() -> AppState {
        AppState::ClipboardError {
            error: "Test clipboard error".to_string(),
            text: "Test text".to_string(),
            main_window_visible: true,
        }
    }

    /// Create a clipboard error state with custom data
    pub fn clipboard_error_with_data(
        error: String,
        text: String,
        main_window_visible: bool,
    ) -> AppState {
        AppState::ClipboardError {
            error,
            text,
            main_window_visible,
        }
    }

    /// Create a profile validation error state
    pub fn profile_validation_error() -> AppState {
        AppState::ProfileValidationError {
            error: "Test profile validation error".to_string(),
            main_window_visible: true,
        }
    }

    /// Create a profile validation error state with custom data
    pub fn profile_validation_error_with_data(
        error: String,
        main_window_visible: bool,
    ) -> AppState {
        AppState::ProfileValidationError {
            error,
            main_window_visible,
        }
    }
}

/// Builder for creating test AppEvent instances
pub struct AppEventBuilder;

impl AppEventBuilder {
    /// Recording events
    pub fn start_recording() -> AppEvent {
        AppEvent::StartRecording
    }

    pub fn stop_recording() -> AppEvent {
        AppEvent::StopRecording
    }

    pub fn cancel_recording() -> AppEvent {
        AppEvent::CancelRecording
    }

    pub fn toggle_recording() -> AppEvent {
        AppEvent::ToggleRecording
    }

    pub fn start_recording_from_tray() -> AppEvent {
        AppEvent::StartRecordingFromTray
    }

    /// Window management events
    pub fn show_main_window() -> AppEvent {
        AppEvent::ShowMainWindow
    }

    pub fn hide_main_window() -> AppEvent {
        AppEvent::HideMainWindow
    }

    pub fn open_settings_window() -> AppEvent {
        AppEvent::OpenSettingsWindow
    }

    pub fn close_settings_window() -> AppEvent {
        AppEvent::CloseSettingsWindow
    }

    pub fn open_profile_editor_window(profile_id: Option<String>) -> AppEvent {
        AppEvent::OpenProfileEditorWindow { profile_id }
    }

    pub fn close_profile_editor_window() -> AppEvent {
        AppEvent::CloseProfileEditorWindow
    }

    /// Profile management events
    pub fn start_new_profile() -> AppEvent {
        AppEvent::StartNewProfile
    }

    pub fn start_edit_profile(profile_id: String) -> AppEvent {
        AppEvent::StartEditProfile { profile_id }
    }

    pub fn save_profile(profile_data: String) -> AppEvent {
        AppEvent::SaveProfile { profile_data }
    }

    pub fn cancel_profile_edit() -> AppEvent {
        AppEvent::CancelProfileEdit
    }

    pub fn delete_profile(profile_id: String) -> AppEvent {
        AppEvent::DeleteProfile { profile_id }
    }

    pub fn select_profile(profile_id: String) -> AppEvent {
        AppEvent::SelectProfile { profile_id }
    }

    /// Processing completion events
    pub fn transcription_complete(transcript: String) -> AppEvent {
        AppEvent::TranscriptionComplete { transcript }
    }

    pub fn gpt_formatting_complete(formatted_text: String) -> AppEvent {
        AppEvent::GPTFormattingComplete { formatted_text }
    }

    pub fn clipboard_copy_complete() -> AppEvent {
        AppEvent::ClipboardCopyComplete
    }

    pub fn reformat_with_profile(profile_id: String) -> AppEvent {
        AppEvent::ReformatWithProfile { profile_id }
    }

    pub fn skip_formatting_to_clipboard(transcript: String) -> AppEvent {
        AppEvent::SkipFormattingToClipboard { transcript }
    }

    /// Error events
    pub fn transcription_error(error: String) -> AppEvent {
        AppEvent::TranscriptionError { error }
    }

    pub fn gpt_formatting_error(error: String) -> AppEvent {
        AppEvent::GPTFormattingError { error }
    }

    pub fn clipboard_error(error: String) -> AppEvent {
        AppEvent::ClipboardError { error }
    }

    pub fn profile_validation_error(error: String) -> AppEvent {
        AppEvent::ProfileValidationError { error }
    }

    /// System events
    pub fn save_settings() -> AppEvent {
        AppEvent::SaveSettings
    }

    pub fn reset() -> AppEvent {
        AppEvent::Reset
    }

    pub fn acknowledge_error() -> AppEvent {
        AppEvent::AcknowledgeError
    }
}

/// Utility functions for creating common test scenarios
pub struct TestScenarios;

impl TestScenarios {
    /// Create a complete recording workflow sequence
    pub fn recording_workflow() -> Vec<(AppState, AppEvent, AppState)> {
        vec![
            (
                AppStateBuilder::idle_visible(),
                AppEventBuilder::start_recording(),
                AppStateBuilder::recording(),
            ),
            (
                AppStateBuilder::recording(),
                AppEventBuilder::stop_recording(),
                AppStateBuilder::processing_transcription(),
            ),
            (
                AppStateBuilder::processing_transcription(),
                AppEventBuilder::transcription_complete("Test transcript".to_string()),
                AppStateBuilder::processing_gpt_formatting(),
            ),
            (
                AppStateBuilder::processing_gpt_formatting(),
                AppEventBuilder::gpt_formatting_complete("Formatted text".to_string()),
                AppStateBuilder::processing_clipboard(),
            ),
            (
                AppStateBuilder::processing_clipboard(),
                AppEventBuilder::clipboard_copy_complete(),
                AppStateBuilder::processing_complete(),
            ),
        ]
    }

    /// Create all error states with their recovery events
    pub fn error_recovery_scenarios() -> Vec<(AppState, AppEvent, AppState)> {
        vec![
            (
                AppStateBuilder::transcription_error(),
                AppEventBuilder::acknowledge_error(),
                AppStateBuilder::idle_visible(),
            ),
            (
                AppStateBuilder::gpt_formatting_error(),
                AppEventBuilder::acknowledge_error(),
                AppStateBuilder::idle_visible(),
            ),
            (
                AppStateBuilder::clipboard_error(),
                AppEventBuilder::acknowledge_error(),
                AppStateBuilder::idle_visible(),
            ),
            (
                AppStateBuilder::profile_validation_error(),
                AppEventBuilder::acknowledge_error(),
                AppStateBuilder::idle_visible(),
            ),
        ]
    }

    /// Create window management scenarios
    pub fn window_management_scenarios() -> Vec<(AppState, AppEvent, AppState)> {
        vec![
            (
                AppStateBuilder::idle_visible(),
                AppEventBuilder::open_settings_window(),
                AppStateBuilder::settings_window_open(AppStateBuilder::idle_visible()),
            ),
            (
                AppStateBuilder::settings_window_open(AppStateBuilder::idle_visible()),
                AppEventBuilder::close_settings_window(),
                AppStateBuilder::idle_visible(),
            ),
            (
                AppStateBuilder::settings_window_open(AppStateBuilder::idle_visible()),
                AppEventBuilder::start_new_profile(),
                AppStateBuilder::new_profile_editor_open(
                    AppStateBuilder::settings_window_open(AppStateBuilder::idle_visible())
                ),
            ),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_builder_idle() {
        let idle_visible = AppStateBuilder::idle_visible();
        assert!(matches!(idle_visible, AppState::Idle { main_window_visible: true }));

        let idle_hidden = AppStateBuilder::idle_hidden();
        assert!(matches!(idle_hidden, AppState::Idle { main_window_visible: false }));
    }

    #[test]
    fn test_app_state_builder_recording() {
        let recording = AppStateBuilder::recording();
        assert!(matches!(recording, AppState::Recording { .. }));
    }

    #[test]
    fn test_app_state_builder_processing() {
        let transcription = AppStateBuilder::processing_transcription();
        assert!(matches!(transcription, AppState::ProcessingTranscription { .. }));

        let gpt = AppStateBuilder::processing_gpt_formatting();
        assert!(matches!(gpt, AppState::ProcessingGPTFormatting { .. }));

        let clipboard = AppStateBuilder::processing_clipboard();
        assert!(matches!(clipboard, AppState::ProcessingClipboard { .. }));

        let complete = AppStateBuilder::processing_complete();
        assert!(matches!(complete, AppState::ProcessingComplete { .. }));
    }

    #[test]
    fn test_app_state_builder_errors() {
        let transcription_error = AppStateBuilder::transcription_error();
        assert!(matches!(transcription_error, AppState::TranscriptionError { .. }));

        let gpt_error = AppStateBuilder::gpt_formatting_error();
        assert!(matches!(gpt_error, AppState::GPTFormattingError { .. }));

        let clipboard_error = AppStateBuilder::clipboard_error();
        assert!(matches!(clipboard_error, AppState::ClipboardError { .. }));

        let profile_error = AppStateBuilder::profile_validation_error();
        assert!(matches!(profile_error, AppState::ProfileValidationError { .. }));
    }

    #[test]
    fn test_app_event_builder() {
        let start_recording = AppEventBuilder::start_recording();
        assert!(matches!(start_recording, AppEvent::StartRecording));

        let stop_recording = AppEventBuilder::stop_recording();
        assert!(matches!(stop_recording, AppEvent::StopRecording));

        let transcription_complete = AppEventBuilder::transcription_complete("test".to_string());
        assert!(matches!(transcription_complete, AppEvent::TranscriptionComplete { .. }));
    }

    #[test]
    fn test_recording_workflow_scenario() {
        let workflow = TestScenarios::recording_workflow();
        assert_eq!(workflow.len(), 5);

        // Verify the first transition
        let (initial_state, event, expected_state) = &workflow[0];
        assert!(matches!(initial_state, AppState::Idle { .. }));
        assert!(matches!(event, AppEvent::StartRecording));
        assert!(matches!(expected_state, AppState::Recording { .. }));
    }

    #[test]
    fn test_error_recovery_scenarios() {
        let scenarios = TestScenarios::error_recovery_scenarios();
        assert_eq!(scenarios.len(), 4);

        // All scenarios should end in Idle state
        for (_, _, final_state) in scenarios {
            assert!(matches!(final_state, AppState::Idle { .. }));
        }
    }
}
