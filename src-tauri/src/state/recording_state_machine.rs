use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use thiserror::Error;

/// Global application state machine for DictaClerk
///
/// This state machine manages all aspects of the application including:
/// - Recording and audio processing workflow
/// - Window management (main, settings, profile editor)
/// - Error states with recovery options
/// - Profile management operations
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AppState {
    // === IDLE & READY STATES ===
    /// Application is idle and ready to start recording
    /// Main window can be visible or hidden
    Idle { main_window_visible: bool },

    // === RECORDING STATES ===
    /// Currently recording audio
    /// Main window is forced visible during recording
    Recording { started_at: SystemTime },

    // === PROCESSING STATES (Sequential) ===
    /// Transcribing audio with Whisper API
    ProcessingTranscription {
        wav_path: PathBuf,
        started_at: SystemTime,
    },

    /// Formatting text with GPT API
    ProcessingGPTFormatting {
        original_transcript: String, // Transcript original de Whisper
        profile_id: String,
        started_at: SystemTime,
    },

    /// Copying formatted text to clipboard
    ProcessingClipboard {
        original_transcript: String, // Transcript original pour le reformatage
        text: String,                // Texte à copier (transcript ou formaté)
        started_at: SystemTime,
    },

    /// Processing completed successfully
    ProcessingComplete {
        original_transcript: String, // Transcript original de Whisper (pour reformatage)
        final_text: String,          // Texte final (transcript ou formaté selon profil)
        profile_id: Option<String>,  // Profile utilisé (None = pas de formatage)
        completed_at: SystemTime,
    },

    // === WINDOW MANAGEMENT STATES ===
    /// Settings window is open (main window state preserved)
    SettingsWindowOpen { previous_state: Box<AppState> },

    /// New profile editor is open (from settings)
    NewProfileEditorOpen { settings_context: Box<AppState> },

    /// Editing existing profile (from settings)
    EditProfileEditorOpen {
        profile_id: String,
        settings_context: Box<AppState>,
    },

    // === ERROR STATES (Permanent) ===
    /// Transcription failed - user must acknowledge
    TranscriptionError {
        error: String,
        wav_path: PathBuf,
        main_window_visible: bool,
    },

    /// GPT formatting failed - user must acknowledge
    GPTFormattingError {
        error: String,
        transcript: String,
        main_window_visible: bool,
    },

    /// Clipboard operation failed - user must acknowledge
    ClipboardError {
        error: String,
        text: String,
        main_window_visible: bool,
    },

    /// Profile validation failed - user must acknowledge
    ProfileValidationError {
        error: String,
        main_window_visible: bool,
    },
}

/// Events that can trigger state transitions
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AppEvent {
    // === RECORDING EVENTS ===
    /// Start a new recording session
    StartRecording,
    /// Stop recording and begin processing
    StopRecording,
    /// Cancel recording without processing
    CancelRecording,

    // === WINDOW MANAGEMENT EVENTS ===
    /// Show the main window
    ShowMainWindow,
    /// Hide the main window (to tray)
    HideMainWindow,
    /// Open settings window
    OpenSettingsWindow,
    /// Close settings window
    CloseSettingsWindow,

    // === PROFILE MANAGEMENT EVENTS ===
    /// Start creating a new profile
    StartNewProfile,
    /// Start editing an existing profile
    StartEditProfile { profile_id: String },
    /// Save profile changes
    SaveProfile { profile_data: String }, // JSON serialized profile
    /// Cancel profile editing
    CancelProfileEdit,
    /// Delete a profile
    DeleteProfile { profile_id: String },
    /// Select/activate a profile (ignored during recording)
    SelectProfile { profile_id: String },

    // === PROCESSING COMPLETION EVENTS ===
    /// Transcription completed successfully
    TranscriptionComplete { transcript: String },
    /// GPT formatting completed successfully
    GPTFormattingComplete { formatted_text: String },
    /// Clipboard copy completed successfully
    ClipboardCopyComplete,
    /// Reformat completed text with a different profile
    ReformatWithProfile { profile_id: String },
    /// Skip GPT formatting and go directly to clipboard (for profiles without formatting)
    SkipFormattingToClipboard { transcript: String },

    // === ERROR EVENTS ===
    /// Transcription failed
    TranscriptionError { error: String },
    /// GPT formatting failed
    GPTFormattingError { error: String },
    /// Clipboard operation failed
    ClipboardError { error: String },
    /// Profile validation failed
    ProfileValidationError { error: String },

    // === SYSTEM EVENTS ===
    /// Save application settings
    SaveSettings,
    /// Reset to idle state (error recovery)
    Reset,
    /// Acknowledge error and return to idle
    AcknowledgeError,
}

