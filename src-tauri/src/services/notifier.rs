//! Notifier service for success, warning, and error toasts
//! Provides uniform UX feedback using tauri-plugin-notification

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_notification::{NotificationExt, PermissionState};
use thiserror::Error;

/// Notification levels for different types of messages
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum NotificationLevel {
    Success,
    Warning,
    Error,
}

impl NotificationLevel {
    /// Get the default duration for this notification level
    pub fn default_duration(&self) -> Duration {
        match self {
            NotificationLevel::Success => Duration::from_secs(3), // 3s for success
            NotificationLevel::Warning => Duration::from_secs(5), // 5s for warnings
            NotificationLevel::Error => Duration::from_secs(7),   // 7s for errors
        }
    }

    /// Get the icon/visual indicator for this level
    pub fn icon(&self) -> &'static str {
        match self {
            NotificationLevel::Success => "✅",
            NotificationLevel::Warning => "⚠️",
            NotificationLevel::Error => "❌",
        }
    }

    /// Get a descriptive prefix for accessibility
    pub fn accessibility_label(&self) -> &'static str {
        match self {
            NotificationLevel::Success => "Success: ",
            NotificationLevel::Warning => "Warning: ",
            NotificationLevel::Error => "Error: ",
        }
    }
}

/// Errors that can occur in the notifier service
#[derive(Debug, Error)]
pub enum NotifierError {
    #[error("Permission not granted for notifications")]
    PermissionDenied,
    #[error("Failed to send notification: {message}")]
    SendFailed { message: String },
    #[error("Notification service not available")]
    ServiceNotAvailable,
    #[error("Invalid notification parameters: {message}")]
    InvalidParameters { message: String },
}

/// Result type for notifier operations
pub type NotifierResult<T> = Result<T, NotifierError>;

/// Trait for notification services
#[async_trait]
pub trait Notifier: Send + Sync {
    /// Send a notification with the specified level and message
    async fn notify(&self, level: NotificationLevel, message: &str) -> NotifierResult<()>;

    /// Send a success notification (convenience method)
    async fn success(&self, message: &str) -> NotifierResult<()> {
        self.notify(NotificationLevel::Success, message).await
    }

    /// Send a warning notification (convenience method)
    async fn warning(&self, message: &str) -> NotifierResult<()> {
        self.notify(NotificationLevel::Warning, message).await
    }

    /// Send an error notification (convenience method)
    async fn error(&self, message: &str) -> NotifierResult<()> {
        self.notify(NotificationLevel::Error, message).await
    }
}

/// Tauri-based notification service implementation
pub struct TauriNotifierService {
    app_handle: AppHandle,
}

impl TauriNotifierService {
    /// Create a new Tauri notifier service
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Check and request notification permissions if needed
    async fn ensure_permissions(&self) -> NotifierResult<()> {
        let notification = self.app_handle.notification();

        // Check current permission state
        match notification.permission_state() {
            Ok(PermissionState::Granted) => Ok(()),
            Ok(PermissionState::Denied) => Err(NotifierError::PermissionDenied),
            Ok(_) => {
                // Need to request permission
                match notification.request_permission() {
                    Ok(PermissionState::Granted) => Ok(()),
                    Ok(_) => Err(NotifierError::PermissionDenied),
                    Err(e) => Err(NotifierError::SendFailed {
                        message: format!("Failed to request permission: {}", e),
                    }),
                }
            }
            Err(e) => Err(NotifierError::SendFailed {
                message: format!("Failed to check permission: {}", e),
            }),
        }
    }
}

#[async_trait]
impl Notifier for TauriNotifierService {
    async fn notify(&self, level: NotificationLevel, message: &str) -> NotifierResult<()> {
        // Ensure we have permissions
        self.ensure_permissions().await?;

        // Validate message
        if message.is_empty() {
            return Err(NotifierError::InvalidParameters {
                message: "Notification message cannot be empty".to_string(),
            });
        }

        // Create notification with level-specific formatting
        let title = match level {
            NotificationLevel::Success => "Success",
            NotificationLevel::Warning => "Warning",
            NotificationLevel::Error => "Error",
        };

        let formatted_message = format!("{}{}", level.accessibility_label(), message);

        // Send the notification
        match self
            .app_handle
            .notification()
            .builder()
            .title(title)
            .body(&formatted_message)
            .show()
        {
            Ok(_) => Ok(()),
            Err(e) => Err(NotifierError::SendFailed {
                message: format!("Failed to show notification: {}", e),
            }),
        }
    }
}

/// Mock notifier service for testing
pub struct MockNotifierService {
    should_fail: bool,
    sent_notifications: std::sync::Mutex<Vec<(NotificationLevel, String)>>,
}

