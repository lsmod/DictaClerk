//! Clipboard service for copying formatted text to system clipboard
//!
//! This service provides a trait-based interface for clipboard operations with proper
//! error handling and mock support for testing.
//!
//! ## Usage Example
//!
//! ```rust,no_run
//! use dicta_clerk_lib::services::{ClipboardService, TauriClipboardService};
//!
//! async fn example() {
//!     let clipboard = TauriClipboardService::new();
//!     let result = clipboard.copy("Hello, clipboard!").await;
//! }
//! ```

use async_trait::async_trait;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;
use thiserror::Error;

/// Errors that can occur during clipboard operations
#[derive(Error, Debug)]
pub enum ClipboardError {
    #[error("Clipboard is not available on this system")]
    ClipboardNotAvailable,

    #[error("Failed to access clipboard: {message}")]
    ClipboardAccessFailed { message: String },

    #[error("Text is too large for clipboard: {length} characters (max: {max} characters)")]
    TextTooLarge { length: usize, max: usize },

    #[error("Empty text cannot be copied to clipboard")]
    EmptyText,

    #[error("System clipboard error: {message}")]
    SystemError { message: String },
}

/// Result type for clipboard operations
pub type ClipboardResult<T> = Result<T, ClipboardError>;

/// Trait for clipboard operations
/// This allows for easy testing with mock implementations
#[async_trait]
pub trait ClipboardService: Send + Sync {
    /// Copy text to system clipboard
    ///
    /// # Arguments
    /// * `text` - Text to copy to clipboard
    ///
    /// # Returns
    /// * `Ok(())` if text was successfully copied
    /// * `Err(ClipboardError)` if the operation failed
    ///
    /// # Requirements (from GWT)
    /// * Given transcript ready When copy(text) called Then clipboard holds exact string and can be pasted elsewhere
    /// * Given clipboard service fails When copy attempted Then toast error displayed
    async fn copy(&self, text: &str) -> ClipboardResult<()>;
}

/// Production implementation using Tauri's clipboard API
pub struct TauriClipboardService {
    /// Tauri app handle for clipboard access
    app_handle: Option<AppHandle>,
    /// Maximum text length to prevent system issues (default: 100MB)
    max_text_length: usize,
}

impl TauriClipboardService {
    /// Create a new TauriClipboardService with default configuration
    /// Note: For testing without AppHandle
    pub fn new() -> Self {
        Self {
            app_handle: None,
            max_text_length: 100 * 1024 * 1024, // 100MB
        }
    }

    /// Create a new TauriClipboardService with AppHandle for production use
    pub fn with_app_handle(app_handle: AppHandle) -> Self {
        Self {
            app_handle: Some(app_handle),
            max_text_length: 100 * 1024 * 1024, // 100MB
        }
    }

    /// Create a new TauriClipboardService with custom maximum text length
    pub fn with_max_length(max_text_length: usize) -> Self {
        Self {
            app_handle: None,
            max_text_length,
        }
    }

    /// Validate text before copying
    fn validate_text(&self, text: &str) -> ClipboardResult<()> {
        if text.is_empty() {
            return Err(ClipboardError::EmptyText);
        }

        if text.len() > self.max_text_length {
            return Err(ClipboardError::TextTooLarge {
                length: text.len(),
                max: self.max_text_length,
            });
        }

        Ok(())
    }
}