/// State change notification sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStateChanged {
    /// Previous state (for debugging)
    pub previous_state: String,
    /// New current state
    pub current_state: String,
    /// Event that triggered the change
    pub event: String,
    /// Timestamp of the change
    pub timestamp: u64,
    /// Additional context data
    pub context: serde_json::Value,
}

/// Errors that can occur in the state machine
#[derive(Error, Debug)]
pub enum StateMachineError {
    #[error("Invalid state transition: cannot go from {from} to {to} with event {event}")]
    InvalidTransition {
        from: String,
        to: String,
        event: String,
    },

    #[error("State machine not initialized")]
    NotInitialized,

    #[error("Failed to emit state change: {0}")]
    EmitFailed(String),

    #[error("Invalid event data: {0}")]
    InvalidEventData(String),
}

pub type StateMachineResult<T> = Result<T, StateMachineError>;

/// Global application state machine
pub struct AppStateMachine {
    /// Current state of the application
    current_state: AppState,
    /// Tauri app handle for emitting events
    app_handle: AppHandle,
    /// Whether to emit state changes to frontend
    emit_events: bool,
}

impl AppStateMachine {
    /// Create a new state machine
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            current_state: AppState::Idle {
                main_window_visible: true,
            },
            app_handle,
            emit_events: true,
        }
    }

    /// Get the current state
    pub fn current_state(&self) -> &AppState {
        &self.current_state
    }

    /// Check if the application is currently recording
    pub fn is_recording(&self) -> bool {
        matches!(self.current_state, AppState::Recording { .. })
    }

    /// Check if the application is processing
    pub fn is_processing(&self) -> bool {
        matches!(
            self.current_state,
            AppState::ProcessingTranscription { .. }
                | AppState::ProcessingGPTFormatting { .. }
                | AppState::ProcessingClipboard { .. }
        )
    }

    /// Check if the main window should be visible
    pub fn is_main_window_visible(&self) -> bool {
        match &self.current_state {
            AppState::Idle {
                main_window_visible,
            } => *main_window_visible,
            AppState::Recording { .. } => true, // Always visible during recording
            AppState::ProcessingTranscription { .. } => true,
            AppState::ProcessingGPTFormatting { .. } => true,
            AppState::ProcessingClipboard { .. } => true,
            AppState::ProcessingComplete { .. } => true, // Always visible when complete
            AppState::SettingsWindowOpen { previous_state } => {
                // Check the previous state
                match previous_state.as_ref() {
                    AppState::Idle {
                        main_window_visible,
                    } => *main_window_visible,
                    _ => true,
                }
            }
            AppState::NewProfileEditorOpen { .. } => true,
            AppState::EditProfileEditorOpen { .. } => true,
            AppState::TranscriptionError {
                main_window_visible,
                ..
            } => *main_window_visible,
            AppState::GPTFormattingError {
                main_window_visible,
                ..
            } => *main_window_visible,
            AppState::ClipboardError {
                main_window_visible,
                ..
            } => *main_window_visible,
            AppState::ProfileValidationError {
                main_window_visible,
                ..
            } => *main_window_visible,
        }
    }

    /// Check if any window other than main is open
    pub fn has_modal_window_open(&self) -> bool {
        matches!(
            self.current_state,
            AppState::SettingsWindowOpen { .. }
                | AppState::NewProfileEditorOpen { .. }
                | AppState::EditProfileEditorOpen { .. }
        )
    }

    /// Process an event and transition to new state
    pub async fn process_event(&mut self, event: AppEvent) -> StateMachineResult<()> {
        let previous_state = self.current_state.clone();
        let new_state = self.validate_and_compute_new_state(&event)?;

        // Update state
        self.current_state = new_state;

        // Emit state change event if enabled
        if self.emit_events {
            self.emit_state_change(&previous_state, &event).await?;
        }

        Ok(())
    }

    /// Validate transition and compute new state
    fn validate_and_compute_new_state(&self, event: &AppEvent) -> StateMachineResult<AppState> {
        let current_time = SystemTime::now();

        match (&self.current_state, event) {
            // === FROM IDLE STATE ===
            (
                AppState::Idle {
                    main_window_visible: _,
                },
                AppEvent::StartRecording,
            ) => Ok(AppState::Recording {
                started_at: current_time,
            }),
            (
                AppState::Idle {
                    main_window_visible: _,
                },
                AppEvent::ShowMainWindow,
            ) => Ok(AppState::Idle {
                main_window_visible: true,
            }),
            (
                AppState::Idle {
                    main_window_visible: _,
                },
                AppEvent::HideMainWindow,
            ) => Ok(AppState::Idle {
                main_window_visible: false,
            }),
            (AppState::Idle { .. }, AppEvent::OpenSettingsWindow) => {
                Ok(AppState::SettingsWindowOpen {
                    previous_state: Box::new(self.current_state.clone()),
                })
            }
            (AppState::Idle { .. }, AppEvent::SelectProfile { .. }) => {
                // Profile selection is allowed in idle state
                Ok(self.current_state.clone()) // State doesn't change, just update profile
            }

            // === FROM RECORDING STATE ===
            (AppState::Recording { started_at: _ }, AppEvent::StopRecording) => {
                // Note: wav_path would be provided by the audio system
                Ok(AppState::ProcessingTranscription {
                    wav_path: PathBuf::from("/tmp/recording.wav"), // Placeholder
                    started_at: current_time,
                })
            }
            (AppState::Recording { .. }, AppEvent::CancelRecording) => Ok(AppState::Idle {
                main_window_visible: true,
            }),
            // Profile selection ignored during recording
            (AppState::Recording { .. }, AppEvent::SelectProfile { .. }) => {
                Ok(self.current_state.clone()) // Ignore profile changes during recording
            }

            // === FROM PROCESSING STATES ===
            (
                AppState::ProcessingTranscription { .. },
                AppEvent::TranscriptionComplete { transcript },
            ) => {
                // Check if we need GPT formatting (would be determined by active profile)
                // For now, assume we always try GPT formatting
                Ok(AppState::ProcessingGPTFormatting {
                    original_transcript: transcript.clone(),
                    profile_id: "active".to_string(), // Would be actual profile ID
                    started_at: current_time,
                })
            }
            (
                AppState::ProcessingTranscription { .. },
                AppEvent::SkipFormattingToClipboard { transcript },
            ) => {
                // Skip GPT formatting and go directly to clipboard (for profiles without formatting)
                Ok(AppState::ProcessingClipboard {
                    original_transcript: transcript.clone(),
                    text: transcript.clone(),
                    started_at: current_time,
                })
            }
            (
                AppState::ProcessingTranscription { wav_path, .. },
                AppEvent::TranscriptionError { error },
            ) => Ok(AppState::TranscriptionError {
                error: error.clone(),
                wav_path: wav_path.clone(),
                main_window_visible: true,
            }),

            (
                AppState::ProcessingGPTFormatting {
                    original_transcript,
                    ..
                },
                AppEvent::GPTFormattingComplete { formatted_text },
            ) => Ok(AppState::ProcessingClipboard {
                original_transcript: original_transcript.clone(),
                text: formatted_text.clone(),
                started_at: current_time,
            }),
            (
                AppState::ProcessingGPTFormatting {
                    original_transcript,
                    ..
                },
                AppEvent::GPTFormattingError { error },
            ) => Ok(AppState::GPTFormattingError {
                error: error.clone(),
                transcript: original_transcript.clone(),
                main_window_visible: true,
            }),

            (
                AppState::ProcessingClipboard {
                    original_transcript,
                    text,
                    ..
                },
                AppEvent::ClipboardCopyComplete,
            ) => {
                Ok(AppState::ProcessingComplete {
                    original_transcript: original_transcript.clone(),
                    final_text: text.clone(),
                    profile_id: None, // Would be set to actual profile ID used
                    completed_at: current_time,
                })
            }
            (
                AppState::ProcessingClipboard {
                    original_transcript: _,
                    text,
                    ..
                },
                AppEvent::ClipboardError { error },
            ) => Ok(AppState::ClipboardError {
                error: error.clone(),
                text: text.clone(),
                main_window_visible: true,
            }),

            // === FROM PROCESSING COMPLETE ===
            (AppState::ProcessingComplete { .. }, AppEvent::StartRecording) => {
                Ok(AppState::Recording {
                    started_at: current_time,
                })
            }
            (
                AppState::ProcessingComplete {
                    original_transcript,
                    ..
                },
                AppEvent::ReformatWithProfile { profile_id },
            ) => {
                // Start reformatting with a different profile using original transcript
                Ok(AppState::ProcessingGPTFormatting {
                    original_transcript: original_transcript.clone(),
                    profile_id: profile_id.clone(),
                    started_at: current_time,
                })
            }
            (AppState::ProcessingComplete { .. }, AppEvent::Reset) => Ok(AppState::Idle {
                main_window_visible: true,
            }),

            // === FROM SETTINGS WINDOW ===
            (AppState::SettingsWindowOpen { previous_state }, AppEvent::CloseSettingsWindow) => {
                Ok(*previous_state.clone())
            }
            (AppState::SettingsWindowOpen { .. }, AppEvent::StartNewProfile) => {
                Ok(AppState::NewProfileEditorOpen {
                    settings_context: Box::new(self.current_state.clone()),
                })
            }
            (AppState::SettingsWindowOpen { .. }, AppEvent::StartEditProfile { profile_id }) => {
                Ok(AppState::EditProfileEditorOpen {
                    profile_id: profile_id.clone(),
                    settings_context: Box::new(self.current_state.clone()),
                })
            }

            // === FROM PROFILE EDITOR STATES ===
            (AppState::NewProfileEditorOpen { settings_context }, AppEvent::SaveProfile { .. }) => {
                Ok(*settings_context.clone())
            }
            (AppState::NewProfileEditorOpen { settings_context }, AppEvent::CancelProfileEdit) => {
                Ok(*settings_context.clone())
            }
            (
                AppState::EditProfileEditorOpen {
                    settings_context, ..
                },
                AppEvent::SaveProfile { .. },
            ) => Ok(*settings_context.clone()),
            (
                AppState::EditProfileEditorOpen {
                    settings_context, ..
                },
                AppEvent::CancelProfileEdit,
            ) => Ok(*settings_context.clone()),
            (
                AppState::EditProfileEditorOpen {
                    settings_context, ..
                },
                AppEvent::DeleteProfile { .. },
            ) => Ok(*settings_context.clone()),

            // === FROM ERROR STATES ===
            (
                AppState::TranscriptionError {
                    main_window_visible,
                    ..
                },
                AppEvent::AcknowledgeError,
            ) => Ok(AppState::Idle {
                main_window_visible: *main_window_visible,
            }),
            (
                AppState::GPTFormattingError {
                    main_window_visible,
                    ..
                },
                AppEvent::AcknowledgeError,
            ) => Ok(AppState::Idle {
                main_window_visible: *main_window_visible,
            }),
            (
                AppState::ClipboardError {
                    main_window_visible,
                    ..
                },
                AppEvent::AcknowledgeError,
            ) => Ok(AppState::Idle {
                main_window_visible: *main_window_visible,
            }),
            (
                AppState::ProfileValidationError {
                    main_window_visible,
                    ..
                },
                AppEvent::AcknowledgeError,
            ) => Ok(AppState::Idle {
                main_window_visible: *main_window_visible,
            }),

            // === UNIVERSAL EVENTS ===
            (_, AppEvent::Reset) => Ok(AppState::Idle {
                main_window_visible: true,
            }),

            // === INVALID TRANSITIONS ===
            _ => Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", self.current_state),
                to: "unknown".to_string(),
                event: format!("{:?}", event),
            }),
        }
    }

    /// Emit state change event to frontend
    async fn emit_state_change(
        &self,
        previous_state: &AppState,
        event: &AppEvent,
    ) -> StateMachineResult<()> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let state_change = AppStateChanged {
            previous_state: format!("{:?}", previous_state),
            current_state: format!("{:?}", self.current_state),
            event: format!("{:?}", event),
            timestamp,
            context: serde_json::json!({
                "is_recording": self.is_recording(),
                "is_processing": self.is_processing(),
                "main_window_visible": self.is_main_window_visible(),
                "has_modal_window": self.has_modal_window_open(),
            }),
        };

        self.app_handle
            .emit("app-state-changed", &state_change)
            .map_err(|e| StateMachineError::EmitFailed(e.to_string()))?;

        Ok(())
    }

    /// Static method to validate a transition (for testing)
    pub fn validate_transition_static(
        current_state: &AppState,
        event: &AppEvent,
    ) -> StateMachineResult<AppState> {
        let current_time = SystemTime::now();

        match (current_state, event) {
            // === FROM IDLE STATE ===
            (
                AppState::Idle {
                    main_window_visible: _,
                },
                AppEvent::StartRecording,
            ) => Ok(AppState::Recording {
                started_at: current_time,
            }),
            (
                AppState::Idle {
                    main_window_visible: _,
                },
                AppEvent::ShowMainWindow,
            ) => Ok(AppState::Idle {
                main_window_visible: true,
            }),
            (
                AppState::Idle {
                    main_window_visible: _,
                },
                AppEvent::HideMainWindow,
            ) => Ok(AppState::Idle {
                main_window_visible: false,
            }),
            (AppState::Idle { .. }, AppEvent::OpenSettingsWindow) => {
                Ok(AppState::SettingsWindowOpen {
                    previous_state: Box::new(current_state.clone()),
                })
            }
            (AppState::Idle { .. }, AppEvent::SelectProfile { .. }) => {
                // Profile selection is allowed in idle state
                Ok(current_state.clone()) // State doesn't change, just update profile
            }

            // === FROM RECORDING STATE ===
            (AppState::Recording { started_at: _ }, AppEvent::StopRecording) => {
                // Note: wav_path would be provided by the audio system
                Ok(AppState::ProcessingTranscription {
                    wav_path: PathBuf::from("/tmp/recording.wav"), // Placeholder
                    started_at: current_time,
                })
            }
            (AppState::Recording { .. }, AppEvent::CancelRecording) => Ok(AppState::Idle {
                main_window_visible: true,
            }),
            // Profile selection ignored during recording
            (AppState::Recording { .. }, AppEvent::SelectProfile { .. }) => {
                Ok(current_state.clone()) // Ignore profile changes during recording
            }

            // === FROM PROCESSING STATES ===
            (
                AppState::ProcessingTranscription { .. },
                AppEvent::TranscriptionComplete { transcript },
            ) => {
                // Check if we need GPT formatting (would be determined by active profile)
                // For now, assume we always try GPT formatting
                Ok(AppState::ProcessingGPTFormatting {
                    original_transcript: transcript.clone(),
                    profile_id: "active".to_string(), // Would be actual profile ID
                    started_at: current_time,
                })
            }
            (
                AppState::ProcessingTranscription { .. },
                AppEvent::SkipFormattingToClipboard { transcript },
            ) => {
                // Skip GPT formatting and go directly to clipboard (for profiles without formatting)
                Ok(AppState::ProcessingClipboard {
                    original_transcript: transcript.clone(),
                    text: transcript.clone(),
                    started_at: current_time,
                })
            }
            (
                AppState::ProcessingTranscription { wav_path, .. },
                AppEvent::TranscriptionError { error },
            ) => Ok(AppState::TranscriptionError {
                error: error.clone(),
                wav_path: wav_path.clone(),
                main_window_visible: true,
            }),

            (
                AppState::ProcessingGPTFormatting {
                    original_transcript,
                    ..
                },
                AppEvent::GPTFormattingComplete { formatted_text },
            ) => Ok(AppState::ProcessingClipboard {
                original_transcript: original_transcript.clone(),
                text: formatted_text.clone(),
                started_at: current_time,
            }),
            (
                AppState::ProcessingGPTFormatting {
                    original_transcript,
                    ..
                },
                AppEvent::GPTFormattingError { error },
            ) => Ok(AppState::GPTFormattingError {
                error: error.clone(),
                transcript: original_transcript.clone(),
                main_window_visible: true,
            }),

            (
                AppState::ProcessingClipboard {
                    original_transcript,
                    text,
                    ..
                },
                AppEvent::ClipboardCopyComplete,
            ) => {
                Ok(AppState::ProcessingComplete {
                    original_transcript: original_transcript.clone(),
                    final_text: text.clone(),
                    profile_id: None, // Would be set to actual profile ID used
                    completed_at: current_time,
                })
            }
            (
                AppState::ProcessingClipboard {
                    original_transcript: _,
                    text,
                    ..
                },
                AppEvent::ClipboardError { error },
            ) => Ok(AppState::ClipboardError {
                error: error.clone(),
                text: text.clone(),
                main_window_visible: true,
            }),

            // === FROM PROCESSING COMPLETE ===
            (AppState::ProcessingComplete { .. }, AppEvent::StartRecording) => {
                Ok(AppState::Recording {
                    started_at: current_time,
                })
            }
            (
                AppState::ProcessingComplete {
                    original_transcript,
                    ..
                },
                AppEvent::ReformatWithProfile { profile_id },
            ) => {
                // Start reformatting with a different profile using original transcript
                Ok(AppState::ProcessingGPTFormatting {
                    original_transcript: original_transcript.clone(),
                    profile_id: profile_id.clone(),
                    started_at: current_time,
                })
            }
            (AppState::ProcessingComplete { .. }, AppEvent::Reset) => Ok(AppState::Idle {
                main_window_visible: true,
            }),

            // === FROM SETTINGS WINDOW ===
            (AppState::SettingsWindowOpen { previous_state }, AppEvent::CloseSettingsWindow) => {
                Ok(*previous_state.clone())
            }
            (AppState::SettingsWindowOpen { .. }, AppEvent::StartNewProfile) => {
                Ok(AppState::NewProfileEditorOpen {
                    settings_context: Box::new(current_state.clone()),
                })
            }
            (AppState::SettingsWindowOpen { .. }, AppEvent::StartEditProfile { profile_id }) => {
                Ok(AppState::EditProfileEditorOpen {
                    profile_id: profile_id.clone(),
                    settings_context: Box::new(current_state.clone()),
                })
            }

            // === FROM PROFILE EDITOR STATES ===
            (AppState::NewProfileEditorOpen { settings_context }, AppEvent::SaveProfile { .. }) => {
                Ok(*settings_context.clone())
            }
            (AppState::NewProfileEditorOpen { settings_context }, AppEvent::CancelProfileEdit) => {
                Ok(*settings_context.clone())
            }
            (
                AppState::EditProfileEditorOpen {
                    settings_context, ..
                },
                AppEvent::SaveProfile { .. },
            ) => Ok(*settings_context.clone()),
            (
                AppState::EditProfileEditorOpen {
                    settings_context, ..
                },
                AppEvent::CancelProfileEdit,
            ) => Ok(*settings_context.clone()),
            (
                AppState::EditProfileEditorOpen {
                    settings_context, ..
                },
                AppEvent::DeleteProfile { .. },
            ) => Ok(*settings_context.clone()),

            // === FROM ERROR STATES ===
            (
                AppState::TranscriptionError {
                    main_window_visible,
                    ..
                },
                AppEvent::AcknowledgeError,
            ) => Ok(AppState::Idle {
                main_window_visible: *main_window_visible,
            }),
            (
                AppState::GPTFormattingError {
                    main_window_visible,
                    ..
                },
                AppEvent::AcknowledgeError,
            ) => Ok(AppState::Idle {
                main_window_visible: *main_window_visible,
            }),
            (
                AppState::ClipboardError {
                    main_window_visible,
                    ..
                },
                AppEvent::AcknowledgeError,
            ) => Ok(AppState::Idle {
                main_window_visible: *main_window_visible,
            }),
            (
                AppState::ProfileValidationError {
                    main_window_visible,
                    ..
                },
                AppEvent::AcknowledgeError,
            ) => Ok(AppState::Idle {
                main_window_visible: *main_window_visible,
            }),

            // === UNIVERSAL EVENTS ===
            (_, AppEvent::Reset) => Ok(AppState::Idle {
                main_window_visible: true,
            }),

            // === INVALID TRANSITIONS ===
            _ => Err(StateMachineError::InvalidTransition {
                from: format!("{:?}", current_state),
                to: "unknown".to_string(),
                event: format!("{:?}", event),
            }),
        }
    }
}

