//! ShortcutMgr service for managing global keyboard shortcuts
//!
//! This service manages global keyboard shortcuts for DictaClerk using
//! the Tauri global shortcut plugin. It provides functionality to:
//! - Register global hotkeys
//! - Unregister hotkeys
//! - Handle shortcut conflicts
//! - Emit toggleRecord events

use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use thiserror::Error;
use tokio::sync::Mutex;

/// Error types for shortcut operations
#[derive(Error, Debug)]
pub enum ShortcutError {
    #[error("Failed to parse shortcut: {0}")]
    ParseError(String),
    #[error("Failed to register shortcut: {0}")]
    RegistrationFailed(String),
    #[error("Failed to unregister shortcut: {0}")]
    UnregistrationFailed(String),
    #[error("Shortcut unavailable: {shortcut}")]
    ShortcutUnavailable { shortcut: String },
    #[error("Shortcut manager not initialized")]
    NotInitialized,
}

/// Result type for shortcut operations
pub type ShortcutResult<T> = Result<T, ShortcutError>;

/// Event data for shortcut events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutEvent {
    pub shortcut: String,
    pub action: String,
}

/// Configuration for the shortcut manager
#[derive(Debug, Clone)]
pub struct ShortcutMgrConfig {
    /// Global shortcut key combination
    pub global_shortcut: String,
    /// Whether to show error toasts on conflict
    pub show_error_toasts: bool,
}

impl Default for ShortcutMgrConfig {
    fn default() -> Self {
        Self {
            global_shortcut: "CmdOrCtrl+Shift+F9".to_string(),
            show_error_toasts: true,
        }
    }
}

/// ShortcutMgr service for managing global keyboard shortcuts
pub struct ShortcutMgr {
    /// Tauri app handle for emitting events
    app_handle: AppHandle,
    /// Configuration
    config: ShortcutMgrConfig,
    /// Map of registered shortcuts
    registered_shortcuts: Arc<Mutex<HashMap<String, Shortcut>>>,
}

