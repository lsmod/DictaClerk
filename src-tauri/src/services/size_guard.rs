//! SizeGuard service for monitoring encoder size and warning at thresholds
//!
//! This service subscribes to encoder size forecast events and triggers
//! a warning notification when the 23MB threshold is crossed for the first time.
//!
//! ## Usage Example
//!
//! ```rust,no_run
//! use std::sync::Arc;
//! use dicta_clerk_lib::services::{SizeGuard, StubNotifier};
//!
//! // Create notifier service (will be real implementation in issue #16)
//! let notifier = Arc::new(StubNotifier::new());
//!
//! // Create SizeGuard with default 23MB threshold
//! let mut size_guard = SizeGuard::new(notifier);
//!
//! // Subscribe to encoder events
//! let event_sender = size_guard.subscribe_to_encoder();
//!
//! // Use this sender in your encoder to send progress events:
//! // encoder.encode(&wav_path, None, Some(event_sender)).await?;
//! ```
//!
//! ## Integration with Encoder
//!
//! The SizeGuard works by listening to `EncodingEvent` messages from the encoder.
//! When the estimated file size crosses the 23MB threshold, it automatically
//! triggers a warning notification through the `Notifier` service.
//!
//! The warning is sent exactly once per encoding session and resets automatically
//! when encoding completes or encounters an error.

use crate::audio::EncodingEvent;
use crate::services::Notifier;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::mpsc;

/// Configuration for SizeGuard
#[derive(Debug, Clone)]
pub struct SizeGuardConfig {
    /// Size threshold in bytes (default: 23MB)
    pub threshold_bytes: u64,
    /// Warning message to display
    pub warning_message: String,
}

impl Default for SizeGuardConfig {
    fn default() -> Self {
        Self {
            threshold_bytes: 23 * 1024 * 1024, // 23MB as per requirements
            warning_message: "Approaching Whisper upload limit".to_string(),
        }
    }
}

/// Errors that can occur in SizeGuard operations
#[derive(Error, Debug)]
pub enum SizeGuardError {
    #[error("Notification failed: {0}")]
    NotificationFailed(String),
    #[error("Channel error: {0}")]
    ChannelError(String),
    #[error("Service not initialized")]
    NotInitialized,
}

/// SizeGuard service for monitoring encoding size and triggering warnings
pub struct SizeGuard {
    /// Configuration for the size guard
    config: SizeGuardConfig,
    /// Notifier service for sending warnings
    notifier: Arc<dyn Notifier>,
    /// Flag to track if warning has been sent (prevents duplicates)
    warned: Arc<AtomicBool>,
    /// Channel sender for internal communication
    event_sender: Option<mpsc::UnboundedSender<EncodingEvent>>,
}

impl SizeGuard {
    /// Create a new SizeGuard with default configuration
    pub fn new(notifier: Arc<dyn Notifier>) -> Self {
        Self {
            config: SizeGuardConfig::default(),
            notifier,
            warned: Arc::new(AtomicBool::new(false)),
            event_sender: None,
        }
    }

    /// Create a new SizeGuard with custom configuration
    pub fn with_config(notifier: Arc<dyn Notifier>, config: SizeGuardConfig) -> Self {
        Self {
            config,
            notifier,
            warned: Arc::new(AtomicBool::new(false)),
            event_sender: None,
        }
    }

    /// Subscribe to encoder size stream
    /// Returns a channel sender that the encoder can use to send events
    pub fn subscribe_to_encoder(&mut self) -> mpsc::UnboundedSender<EncodingEvent> {
        let (sender, receiver) = mpsc::unbounded_channel();

        // Store the sender for potential future use
        self.event_sender = Some(sender.clone());

        // Clone necessary data for the monitoring task
        let notifier = Arc::clone(&self.notifier);
        let warned = Arc::clone(&self.warned);
        let threshold = self.config.threshold_bytes;
        let message = self.config.warning_message.clone();

        // Spawn task to monitor encoding events
        tokio::spawn(async move {
            Self::monitor_encoding_events(receiver, notifier, warned, threshold, message).await;
        });

        sender
    }