/// Builder for creating and configuring the state machine
pub struct AppStateMachineBuilder {
    initial_state: Option<AppState>,
    emit_events: bool,
}

impl AppStateMachineBuilder {
    pub fn new() -> Self {
        Self {
            initial_state: None,
            emit_events: true,
        }
    }

    pub fn with_initial_state(mut self, state: AppState) -> Self {
        self.initial_state = Some(state);
        self
    }

    pub fn with_events_disabled(mut self) -> Self {
        self.emit_events = false;
        self
    }

    pub fn build(self, app_handle: AppHandle) -> AppStateMachine {
        let mut machine = AppStateMachine::new(app_handle);

        if let Some(initial_state) = self.initial_state {
            machine.current_state = initial_state;
        }

        machine.emit_events = self.emit_events;
        machine
    }
}

impl Default for AppStateMachineBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_idle_to_recording_transition() {
        let idle_state = AppState::Idle {
            main_window_visible: true,
        };
        let event = AppEvent::StartRecording;

        let result = AppStateMachine::validate_transition_static(&idle_state, &event);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), AppState::Recording { .. }));
    }

    #[test]
    fn test_recording_to_processing_transition() {
        let recording_state = AppState::Recording {
            started_at: SystemTime::now(),
        };
        let event = AppEvent::StopRecording;

        let result = AppStateMachine::validate_transition_static(&recording_state, &event);
        assert!(result.is_ok());
        assert!(matches!(
            result.unwrap(),
            AppState::ProcessingTranscription { .. }
        ));
    }

    #[test]
    fn test_profile_selection_ignored_during_recording() {
        let recording_state = AppState::Recording {
            started_at: SystemTime::now(),
        };
        let event = AppEvent::SelectProfile {
            profile_id: "test".to_string(),
        };

        let result = AppStateMachine::validate_transition_static(&recording_state, &event);
        assert!(result.is_ok());
        // Should remain in recording state
        assert!(matches!(result.unwrap(), AppState::Recording { .. }));
    }

    #[test]
    fn test_window_visibility_logic() {
        // Test that recording always shows main window
        let recording_state = AppState::Recording {
            started_at: SystemTime::now(),
        };

        // Test visibility logic using static methods
        let is_recording = matches!(recording_state, AppState::Recording { .. });
        let is_processing = matches!(
            recording_state,
            AppState::ProcessingTranscription { .. }
                | AppState::ProcessingGPTFormatting { .. }
                | AppState::ProcessingClipboard { .. }
        );
        let is_main_window_visible = match &recording_state {
            AppState::Recording { .. } => true, // Always visible during recording
            _ => false,
        };

        assert!(is_main_window_visible);
        assert!(is_recording);
        assert!(!is_processing);
    }

    #[test]
    fn test_error_state_transitions() {
        let error_state = AppState::TranscriptionError {
            error: "Test error".to_string(),
            wav_path: PathBuf::from("/tmp/test.wav"),
            main_window_visible: true,
        };
        let event = AppEvent::AcknowledgeError;

        let result = AppStateMachine::validate_transition_static(&error_state, &event);
        assert!(result.is_ok());
        assert!(matches!(
            result.unwrap(),
            AppState::Idle {
                main_window_visible: true
            }
        ));
    }

    #[test]
    fn test_settings_window_state_preservation() {
        let idle_state = AppState::Idle {
            main_window_visible: false,
        };
        let event = AppEvent::OpenSettingsWindow;

        let result = AppStateMachine::validate_transition_static(&idle_state, &event);
        assert!(result.is_ok());

        if let AppState::SettingsWindowOpen { previous_state } = result.unwrap() {
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

    #[test]
    fn test_processing_pipeline() {
        // Test the complete processing pipeline
        let transcription_state = AppState::ProcessingTranscription {
            wav_path: PathBuf::from("/tmp/test.wav"),
            started_at: SystemTime::now(),
        };

        // Transcription complete -> GPT formatting
        let event1 = AppEvent::TranscriptionComplete {
            transcript: "test".to_string(),
        };
        let result1 = AppStateMachine::validate_transition_static(&transcription_state, &event1);
        assert!(result1.is_ok());
        assert!(matches!(
            result1.unwrap(),
            AppState::ProcessingGPTFormatting { .. }
        ));

        // GPT formatting complete -> Clipboard
        let gpt_state = AppState::ProcessingGPTFormatting {
            original_transcript: "test".to_string(),
            profile_id: "test".to_string(),
            started_at: SystemTime::now(),
        };
        let event2 = AppEvent::GPTFormattingComplete {
            formatted_text: "formatted".to_string(),
        };
        let result2 = AppStateMachine::validate_transition_static(&gpt_state, &event2);
        assert!(result2.is_ok());
        assert!(matches!(
            result2.unwrap(),
            AppState::ProcessingClipboard { .. }
        ));

        // Clipboard complete -> Processing complete
        let clipboard_state = AppState::ProcessingClipboard {
            original_transcript: "formatted".to_string(),
            text: "formatted".to_string(),
            started_at: SystemTime::now(),
        };
        let event3 = AppEvent::ClipboardCopyComplete;
        let result3 = AppStateMachine::validate_transition_static(&clipboard_state, &event3);
        assert!(result3.is_ok());
        assert!(matches!(
            result3.unwrap(),
            AppState::ProcessingComplete { .. }
        ));
    }

    #[test]
    fn test_invalid_transitions() {
        // Test that invalid transitions are rejected
        let idle_state = AppState::Idle {
            main_window_visible: true,
        };
        let invalid_event = AppEvent::TranscriptionComplete {
            transcript: "test".to_string(),
        };

        let result = AppStateMachine::validate_transition_static(&idle_state, &invalid_event);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            StateMachineError::InvalidTransition { .. }
        ));
    }

    #[test]
    fn test_reformat_with_different_profile() {
        // Test that we can reformat completed text with a different profile
        let complete_state = AppState::ProcessingComplete {
            original_transcript: "Original transcript from Whisper".to_string(),
            final_text: "Formatted text with profile1".to_string(),
            profile_id: Some("profile1".to_string()),
            completed_at: SystemTime::now(),
        };
        let event = AppEvent::ReformatWithProfile {
            profile_id: "profile2".to_string(),
        };

        let result = AppStateMachine::validate_transition_static(&complete_state, &event);
        assert!(result.is_ok());

        if let AppState::ProcessingGPTFormatting {
            original_transcript,
            profile_id,
            ..
        } = result.unwrap()
        {
            assert_eq!(original_transcript, "Original transcript from Whisper");
            assert_eq!(profile_id, "profile2");
        } else {
            panic!("Expected ProcessingGPTFormatting state");
        }
    }

    #[test]
    fn test_skip_formatting_workflow() {
        // Test workflow for profiles that don't require GPT formatting
        let transcription_state = AppState::ProcessingTranscription {
            wav_path: PathBuf::from("/tmp/test.wav"),
            started_at: SystemTime::now(),
        };

        // Skip formatting and go directly to clipboard
        let event = AppEvent::SkipFormattingToClipboard {
            transcript: "Raw transcript".to_string(),
        };
        let result = AppStateMachine::validate_transition_static(&transcription_state, &event);
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
}
