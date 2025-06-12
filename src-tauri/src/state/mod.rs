/// State management for the DictaClerk application
///
/// This module contains the global application state machine that coordinates
/// all aspects of the application including recording, window management,
/// profile operations, and error handling.
pub mod recording_state_machine;

// Re-export the global state machine types
pub use recording_state_machine::{
    AppEvent, AppState, AppStateChanged, AppStateMachine, AppStateMachineBuilder,
    StateMachineError, StateMachineResult,
};