    /// Internal method to monitor encoding events and trigger warnings
    async fn monitor_encoding_events(
        mut receiver: mpsc::UnboundedReceiver<EncodingEvent>,
        notifier: Arc<dyn Notifier>,
        warned: Arc<AtomicBool>,
        threshold: u64,
        message: String,
    ) {
        while let Some(event) = receiver.recv().await {
            match event {
                EncodingEvent::Progress {
                    estimated_total, ..
                } => {
                    // Check if we've crossed the threshold and haven't warned yet
                    if estimated_total >= threshold
                        && !warned.load(Ordering::Relaxed)
                        && !warned
                            .compare_exchange(false, true, Ordering::Relaxed, Ordering::Relaxed)
                            .unwrap_or(true)
                    {
                        // Successfully set the flag, send the warning
                        if let Err(e) = notifier.warn(&message).await {
                            eprintln!("Failed to send size warning: {}", e);
                        }
                    }
                }
                EncodingEvent::SizeAlmostLimit { estimated_size } => {
                    // Handle direct size limit events from encoder
                    if estimated_size >= threshold
                        && !warned.load(Ordering::Relaxed)
                        && !warned
                            .compare_exchange(false, true, Ordering::Relaxed, Ordering::Relaxed)
                            .unwrap_or(true)
                    {
                        if let Err(e) = notifier.warn(&message).await {
                            eprintln!("Failed to send size warning: {}", e);
                        }
                    }
                }
                EncodingEvent::Completed { .. } => {
                    // Reset warned flag for next encoding session
                    warned.store(false, Ordering::Relaxed);
                }
                EncodingEvent::Error { .. } => {
                    // Reset warned flag on error
                    warned.store(false, Ordering::Relaxed);
                }
            }
        }
    }

    /// Reset the warning state (useful for testing or manual reset)
    pub fn reset_warning_state(&self) {
        self.warned.store(false, Ordering::Relaxed);
    }

    /// Check if a warning has been sent
    pub fn has_warned(&self) -> bool {
        self.warned.load(Ordering::Relaxed)
    }

    /// Get the current threshold in bytes
    pub fn threshold_bytes(&self) -> u64 {
        self.config.threshold_bytes
    }

