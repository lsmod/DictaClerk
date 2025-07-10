/// Mock Tauri infrastructure for testing
///
/// This module provides mock implementations of Tauri components
/// needed for state machine testing without requiring a real Tauri app.

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

/// Mock event storage for testing event emissions
#[derive(Debug, Clone, Default)]
pub struct MockEventStore {
    pub events: Arc<Mutex<Vec<(String, Value)>>>,
}

impl MockEventStore {
    pub fn new() -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn add_event(&self, event_name: String, payload: Value) {
        let mut events = self.events.lock().unwrap();
        events.push((event_name, payload));
    }

    pub fn get_events(&self) -> Vec<(String, Value)> {
        let events = self.events.lock().unwrap();
        events.clone()
    }

    pub fn clear(&self) {
        let mut events = self.events.lock().unwrap();
        events.clear();
    }

    pub fn count(&self) -> usize {
        let events = self.events.lock().unwrap();
        events.len()
    }

    pub fn last_event(&self) -> Option<(String, Value)> {
        let events = self.events.lock().unwrap();
        events.last().cloned()
    }

    pub fn events_by_name(&self, name: &str) -> Vec<Value> {
        let events = self.events.lock().unwrap();
        events.iter()
            .filter(|(event_name, _)| event_name == name)
            .map(|(_, payload)| payload.clone())
            .collect()
    }
}

/// Mock Tauri AppHandle for testing
///
/// This provides a minimal implementation of AppHandle that can be used
/// in tests without requiring a full Tauri application context.
pub struct MockAppHandle {
    pub event_store: MockEventStore,
}

impl MockAppHandle {
    pub fn new() -> Self {
        Self {
            event_store: MockEventStore::new(),
        }
    }

    pub fn new_with_store(event_store: MockEventStore) -> Self {
        Self { event_store }
    }
}

impl Default for MockAppHandle {
    fn default() -> Self {
        Self::new()
    }
}

// Note: We can't implement Emitter for MockAppHandle directly because
// AppHandle is a concrete type from Tauri, not a trait. Instead, we'll
// create helper functions that work with the actual AppHandle in tests.

/// Create a mock AppHandle for testing
///
/// This function creates a minimal Tauri app context suitable for testing.
/// The returned AppHandle can be used with the state machine but won't
/// actually emit events to a real frontend.
pub fn create_mock_app_handle() -> Result<AppHandle, Box<dyn std::error::Error>> {
    // For now, we'll return an error since creating a real AppHandle
    // requires a full Tauri app context. In real tests, we'll use
    // the state machine's static validation methods instead.
    Err("Mock AppHandle creation not implemented - use static validation methods".into())
}

/// Test helper to verify event emissions
///
/// This can be used in integration tests to verify that the state machine
/// properly emits events when configured to do so.
pub fn verify_state_change_event(
    events: &[(String, Value)],
    expected_event: &str,
    expected_previous_state: &str,
    expected_current_state: &str,
) -> bool {
    events.iter().any(|(event_name, payload)| {
        if event_name != expected_event {
            return false;
        }

        if let Some(obj) = payload.as_object() {
            let prev_state = obj.get("previous_state")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let curr_state = obj.get("current_state")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            prev_state == expected_previous_state && curr_state == expected_current_state
        } else {
            false
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_event_store() {
        let store = MockEventStore::new();
        assert_eq!(store.count(), 0);

        store.add_event("test_event".to_string(), serde_json::json!({"data": "test"}));
        assert_eq!(store.count(), 1);

        let events = store.get_events();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].0, "test_event");

        store.clear();
        assert_eq!(store.count(), 0);
    }

    #[test]
    fn test_event_filtering() {
        let store = MockEventStore::new();

        store.add_event("event1".to_string(), serde_json::json!({"id": 1}));
        store.add_event("event2".to_string(), serde_json::json!({"id": 2}));
        store.add_event("event1".to_string(), serde_json::json!({"id": 3}));

        let event1_payloads = store.events_by_name("event1");
        assert_eq!(event1_payloads.len(), 2);

        let event2_payloads = store.events_by_name("event2");
        assert_eq!(event2_payloads.len(), 1);
    }

    #[test]
    fn test_verify_state_change_event() {
        let events = vec![
            ("state_changed".to_string(), serde_json::json!({
                "previous_state": "Idle",
                "current_state": "Recording",
                "event": "StartRecording"
            }))
        ];

        assert!(verify_state_change_event(
            &events,
            "state_changed",
            "Idle",
            "Recording"
        ));

        assert!(!verify_state_change_event(
            &events,
            "state_changed",
            "Recording",
            "Idle"
        ));
    }
}
