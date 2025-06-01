//! Simple Notifier service trait for UI notifications
//! This will be implemented properly in issue #16

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Notification levels for different types of messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NotificationLevel {
    Info,
    Warning,
    Error,
}

/// Trait for sending notifications to the UI
/// This is a placeholder interface that will be fully implemented in issue #16
#[async_trait]
pub trait Notifier: Send + Sync {
    /// Send a warning notification
    async fn warn(&self, message: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;

    /// Send an info notification
    async fn info(&self, message: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;

    /// Send an error notification
    async fn error(&self, message: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
}

/// Simple stub implementation for development
/// This will be replaced with the real implementation in issue #16
pub struct StubNotifier;

impl StubNotifier {
    pub fn new() -> Self {
        Self
    }
}

impl Default for StubNotifier {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Notifier for StubNotifier {
    async fn warn(&self, message: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // For now, just log the warning - UI implementation will come in issue #16
        eprintln!("WARN: {}", message);
        Ok(())
    }

    async fn info(&self, message: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        eprintln!("INFO: {}", message);
        Ok(())
    }

    async fn error(&self, message: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        eprintln!("ERROR: {}", message);
        Ok(())
    }
}