impl MockNotifierService {
    /// Create a new mock notifier that succeeds
    pub fn new() -> Self {
        Self {
            should_fail: false,
            sent_notifications: std::sync::Mutex::new(Vec::new()),
        }
    }

    /// Create a new mock notifier that fails
    pub fn new_failing() -> Self {
        Self {
            should_fail: true,
            sent_notifications: std::sync::Mutex::new(Vec::new()),
        }
    }

    /// Get all sent notifications for testing
    pub fn get_sent_notifications(&self) -> Vec<(NotificationLevel, String)> {
        self.sent_notifications.lock().unwrap().clone()
    }

    /// Clear all sent notifications
    pub fn clear(&self) {
        self.sent_notifications.lock().unwrap().clear();
    }
}

impl Default for MockNotifierService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Notifier for MockNotifierService {
    async fn notify(&self, level: NotificationLevel, message: &str) -> NotifierResult<()> {
        if self.should_fail {
            return Err(NotifierError::SendFailed {
                message: "Mock notifier configured to fail".to_string(),
            });
        }

        if message.is_empty() {
            return Err(NotifierError::InvalidParameters {
                message: "Notification message cannot be empty".to_string(),
            });
        }

        // Store the notification for testing verification
        self.sent_notifications
            .lock()
            .unwrap()
            .push((level, message.to_string()));

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_level_defaults() {
        assert_eq!(
            NotificationLevel::Success.default_duration(),
            Duration::from_secs(3)
        );
        assert_eq!(
            NotificationLevel::Warning.default_duration(),
            Duration::from_secs(5)
        );
        assert_eq!(
            NotificationLevel::Error.default_duration(),
            Duration::from_secs(7)
        );
    }

    #[test]
    fn test_notification_level_icons() {
        assert_eq!(NotificationLevel::Success.icon(), "✅");
        assert_eq!(NotificationLevel::Warning.icon(), "⚠️");
        assert_eq!(NotificationLevel::Error.icon(), "❌");
    }

    #[test]
    fn test_notification_level_accessibility() {
        assert_eq!(
            NotificationLevel::Success.accessibility_label(),
            "Success: "
        );
        assert_eq!(
            NotificationLevel::Warning.accessibility_label(),
            "Warning: "
        );
        assert_eq!(NotificationLevel::Error.accessibility_label(), "Error: ");
    }

    #[tokio::test]
    async fn test_mock_notify_success() {
        let notifier = MockNotifierService::new();
        let result = notifier
            .notify(NotificationLevel::Success, "Test message")
            .await;
        assert!(result.is_ok());

        let notifications = notifier.get_sent_notifications();
        assert_eq!(notifications.len(), 1);
        assert_eq!(notifications[0].0, NotificationLevel::Success);
        assert_eq!(notifications[0].1, "Test message");
    }

    #[tokio::test]
    async fn test_mock_notify_failure() {
        let notifier = MockNotifierService::new_failing();
        let result = notifier
            .notify(NotificationLevel::Success, "This should fail")
            .await;
        assert!(matches!(result, Err(NotifierError::SendFailed { .. })));
        assert!(notifier.get_sent_notifications().is_empty());
    }

    #[tokio::test]
    async fn test_mock_empty_message() {
        let notifier = MockNotifierService::new();
        let result = notifier.notify(NotificationLevel::Success, "").await;
        assert!(matches!(
            result,
            Err(NotifierError::InvalidParameters { .. })
        ));
    }

    #[tokio::test]
    async fn test_convenience_methods() {
        let notifier = MockNotifierService::new();

        let _ = notifier.success("Success message").await;
        let _ = notifier.warning("Warning message").await;
        let _ = notifier.error("Error message").await;

        let notifications = notifier.get_sent_notifications();
        assert_eq!(notifications.len(), 3);
        assert_eq!(notifications[0].0, NotificationLevel::Success);
        assert_eq!(notifications[1].0, NotificationLevel::Warning);
        assert_eq!(notifications[2].0, NotificationLevel::Error);
    }

    #[tokio::test]
    async fn test_clear_notifications() {
        let notifier = MockNotifierService::new();
        let _ = notifier.success("Test").await;
        assert_eq!(notifier.get_sent_notifications().len(), 1);

        notifier.clear();
        assert_eq!(notifier.get_sent_notifications().len(), 0);
    }

    #[test]
    fn test_notification_level_serialization() {
        let level = NotificationLevel::Success;
        let serialized = serde_json::to_string(&level).unwrap();
        let deserialized: NotificationLevel = serde_json::from_str(&serialized).unwrap();
        assert_eq!(level, deserialized);
    }
}