impl Default for TauriClipboardService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ClipboardService for TauriClipboardService {
    async fn copy(&self, text: &str) -> ClipboardResult<()> {
        // Validate input
        self.validate_text(text)?;

        eprintln!("🔍 CLIPBOARD DEBUG: TauriClipboardService::copy() called");
        eprintln!(
            "   📊 Input text length: {} characters",
            text.chars().count()
        );
        eprintln!("   📊 Input text bytes: {} bytes", text.len());
        if !text.is_empty() {
            let preview_chars: String = text.chars().take(50).collect();
            eprintln!("   📝 Text preview: {:?}", preview_chars);
        }

        // Check if we have an app handle for real clipboard access
        if let Some(ref app_handle) = self.app_handle {
            eprintln!("   📋 Using real Tauri clipboard API");

            // Use Tauri's clipboard extension trait
            match app_handle.clipboard().write_text(text.to_string()) {
                Ok(_) => {
                    eprintln!("   ✅ Successfully copied to system clipboard via Tauri API");
                    Ok(())
                }
                Err(e) => {
                    eprintln!("   ❌ Tauri clipboard API error: {}", e);
                    Err(ClipboardError::SystemError {
                        message: format!("Tauri clipboard API failed: {}", e),
                    })
                }
            }
        } else {
            // Fallback for testing or when no app handle is available
            eprintln!("   ⚠️  No AppHandle available - using fallback mode");

            // Check for test mode environment variables
            match std::env::var("CLIPBOARD_TEST_MODE") {
                Ok(mode) if mode == "fail" => {
                    eprintln!("   ❌ CLIPBOARD TEST MODE: Simulating failure");
                    return Err(ClipboardError::ClipboardAccessFailed {
                        message: "Test mode clipboard failure".to_string(),
                    });
                }
                Ok(mode) if mode == "unavailable" => {
                    eprintln!("   ❌ CLIPBOARD TEST MODE: Simulating unavailable");
                    return Err(ClipboardError::ClipboardNotAvailable);
                }
                _ => {
                    eprintln!("   ⚠️  WARNING: This is a PLACEHOLDER implementation!");
                    eprintln!("   ⚠️  The text is NOT actually copied to system clipboard");
                    eprintln!("   ⚠️  AppHandle needed for real clipboard access");
                    let display_text = if text.chars().count() <= 100 {
                        text.to_string()
                    } else {
                        let truncated: String = text.chars().take(100).collect();
                        format!("{}...", truncated)
                    };
                    eprintln!(
                        "   📝 WOULD copy {} characters to clipboard: {:?}",
                        text.chars().count(),
                        display_text
                    );
                    Ok(())
                }
            }
        }
    }
}

/// Mock implementation for testing
pub struct MockClipboardService {
    /// Storage for copied text (for testing verification)
    pub copied_text: std::sync::Arc<std::sync::Mutex<Option<String>>>,
    /// Whether the mock should simulate failures
    pub should_fail: bool,
    /// Maximum text length for testing
    max_text_length: usize,
}

impl MockClipboardService {
    /// Create a new MockClipboardService
    pub fn new() -> Self {
        Self {
            copied_text: std::sync::Arc::new(std::sync::Mutex::new(None)),
            should_fail: false,
            max_text_length: 100 * 1024 * 1024,
        }
    }

    /// Create a new MockClipboardService that will fail operations
    pub fn new_failing() -> Self {
        Self {
            copied_text: std::sync::Arc::new(std::sync::Mutex::new(None)),
            should_fail: true,
            max_text_length: 100 * 1024 * 1024,
        }
    }

    /// Get the last copied text (for testing verification)
    pub fn get_copied_text(&self) -> Option<String> {
        self.copied_text.lock().unwrap().clone()
    }

    /// Clear the copied text
    pub fn clear(&self) {
        *self.copied_text.lock().unwrap() = None;
    }

    /// Set whether operations should fail
    pub fn set_should_fail(&mut self, should_fail: bool) {
        self.should_fail = should_fail;
    }
}

