use crate::services::{
    ClipboardError, ClipboardService, Notifier, StubNotifier, TauriClipboardService,
};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Global state for the clipboard service
pub type ClipboardServiceState = Arc<Mutex<Option<Arc<dyn ClipboardService + Send + Sync>>>>;

/// Initialize the clipboard service
#[tauri::command]
pub async fn init_clipboard_service(
    state: State<'_, ClipboardServiceState>,
) -> Result<String, String> {
    let clipboard_service =
        Arc::new(TauriClipboardService::new()) as Arc<dyn ClipboardService + Send + Sync>;
    let mut state_guard = state.lock().await;
    *state_guard = Some(clipboard_service);

    Ok("Clipboard service initialized successfully".to_string())
}

/// Copy formatted text to system clipboard
/// This is the main command that will be called from the frontend after profile engine
#[tauri::command]
pub async fn copy_to_clipboard(
    text: String,
    state: State<'_, ClipboardServiceState>,
) -> Result<String, String> {
    let state_guard = state.lock().await;

    if let Some(ref clipboard_service) = *state_guard {
        // Attempt to copy to clipboard
        match clipboard_service.copy(&text).await {
            Ok(()) => Ok(format!(
                "Successfully copied {} characters to clipboard",
                text.len()
            )),
            Err(clipboard_error) => {
                // Format user-friendly error message
                let error_msg = format_clipboard_error(&clipboard_error);

                // Send toast error notification as per requirements
                let notifier = StubNotifier::new();
                if let Err(notify_err) = notifier.error(&error_msg).await {
                    eprintln!("Failed to send error notification: {}", notify_err);
                }

                Err(error_msg)
            }
        }
    } else {
        let error_msg = "Clipboard service not initialized. Call init_clipboard_service first.";

        // Send toast error notification
        let notifier = StubNotifier::new();
        if let Err(notify_err) = notifier.error(error_msg).await {
            eprintln!("Failed to send error notification: {}", notify_err);
        }

        Err(error_msg.to_string())
    }
}

/// Check if clipboard service is initialized
#[tauri::command]
pub async fn is_clipboard_initialized(
    state: State<'_, ClipboardServiceState>,
) -> Result<bool, String> {
    let state_guard = state.lock().await;
    Ok(state_guard.is_some())
}

/// Get clipboard service information
#[tauri::command]
pub fn get_clipboard_info() -> serde_json::Value {
    serde_json::json!({
        "supported_operations": ["copy"],
        "max_text_size_mb": 100,
        "features": [
            "text_validation",
            "error_notifications",
            "size_limits",
            "async_operations"
        ],
        "requirements": {
            "system_clipboard": true,
            "desktop_environment": true
        }
    })
}

/// Convert ClipboardError to user-friendly error message
/// This follows the pattern used in whisper.rs for error formatting
pub fn format_clipboard_error(error: &ClipboardError) -> String {
    match error {
        ClipboardError::ClipboardNotAvailable => {
            "Clipboard is not available on this system. Please ensure you're running on a desktop environment.".to_string()
        }
        ClipboardError::ClipboardAccessFailed { message } => {
            format!("Failed to access clipboard: {}", message)
        }
        ClipboardError::TextTooLarge { length, max } => {
            format!(
                "Text is too large for clipboard: {:.1}MB (maximum: {:.1}MB). Please reduce the text size.",
                *length as f64 / (1024.0 * 1024.0),
                *max as f64 / (1024.0 * 1024.0)
            )
        }
        ClipboardError::EmptyText => {
            "Cannot copy empty text to clipboard. Please ensure the transcript contains content.".to_string()
        }
        ClipboardError::SystemError { message } => {
            format!("System clipboard error: {}", message)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_clipboard_info() {
        let info = get_clipboard_info();
        assert!(info.is_object());
        assert!(info["supported_operations"].is_array());
        assert!(info["max_text_size_mb"].is_number());
        assert!(info["features"].is_array());
    }

    #[test]
    fn test_format_clipboard_error() {
        let error = ClipboardError::EmptyText;
        let formatted = format_clipboard_error(&error);
        assert!(formatted.contains("Cannot copy empty text"));

        let error = ClipboardError::TextTooLarge {
            length: 1024 * 1024,
            max: 512 * 1024,
        };
        let formatted = format_clipboard_error(&error);
        assert!(formatted.contains("1.0MB"));
        assert!(formatted.contains("0.5MB"));

        let error = ClipboardError::ClipboardNotAvailable;
        let formatted = format_clipboard_error(&error);
        assert!(formatted.contains("not available"));

        let error = ClipboardError::ClipboardAccessFailed {
            message: "test error".to_string(),
        };
        let formatted = format_clipboard_error(&error);
        assert!(formatted.contains("test error"));
    }
}