impl ShortcutMgr {
    /// Create a new ShortcutMgr instance
    pub fn new(app_handle: AppHandle, config: ShortcutMgrConfig) -> Self {
        Self {
            app_handle,
            config,
            registered_shortcuts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a new ShortcutMgr instance with default configuration
    pub fn new_with_defaults(app_handle: AppHandle) -> Self {
        Self::new(app_handle, ShortcutMgrConfig::default())
    }

    /// Register the global hotkey for toggling recording
    pub async fn register_hotkey(&self) -> ShortcutResult<()> {
        let shortcut_str = &self.config.global_shortcut;

        // Parse the shortcut string
        let shortcut: Shortcut = shortcut_str
            .parse()
            .map_err(|e| ShortcutError::ParseError(format!("{}", e)))?;

        // Clone app_handle for the closure
        let app_handle = self.app_handle.clone();
        let shortcut_str_clone = shortcut_str.clone();

        // Attempt to register the shortcut
        let registration_result = self.app_handle.global_shortcut().on_shortcut(
            shortcut,
            move |_app_handle, _shortcut, _event| {
                // Emit toggleRecordWithTray event when shortcut is pressed for tray integration
                if let Err(e) = app_handle.emit(
                    "toggleRecordWithTray",
                    ShortcutEvent {
                        shortcut: shortcut_str_clone.clone(),
                        action: "toggle".to_string(),
                    },
                ) {
                    eprintln!("Failed to emit toggleRecordWithTray event: {}", e);
                }
            },
        );

        match registration_result {
            Ok(_) => {
                // Store the registered shortcut
                let mut shortcuts = self.registered_shortcuts.lock().await;
                shortcuts.insert(shortcut_str.clone(), shortcut);

                println!("Successfully registered global shortcut: {}", shortcut_str);
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Failed to register shortcut '{}': {}", shortcut_str, e);

                // Show error toast if enabled
                if self.config.show_error_toasts {
                    if let Err(emit_err) = self.app_handle.emit("shortcut_error", error_msg.clone())
                    {
                        eprintln!("Failed to emit shortcut error event: {}", emit_err);
                    }
                }

                Err(ShortcutError::ShortcutUnavailable {
                    shortcut: shortcut_str.clone(),
                })
            }
        }
    }

    /// Unregister the global hotkey
    pub async fn unregister(&self) -> ShortcutResult<()> {
        let shortcut_str = &self.config.global_shortcut;

        // Parse the shortcut string
        let shortcut: Shortcut = shortcut_str
            .parse()
            .map_err(|e| ShortcutError::ParseError(format!("{}", e)))?;

        // Attempt to unregister the shortcut
        let unregistration_result = self.app_handle.global_shortcut().unregister(shortcut);

        match unregistration_result {
            Ok(_) => {
                // Remove from registered shortcuts
                let mut shortcuts = self.registered_shortcuts.lock().await;
                shortcuts.remove(shortcut_str);

                println!(
                    "Successfully unregistered global shortcut: {}",
                    shortcut_str
                );
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Failed to unregister shortcut '{}': {}", shortcut_str, e);
                eprintln!("{}", error_msg);

                Err(ShortcutError::UnregistrationFailed(error_msg))
            }
        }
    }

    /// Unregister all registered shortcuts
    pub async fn unregister_all(&self) -> ShortcutResult<()> {
        let shortcuts = self.registered_shortcuts.lock().await;
        let shortcuts_to_unregister: Vec<Shortcut> = shortcuts.values().cloned().collect();
        drop(shortcuts); // Release the lock before the loop

        let mut errors = Vec::new();

        for shortcut in shortcuts_to_unregister {
            if let Err(e) = self.app_handle.global_shortcut().unregister(shortcut) {
                errors.push(format!("Failed to unregister shortcut: {}", e));
            }
        }

        // Clear the registered shortcuts map
        let mut shortcuts = self.registered_shortcuts.lock().await;
        shortcuts.clear();

        if errors.is_empty() {
            println!("Successfully unregistered all shortcuts");
            Ok(())
        } else {
            let error_msg = errors.join("; ");
            eprintln!("{}", error_msg);
            Err(ShortcutError::UnregistrationFailed(error_msg))
        }
    }

    /// Check if a shortcut is currently registered
    pub async fn is_registered(&self) -> bool {
        let shortcuts = self.registered_shortcuts.lock().await;
        shortcuts.contains_key(&self.config.global_shortcut)
    }

    /// Update the shortcut configuration and re-register if necessary
    pub async fn update_shortcut(&mut self, new_shortcut: String) -> ShortcutResult<()> {
        // Unregister current shortcut if registered
        if self.is_registered().await {
            self.unregister().await?;
        }

        // Update configuration
        self.config.global_shortcut = new_shortcut;

        // Register the new shortcut
        self.register_hotkey().await
    }

    /// Get the current shortcut configuration
    pub fn get_shortcut(&self) -> &str {
        &self.config.global_shortcut
    }

    /// Get the app handle (for creating new instances)
    pub fn get_app_handle(&self) -> &AppHandle {
        &self.app_handle
    }

    /// Register a profile shortcut for quick profile selection
    pub async fn register_profile_shortcut(
        &self,
        profile_id: String,
        shortcut_str: String,
    ) -> ShortcutResult<()> {
        // Parse the shortcut string
        let shortcut: Shortcut = shortcut_str
            .parse()
            .map_err(|e| ShortcutError::ParseError(format!("{}", e)))?;

        // Clone app_handle and profile_id for the closure
        let app_handle = self.app_handle.clone();
        let profile_id_clone = profile_id.clone();
        let shortcut_str_clone = shortcut_str.clone();

        // Create unique key for this profile shortcut
        let shortcut_key = format!("profile_{}", profile_id);

        // Attempt to register the shortcut
        let registration_result = self.app_handle.global_shortcut().on_shortcut(
            shortcut,
            move |_app_handle, _shortcut, _event| {
                // Emit selectProfile event when shortcut is pressed
                if let Err(e) = app_handle.emit(
                    "selectProfile",
                    serde_json::json!({
                        "profile_id": profile_id_clone.clone(),
                        "shortcut": shortcut_str_clone.clone(),
                        "action": "select"
                    }),
                ) {
                    eprintln!("Failed to emit selectProfile event: {}", e);
                }
            },
        );

        match registration_result {
            Ok(_) => {
                // Store the registered shortcut
                let mut shortcuts = self.registered_shortcuts.lock().await;
                shortcuts.insert(shortcut_key, shortcut);

                println!(
                    "Successfully registered profile shortcut: {} for profile: {}",
                    shortcut_str, profile_id
                );
                Ok(())
            }
            Err(e) => {
                let error_msg = format!(
                    "Failed to register profile shortcut '{}' for profile '{}': {}",
                    shortcut_str, profile_id, e
                );

                // Show error toast if enabled
                if self.config.show_error_toasts {
                    if let Err(emit_err) = self.app_handle.emit("shortcut_error", error_msg.clone())
                    {
                        eprintln!("Failed to emit shortcut error event: {}", emit_err);
                    }
                }

                Err(ShortcutError::ShortcutUnavailable {
                    shortcut: shortcut_str,
                })
            }
        }
    }

    /// Unregister a profile shortcut
    pub async fn unregister_profile_shortcut(&self, profile_id: &str) -> ShortcutResult<()> {
        let shortcut_key = format!("profile_{}", profile_id);

        // Get and remove the shortcut from our tracking
        let shortcut = {
            let mut shortcuts = self.registered_shortcuts.lock().await;
            shortcuts.remove(&shortcut_key)
        };

        if let Some(shortcut) = shortcut {
            // Attempt to unregister the shortcut
            let unregistration_result = self.app_handle.global_shortcut().unregister(shortcut);

            match unregistration_result {
                Ok(_) => {
                    println!(
                        "Successfully unregistered profile shortcut for profile: {}",
                        profile_id
                    );
                    Ok(())
                }
                Err(e) => {
                    let error_msg = format!(
                        "Failed to unregister profile shortcut for profile '{}': {}",
                        profile_id, e
                    );
                    eprintln!("{}", error_msg);

                    Err(ShortcutError::UnregistrationFailed(error_msg))
                }
            }
        } else {
            // Profile shortcut was not registered
            Ok(())
        }
    }

    /// Register all profile shortcuts from a profile collection
    pub async fn register_profile_shortcuts(
        &self,
        profiles: &crate::services::ProfileCollection,
    ) -> ShortcutResult<()> {
        let mut errors: Vec<String> = Vec::new();

        for profile in &profiles.profiles {
            if let Some(shortcut) = &profile.shortcut {
                if !shortcut.trim().is_empty() {
                    match self
                        .register_profile_shortcut(profile.id.clone(), shortcut.clone())
                        .await
                    {
                        Ok(_) => eprintln!("✅ Registered profile shortcut: {}", shortcut),
                        Err(e) => {
                            let error_msg = format!(
                                "Failed to register profile shortcut: {} for profile {}: {}",
                                shortcut, profile.id, e
                            );
                            eprintln!("⚠️ {}", error_msg);
                            errors.push(error_msg);
                        }
                    }
                }
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            let error_msg = errors.join("; ");
            eprintln!("{}", error_msg);
            Err(ShortcutError::RegistrationFailed(error_msg))
        }
    }

    /// Unregister all profile shortcuts
    pub async fn unregister_all_profile_shortcuts(&self) -> ShortcutResult<()> {
        let shortcuts = self.registered_shortcuts.lock().await;
        let profile_shortcuts: Vec<String> = shortcuts
            .keys()
            .filter(|k| k.starts_with("profile_"))
            .map(|k| k.strip_prefix("profile_").unwrap().to_string())
            .collect();
        drop(shortcuts); // Release the lock before the loop

        let mut errors = Vec::new();

        for profile_id in profile_shortcuts {
            if let Err(e) = self.unregister_profile_shortcut(&profile_id).await {
                errors.push(format!(
                    "Failed to unregister profile shortcut for '{}': {}",
                    profile_id, e
                ));
            }
        }

        if errors.is_empty() {
            println!("Successfully unregistered all profile shortcuts");
            Ok(())
        } else {
            let error_msg = errors.join("; ");
            eprintln!("{}", error_msg);
            Err(ShortcutError::UnregistrationFailed(error_msg))
        }
    }

    /// Check if a specific shortcut string is already registered (for conflict detection)
    pub async fn is_shortcut_registered(&self, shortcut_str: &str) -> bool {
        let shortcuts = self.registered_shortcuts.lock().await;

        // Check if it's the global shortcut
        if shortcut_str == self.config.global_shortcut {
            return shortcuts.contains_key(&self.config.global_shortcut);
        }

        // Check all registered shortcuts
        for registered_shortcut in shortcuts.keys() {
            // We need to check if the shortcut string matches any registered shortcut
            // Since we store the parsed Shortcut, we need to compare the original strings
            // This is a simplified approach - in a real implementation you might want
            // to store both the string and parsed shortcut
            if registered_shortcut.contains(&shortcut_str.replace(" ", "")) {
                return true;
            }
        }

        false
    }
}

impl Drop for ShortcutMgr {
    fn drop(&mut self) {
        // Note: We can't call async methods in Drop, so we use blocking approach
        // In a real implementation, you might want to handle this differently
        println!("ShortcutMgr is being dropped");
    }
}
