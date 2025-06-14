use serde::{Deserialize, Serialize};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};
use tempfile::NamedTempFile;

use crate::commands::ShortcutMgrState;
use crate::services::notifier::{Notifier, TauriNotifierService};
use crate::services::profile_engine::{ProfileCollection, ProfileEngine};
use crate::utils::{ensure_config_directory, find_config_file_path};

/// Settings configuration structure matching settings.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsConfig {
    pub whisper: WhisperSettings,
    pub audio: AudioSettings,
    pub encoding: EncodingSettings,
    pub ui: UiSettings,
    pub global_shortcut: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperSettings {
    pub api_key: String,
    pub endpoint: String,
    pub model: String,
    pub timeout_seconds: u32,
    pub max_retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSettings {
    pub input_device: Option<String>,
    pub sample_rate: u32,
    pub buffer_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncodingSettings {
    pub bitrate: u32,
    pub size_limit_mb: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiSettings {
    pub theme: String,
    pub auto_start_recording: bool,
}

/// Custom error type for persistence operations
#[derive(Debug, thiserror::Error)]
pub enum PersistenceError {
    #[error("File not found: {path}")]
    FileNotFound { path: String },
    #[error("JSON serialization failed: {source}")]
    JsonSerialization { source: serde_json::Error },
    #[error("JSON deserialization failed: {source}")]
    JsonDeserialization { source: serde_json::Error },
    #[error("Disk full - unable to write to {path}")]
    DiskFull { path: String },
    #[error("IO error during write to {path}: {source}")]
    IoError {
        path: String,
        source: std::io::Error,
    },
    #[error("Atomic write failed for {path}: {source}")]
    AtomicWriteFailed {
        path: String,
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    #[error("Profile validation failed: {message}")]
    ProfileValidation { message: String },
}

impl PersistenceError {
    /// Check if this error indicates a disk full condition
    pub fn is_disk_full(&self) -> bool {
        match self {
            PersistenceError::DiskFull { .. } => true,
            PersistenceError::IoError { source, .. } => {
                source.kind() == ErrorKind::Other
                    && source.to_string().to_lowercase().contains("no space left")
            }
            PersistenceError::AtomicWriteFailed { source, .. } => {
                source.to_string().to_lowercase().contains("no space left")
            }
            _ => false,
        }
    }
}

/// Create default configuration files if they don't exist
pub async fn ensure_default_configs() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Try to create config directory first
    let config_dir = match ensure_config_directory() {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("⚠️  Could not create OS config directory: {}", e);
            eprintln!("📁 Using current directory as fallback");
            return Ok(()); // Don't fail completely, let normal loading handle it
        }
    };

    // Create default settings.json if it doesn't exist
    let settings_path = config_dir.join("settings.json");
    if !settings_path.exists() {
        let default_settings = SettingsConfig {
            whisper: WhisperSettings {
                api_key: "YOUR_OPENAI_API_KEY_HERE".to_string(),
                endpoint: "https://api.openai.com/v1/audio/transcriptions".to_string(),
                model: "whisper-1".to_string(),
                timeout_seconds: 30,
                max_retries: 3,
            },
            audio: AudioSettings {
                input_device: None,
                sample_rate: 44100,
                buffer_size: 1024,
            },
            encoding: EncodingSettings {
                bitrate: 32000,
                size_limit_mb: 23,
            },
            ui: UiSettings {
                theme: "auto".to_string(),
                auto_start_recording: false,
            },
            global_shortcut: "Ctrl+Shift+F9".to_string(),
        };

        if let Err(e) = atomic_write_json(&settings_path, &default_settings).await {
            eprintln!("⚠️  Could not create default settings.json: {}", e);
        } else {
            println!(
                "✅ Created default settings.json at {}",
                settings_path.display()
            );
        }
    }

    // Create default profiles.json if it doesn't exist
    let profiles_path = config_dir.join("profiles.json");
    if !profiles_path.exists() {
        let default_profiles = ProfileCollection {
            profiles: vec![
                crate::services::profile_engine::Profile {
                    id: "1".to_string(),
                    name: "Clipboard".to_string(),
                    description: Some("Copy transcription directly to clipboard without formatting".to_string()),
                    prompt: None, // Important: clipboard profile must have no prompt
                    example_input: None,
                    example_output: None,
                    active: false,
                    visible: Some(true),
                    shortcut: None,
                    created_at: "2025-01-01T00:00:00Z".to_string(),
                    updated_at: "2025-01-01T00:00:00Z".to_string(),
                },
                crate::services::profile_engine::Profile {
                    id: "concise".to_string(),
                    name: "Concise Messages".to_string(),
                    description: Some("Make messages more concise and avoid repetitions".to_string()),
                    prompt: Some("Make this text more concise and remove unnecessary repetitions while preserving the core meaning".to_string()),
                    example_input: Some("I think that maybe we should probably consider the possibility of potentially implementing this feature".to_string()),
                    example_output: Some("We should implement this feature".to_string()),
                    active: true,
                    visible: Some(true),
                    shortcut: Some("Ctrl+Alt+C".to_string()),
                    created_at: "2025-01-01T00:00:00Z".to_string(),
                    updated_at: "2025-01-01T00:00:00Z".to_string(),
                },
            ],
            default_profile_id: "concise".to_string(),
        };

        if let Err(e) = atomic_write_json(&profiles_path, &default_profiles).await {
            eprintln!("⚠️  Could not create default profiles.json: {}", e);
        } else {
            println!(
                "✅ Created default profiles.json at {}",
                profiles_path.display()
            );
        }
    }

    Ok(())
}

/// Perform atomic write using tempfile + rename
pub async fn atomic_write_json<T: Serialize>(
    target_path: &Path,
    data: &T,
) -> Result<(), PersistenceError> {
    // Get the parent directory for the temp file
    let parent_dir = target_path.parent().unwrap_or_else(|| Path::new("."));

    // Create a temporary file in the same directory as the target
    let temp_file = NamedTempFile::new_in(parent_dir).map_err(|e| {
        if e.kind() == ErrorKind::Other && e.to_string().to_lowercase().contains("no space left") {
            PersistenceError::DiskFull {
                path: target_path.to_string_lossy().to_string(),
            }
        } else {
            PersistenceError::IoError {
                path: target_path.to_string_lossy().to_string(),
                source: e,
            }
        }
    })?;

    // Serialize data to JSON with pretty formatting
    let json_content = serde_json::to_string_pretty(data)
        .map_err(|e| PersistenceError::JsonSerialization { source: e })?;

    // Write to temporary file
    {
        let mut file = temp_file.as_file();
        file.write_all(json_content.as_bytes()).map_err(|e| {
            if e.kind() == ErrorKind::Other
                && e.to_string().to_lowercase().contains("no space left")
            {
                PersistenceError::DiskFull {
                    path: target_path.to_string_lossy().to_string(),
                }
            } else {
                PersistenceError::IoError {
                    path: target_path.to_string_lossy().to_string(),
                    source: e,
                }
            }
        })?;

        // Ensure data is written to disk
        file.sync_all().map_err(|e| PersistenceError::IoError {
            path: target_path.to_string_lossy().to_string(),
            source: e,
        })?;
    }

    // Atomically rename temp file to target (this is the atomic operation)
    temp_file
        .persist(target_path)
        .map_err(|e| PersistenceError::AtomicWriteFailed {
            path: target_path.to_string_lossy().to_string(),
            source: Box::new(e),
        })?;

    Ok(())
}

/// Create a backup of an existing file
pub async fn create_backup(file_path: &Path) -> Result<Option<PathBuf>, PersistenceError> {
    if !file_path.exists() {
        return Ok(None);
    }

    let backup_path = file_path.with_extension("json.backup");

    tokio::fs::copy(file_path, &backup_path)
        .await
        .map_err(|e| PersistenceError::IoError {
            path: file_path.to_string_lossy().to_string(),
            source: e,
        })?;

    Ok(Some(backup_path))
}

/// Restore from backup if it exists
pub async fn restore_from_backup(
    backup_path: &Path,
    target_path: &Path,
) -> Result<(), PersistenceError> {
    if backup_path.exists() {
        tokio::fs::copy(backup_path, target_path)
            .await
            .map_err(|e| PersistenceError::IoError {
                path: target_path.to_string_lossy().to_string(),
                source: e,
            })?;
    }
    Ok(())
}

/// Load settings from settings.json file
#[tauri::command]
pub async fn load_settings() -> Result<SettingsConfig, String> {
    // Use the new unified config file search logic
    let settings_path = find_config_file_path("settings.json")
        .ok_or_else(|| "Could not determine settings.json path".to_string())?;

    let settings_content = tokio::fs::read_to_string(&settings_path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", settings_path.display(), e))?;

    serde_json::from_str(&settings_content)
        .map_err(|e| format!("Failed to parse settings.json: {}", e))
}

/// Save settings to settings.json
#[tauri::command]
pub async fn save_settings(settings: SettingsConfig) -> Result<String, String> {
    // Normalize the global shortcut before saving
    let mut normalized_settings = settings;
    normalized_settings.global_shortcut = normalize_shortcut(&normalized_settings.global_shortcut);

    let settings_path = find_config_file_path("settings.json")
        .ok_or_else(|| "Could not determine settings.json path".to_string())?;

    atomic_write_json(&settings_path, &normalized_settings)
        .await
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    println!("Settings saved to: {}", settings_path.display());
    Ok(format!("Settings saved to: {}", settings_path.display()))
}

/// Legacy save settings function for backward compatibility
#[tauri::command]
pub async fn v1_save_settings(
    settings: SettingsConfig,
    _app_handle: AppHandle,
) -> Result<String, String> {
    save_settings(settings).await
}

/// Save profiles to profiles.json file (legacy endpoint)
#[tauri::command]
pub async fn save_profiles(
    profiles: ProfileCollection,
    app_handle: AppHandle,
) -> Result<String, String> {
    v1_save_profiles(profiles, app_handle).await
}

/// Save profiles to profiles.json file with atomic writes and proper error handling
#[tauri::command]
pub async fn v1_save_profiles(
    profiles: ProfileCollection,
    app_handle: AppHandle,
) -> Result<String, String> {
    let target_path = find_config_file_path("profiles.json")
        .ok_or_else(|| "Could not determine profiles.json path".to_string())?;

    // Validate profiles before saving
    let engine = ProfileEngine::new();
    engine
        .validate_profiles_collection(&profiles)
        .map_err(|e| format!("Profile validation failed: {}", e))?;

    // Create backup before attempting to save
    let backup_path = create_backup(&target_path)
        .await
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    // Attempt atomic write
    match atomic_write_json(&target_path, &profiles).await {
        Ok(_) => {
            // Clean up backup on success
            if let Some(backup) = backup_path {
                let _ = tokio::fs::remove_file(backup).await;
            }

            // Emit profiles-updated event to notify all windows of the change
            let _ = app_handle.emit("profiles-updated", &profiles);

            Ok(format!(
                "Profiles saved successfully to {}",
                target_path.display()
            ))
        }
        Err(e) => {
            // Rollback on failure
            if let Some(backup) = backup_path {
                if let Err(restore_err) = restore_from_backup(&backup, &target_path).await {
                    eprintln!("Failed to restore backup: {}", restore_err);
                }
                let _ = tokio::fs::remove_file(backup).await;
            }

            // Handle permission errors with helpful guidance
            if let PersistenceError::IoError { source, .. } = &e {
                if source.kind() == ErrorKind::PermissionDenied {
                    eprintln!("⚠️  Permission denied writing to config directory.");
                    eprintln!(
                        "💡 Tip: Grant write permissions with: chmod +w {}",
                        target_path
                            .parent()
                            .unwrap_or_else(|| Path::new("."))
                            .display()
                    );
                    eprintln!("📁 Falling back to current directory");

                    // Try fallback location
                    let fallback_path = PathBuf::from("profiles.json");
                    if (atomic_write_json(&fallback_path, &profiles).await).is_ok() {
                        return Ok(format!(
                            "Profiles saved to fallback location: {}",
                            fallback_path.display()
                        ));
                    }
                }
            }

            // Show error toast for disk full scenarios
            if e.is_disk_full() {
                let notifier = TauriNotifierService::new(app_handle.clone());
                let _ = notifier
                    .error("Disk full - unable to save profiles. Profiles have been rolled back.")
                    .await;

                // Emit event for frontend to handle
                let _ = app_handle.emit_to(
                    "main",
                    "disk_full_error",
                    serde_json::json!({
                        "type": "profiles",
                        "message": "Disk full - profiles rollback performed"
                    }),
                );

                Err(format!("DISK_FULL: {}", e))
            } else {
                // Show generic error toast
                let notifier = TauriNotifierService::new(app_handle.clone());
                let _ = notifier
                    .error(&format!("Failed to save profiles: {}", e))
                    .await;

                Err(format!("Profiles save failed: {}", e))
            }
        }
    }
}

/// Normalize shortcut format for comparison
/// Converts "Ctrl+Shift+F9" to "CmdOrCtrl+Shift+F9" on non-Mac platforms
/// and handles other format variations
fn normalize_shortcut(shortcut: &str) -> String {
    // Handle the common case where user types "Ctrl" but system expects "CmdOrCtrl"
    if shortcut.starts_with("Ctrl+") {
        // On non-Mac platforms, "Ctrl" should be treated as "CmdOrCtrl"
        shortcut.replace("Ctrl+", "CmdOrCtrl+")
    } else {
        shortcut.to_string()
    }
}

/// Validate if a shortcut conflicts with existing shortcuts
#[tauri::command]
pub async fn validate_shortcut_conflict(
    shortcut: String,
    state: State<'_, ShortcutMgrState>,
) -> Result<bool, String> {
    // Empty shortcut is always valid
    if shortcut.trim().is_empty() {
        return Ok(true);
    }

    let state_guard = state.lock().await;

    if let Some(ref mgr) = *state_guard {
        let normalized_shortcut = normalize_shortcut(&shortcut);
        let current_shortcut = mgr.get_shortcut();

        // If the normalized shortcut is the same as the current global shortcut, it's valid
        // (user is not changing it or changing it back to the same value)
        if normalized_shortcut == current_shortcut || shortcut == current_shortcut {
            return Ok(true);
        }

        // Check if the shortcut is already registered for other purposes
        // Try both the original and normalized versions
        let is_registered = mgr.is_shortcut_registered(&shortcut).await
            || mgr.is_shortcut_registered(&normalized_shortcut).await;
        // Return true if NOT conflicting (i.e., not registered)
        Ok(!is_registered)
    } else {
        // If shortcut manager is not initialized, we can't check conflicts
        // Consider it valid for now
        Ok(true)
    }
}
