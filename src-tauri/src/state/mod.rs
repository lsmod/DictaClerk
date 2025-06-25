/// State management for the DictaClerk application
///
/// This module contains the global application state machine that coordinates
/// all aspects of the application including recording, window management,
/// profile operations, and error handling.
pub mod recording_state_machine;

#[cfg(test)]
pub mod tests;

use std::sync::Arc;
use tokio::sync::Mutex;

// Global state machine singleton type
pub type AppStateMachineState =
    Arc<Mutex<Option<Arc<Mutex<recording_state_machine::AppStateMachine>>>>>;

// Re-export the global state machine types
pub use recording_state_machine::{
    AppEvent, AppState, AppStateChanged, AppStateMachineBuilder, StateMachineError,
    StateMachineResult,
};
