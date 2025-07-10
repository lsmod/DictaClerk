/// Test utilities for state machine testing
///
/// This module provides mock infrastructure, test builders, and common
/// utilities for comprehensive state machine testing.

pub mod mock_tauri;
pub mod state_builders;

// Re-export all utilities for easy access
pub use mock_tauri::*;
pub use state_builders::*;