    /// Get the current warning message
    pub fn warning_message(&self) -> &str {
        &self.config.warning_message
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::StubNotifier;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use tokio::time::{sleep, Duration};

    /// Test implementation of Notifier that counts warnings
    struct TestNotifier {
        warn_count: Arc<AtomicUsize>,
        last_message: Arc<tokio::sync::Mutex<String>>,
    }

    impl TestNotifier {
        fn new() -> Self {
            Self {
                warn_count: Arc::new(AtomicUsize::new(0)),
                last_message: Arc::new(tokio::sync::Mutex::new(String::new())),
            }
        }

        fn warn_count(&self) -> usize {
            self.warn_count.load(Ordering::Relaxed)
        }

        async fn last_message(&self) -> String {
            self.last_message.lock().await.clone()
        }
    }

    #[async_trait::async_trait]
    impl Notifier for TestNotifier {
        async fn warn(
            &self,
            message: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            self.warn_count.fetch_add(1, Ordering::Relaxed);
            *self.last_message.lock().await = message.to_string();
            Ok(())
        }

        async fn info(
            &self,
            _message: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            Ok(())
        }

        async fn error(
            &self,
            _message: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_size_guard_creation() {
        let notifier = Arc::new(StubNotifier::new());
        let size_guard = SizeGuard::new(notifier);

        assert_eq!(size_guard.threshold_bytes(), 23 * 1024 * 1024);
        assert_eq!(
            size_guard.warning_message(),
            "Approaching Whisper upload limit"
        );
        assert!(!size_guard.has_warned());
    }

    #[tokio::test]
    async fn test_size_guard_with_custom_config() {
        let notifier = Arc::new(StubNotifier::new());
        let config = SizeGuardConfig {
            threshold_bytes: 10 * 1024 * 1024, // 10MB
            warning_message: "Custom warning message".to_string(),
        };
        let size_guard = SizeGuard::with_config(notifier, config);

        assert_eq!(size_guard.threshold_bytes(), 10 * 1024 * 1024);
        assert_eq!(size_guard.warning_message(), "Custom warning message");
    }

    #[tokio::test]
    async fn test_warning_triggered_at_threshold() {
        let test_notifier = Arc::new(TestNotifier::new());
        let mut size_guard = SizeGuard::new(test_notifier.clone());
        let sender = size_guard.subscribe_to_encoder();

        // Send progress event below threshold
        sender
            .send(EncodingEvent::Progress {
                bytes_processed: 10 * 1024 * 1024, // 10MB
                estimated_total: 20 * 1024 * 1024, // 20MB
            })
            .unwrap();

        // Give time for processing
        sleep(Duration::from_millis(10)).await;
        assert_eq!(test_notifier.warn_count(), 0);

        // Send progress event at threshold
        sender
            .send(EncodingEvent::Progress {
                bytes_processed: 20 * 1024 * 1024, // 20MB
                estimated_total: 24 * 1024 * 1024, // 24MB (above 23MB threshold)
            })
            .unwrap();

        // Give time for processing
        sleep(Duration::from_millis(10)).await;
        assert_eq!(test_notifier.warn_count(), 1);
        assert_eq!(
            test_notifier.last_message().await,
            "Approaching Whisper upload limit"
        );
        assert!(size_guard.has_warned());
    }

    #[tokio::test]
    async fn test_no_duplicate_warnings() {
        let test_notifier = Arc::new(TestNotifier::new());
        let mut size_guard = SizeGuard::new(test_notifier.clone());
        let sender = size_guard.subscribe_to_encoder();

        // Send multiple events above threshold
        for i in 1..=5 {
            sender
                .send(EncodingEvent::Progress {
                    bytes_processed: (20 + i) * 1024 * 1024,
                    estimated_total: (24 + i) * 1024 * 1024, // All above 23MB
                })
                .unwrap();
        }

        // Give time for processing
        sleep(Duration::from_millis(50)).await;

        // Should only warn once
        assert_eq!(test_notifier.warn_count(), 1);
    }

    #[tokio::test]
    async fn test_warning_reset_on_completion() {
        let test_notifier = Arc::new(TestNotifier::new());
        let mut size_guard = SizeGuard::new(test_notifier.clone());
        let sender = size_guard.subscribe_to_encoder();

        // Trigger warning
        sender
            .send(EncodingEvent::Progress {
                bytes_processed: 20 * 1024 * 1024,
                estimated_total: 24 * 1024 * 1024,
            })
            .unwrap();

        sleep(Duration::from_millis(10)).await;
        assert_eq!(test_notifier.warn_count(), 1);
        assert!(size_guard.has_warned());

        // Send completion event
        sender
            .send(EncodingEvent::Completed {
                final_info: crate::audio::OggInfo {
                    size_estimate: 24 * 1024 * 1024,
                    path: std::path::PathBuf::from("/tmp/test.ogg"),
                    actual_size: Some(24 * 1024 * 1024),
                },
            })
            .unwrap();

        sleep(Duration::from_millis(10)).await;
        assert!(!size_guard.has_warned()); // Should be reset

        // Trigger warning again - should work
        sender
            .send(EncodingEvent::Progress {
                bytes_processed: 20 * 1024 * 1024,
                estimated_total: 24 * 1024 * 1024,
            })
            .unwrap();

        sleep(Duration::from_millis(10)).await;
        assert_eq!(test_notifier.warn_count(), 2); // Second warning
    }

    #[tokio::test]
    async fn test_size_almost_limit_event() {
        let test_notifier = Arc::new(TestNotifier::new());
        let mut size_guard = SizeGuard::new(test_notifier.clone());
        let sender = size_guard.subscribe_to_encoder();

        // Send SizeAlmostLimit event
        sender
            .send(EncodingEvent::SizeAlmostLimit {
                estimated_size: 24 * 1024 * 1024,
            })
            .unwrap();

        sleep(Duration::from_millis(10)).await;
        assert_eq!(test_notifier.warn_count(), 1);
    }

    #[tokio::test]
    async fn test_manual_warning_reset() {
        let test_notifier = Arc::new(TestNotifier::new());
        let mut size_guard = SizeGuard::new(test_notifier.clone());
        let sender = size_guard.subscribe_to_encoder();

        // Trigger warning
        sender
            .send(EncodingEvent::Progress {
                bytes_processed: 20 * 1024 * 1024,
                estimated_total: 24 * 1024 * 1024,
            })
            .unwrap();

        sleep(Duration::from_millis(10)).await;
        assert!(size_guard.has_warned());

        // Manual reset
        size_guard.reset_warning_state();
        assert!(!size_guard.has_warned());

        // Should be able to warn again
        sender
            .send(EncodingEvent::Progress {
                bytes_processed: 21 * 1024 * 1024,
                estimated_total: 25 * 1024 * 1024,
            })
            .unwrap();

        sleep(Duration::from_millis(10)).await;
        assert_eq!(test_notifier.warn_count(), 2);
    }

    #[tokio::test]
    async fn test_threshold_boundary_conditions() {
        let test_notifier = Arc::new(TestNotifier::new());
        let config = SizeGuardConfig {
            threshold_bytes: 23 * 1024 * 1024,
            warning_message: "Test warning".to_string(),
        };
        let mut size_guard = SizeGuard::with_config(test_notifier.clone(), config);
        let sender = size_guard.subscribe_to_encoder();

        // Test exactly at threshold
        sender
            .send(EncodingEvent::Progress {
                bytes_processed: 20 * 1024 * 1024,
                estimated_total: 23 * 1024 * 1024, // Exactly 23MB
            })
            .unwrap();

        sleep(Duration::from_millis(10)).await;
        assert_eq!(test_notifier.warn_count(), 1);

        // Reset for next test
        size_guard.reset_warning_state();

        // Test just below threshold
        sender
            .send(EncodingEvent::Progress {
                bytes_processed: 20 * 1024 * 1024,
                estimated_total: 23 * 1024 * 1024 - 1, // Just below 23MB
            })
            .unwrap();

        sleep(Duration::from_millis(10)).await;
        assert_eq!(test_notifier.warn_count(), 1); // Should not increase
    }

    #[tokio::test]
    async fn test_sequence_crossing_threshold() {
        let test_notifier = Arc::new(TestNotifier::new());
        let mut size_guard = SizeGuard::new(test_notifier.clone());
        let sender = size_guard.subscribe_to_encoder();

        // Simulate realistic encoding progression
        let sizes = [
            5 * 1024 * 1024,  // 5MB
            10 * 1024 * 1024, // 10MB
            15 * 1024 * 1024, // 15MB
            20 * 1024 * 1024, // 20MB
            22 * 1024 * 1024, // 22MB - still below threshold
            24 * 1024 * 1024, // 24MB - crosses threshold
            26 * 1024 * 1024, // 26MB - continued recording
        ];

        for (i, size) in sizes.iter().enumerate() {
            sender
                .send(EncodingEvent::Progress {
                    bytes_processed: (i as u64 + 1) * 1024 * 1024,
                    estimated_total: *size,
                })
                .unwrap();

            sleep(Duration::from_millis(5)).await;
        }

        // Give time for final processing
        sleep(Duration::from_millis(20)).await;

        // Should warn exactly once when crossing 23MB
        assert_eq!(test_notifier.warn_count(), 1);
    }
}