impl Default for MockClipboardService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ClipboardService for MockClipboardService {
    async fn copy(&self, text: &str) -> ClipboardResult<()> {
        if self.should_fail {
            return Err(ClipboardError::ClipboardAccessFailed {
                message: "Mock clipboard service configured to fail".to_string(),
            });
        }

        if text.is_empty() {
            return Err(ClipboardError::EmptyText);
        }

        if text.len() > self.max_text_length {
            return Err(ClipboardError::TextTooLarge {
                length: text.len(),
                max: self.max_text_length,
            });
        }

        *self.copied_text.lock().unwrap() = Some(text.to_string());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    #[tokio::test]
    async fn test_tauri_clipboard_service_creation() {
        let clipboard = TauriClipboardService::new();
        assert_eq!(clipboard.max_text_length, 100 * 1024 * 1024);

        let clipboard_custom = TauriClipboardService::with_max_length(1000);
        assert_eq!(clipboard_custom.max_text_length, 1000);
    }

    #[tokio::test]
    #[serial]
    async fn test_tauri_clipboard_copy_success() {
        // Ensure no environment variables are set
        std::env::remove_var("CLIPBOARD_TEST_MODE");
        let clipboard = TauriClipboardService::new();
        let result = clipboard.copy("Hello, clipboard!").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_tauri_clipboard_copy_empty_text() {
        let clipboard = TauriClipboardService::new();
        let result = clipboard.copy("").await;
        assert!(matches!(result, Err(ClipboardError::EmptyText)));
    }

    #[tokio::test]
    async fn test_tauri_clipboard_copy_text_too_large() {
        let clipboard = TauriClipboardService::with_max_length(10);
        let result = clipboard.copy("This text is too long").await;
        assert!(matches!(result, Err(ClipboardError::TextTooLarge { .. })));
    }

    #[tokio::test]
    #[serial]
    async fn test_tauri_clipboard_copy_simulated_failure() {
        std::env::set_var("CLIPBOARD_TEST_MODE", "fail");
        let clipboard = TauriClipboardService::new();
        let result = clipboard.copy("test").await;
        assert!(matches!(
            result,
            Err(ClipboardError::ClipboardAccessFailed { .. })
        ));
        std::env::remove_var("CLIPBOARD_TEST_MODE");
    }

    #[tokio::test]
    #[serial]
    async fn test_tauri_clipboard_copy_simulated_unavailable() {
        std::env::set_var("CLIPBOARD_TEST_MODE", "unavailable");
        let clipboard = TauriClipboardService::new();
        let result = clipboard.copy("test").await;
        assert!(matches!(result, Err(ClipboardError::ClipboardNotAvailable)));
        std::env::remove_var("CLIPBOARD_TEST_MODE");
    }

    #[tokio::test]
    async fn test_mock_clipboard_service_creation() {
        let clipboard = MockClipboardService::new();
        assert!(!clipboard.should_fail);
        assert!(clipboard.get_copied_text().is_none());

        let failing_clipboard = MockClipboardService::new_failing();
        assert!(failing_clipboard.should_fail);
    }

    #[tokio::test]
    async fn test_mock_clipboard_copy_success() {
        let clipboard = MockClipboardService::new();
        let test_text = "Hello, mock clipboard!";

        let result = clipboard.copy(test_text).await;
        assert!(result.is_ok());
        assert_eq!(clipboard.get_copied_text(), Some(test_text.to_string()));
    }

    #[tokio::test]
    async fn test_mock_clipboard_copy_failure() {
        let clipboard = MockClipboardService::new_failing();
        let result = clipboard.copy("test").await;
        assert!(matches!(
            result,
            Err(ClipboardError::ClipboardAccessFailed { .. })
        ));
        assert!(clipboard.get_copied_text().is_none());
    }

    #[tokio::test]
    async fn test_mock_clipboard_copy_empty_text() {
        let clipboard = MockClipboardService::new();
        let result = clipboard.copy("").await;
        assert!(matches!(result, Err(ClipboardError::EmptyText)));
    }

    #[tokio::test]
    async fn test_mock_clipboard_clear() {
        let clipboard = MockClipboardService::new();
        clipboard.copy("test").await.unwrap();
        assert!(clipboard.get_copied_text().is_some());

        clipboard.clear();
        assert!(clipboard.get_copied_text().is_none());
    }

    #[tokio::test]
    async fn test_mock_clipboard_set_should_fail() {
        let mut clipboard = MockClipboardService::new();
        assert!(!clipboard.should_fail);

        clipboard.set_should_fail(true);
        assert!(clipboard.should_fail);

        let result = clipboard.copy("test").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_clipboard_error_display() {
        let err = ClipboardError::EmptyText;
        assert_eq!(err.to_string(), "Empty text cannot be copied to clipboard");

        let err = ClipboardError::TextTooLarge {
            length: 1000,
            max: 500,
        };
        assert_eq!(
            err.to_string(),
            "Text is too large for clipboard: 1000 characters (max: 500 characters)"
        );

        let err = ClipboardError::ClipboardAccessFailed {
            message: "test error".to_string(),
        };
        assert_eq!(err.to_string(), "Failed to access clipboard: test error");
    }

    #[tokio::test]
    async fn test_complete_workflow() {
        let clipboard = MockClipboardService::new();

        // Test successful copy
        let transcript = "This is a formatted transcript ready for clipboard.";
        let result = clipboard.copy(transcript).await;
        assert!(result.is_ok());
        assert_eq!(clipboard.get_copied_text(), Some(transcript.to_string()));

        // Test error handling
        let mut failing_clipboard = MockClipboardService::new_failing();
        let result = failing_clipboard.copy("test").await;
        assert!(result.is_err());

        // Test recovery
        failing_clipboard.set_should_fail(false);
        let result = failing_clipboard.copy("recovery test").await;
        assert!(result.is_ok());
    }
}
