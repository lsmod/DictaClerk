use serde::{Deserialize, Serialize};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, State};
use tempfile::NamedTempFile;

use crate::commands::ShortcutMgrState;
use crate::services::notifier::{Notifier, TauriNotifierService};
use crate::services::profile_engine::{ProfileCollection, ProfileEngine};

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

/// Find the target path for a config file
pub fn find_config_file_path(filename: &str) -> Option<PathBuf> {
    // First try to find existing files in preferred order
    let possible_paths = vec![
        PathBuf::from("..").join(filename),    // Project root (preferred)
        PathBuf::from("../..").join(filename), // Parent of project root
        PathBuf::from(filename),               // Current directory (last resort)
    ];

    // Look for existing files first
    for path in &possible_paths {
        if path.exists() {
            return Some(path.clone());
        }
    }

    // If not found, try from current_dir parent (project root)
    if let Ok(current_dir) = std::env::current_dir() {
        if let Some(parent) = current_dir.parent() {
            let config_path = parent.join(filename);
            // Always prefer the parent directory (project root) for new files
            return Some(config_path);
        }
    }

    // Fallback to project root relative path (avoid current directory if possible)
    Some(PathBuf::from("..").join(filename))
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
    // Try multiple possible paths for settings.json
    let possible_paths = vec!["settings.json", "../settings.json", "../../settings.json"];

    let mut settings_json = None;
    let mut last_error = String::new();

    // First try the possible relative paths
    for path in possible_paths {
        match tokio::fs::read_to_string(path).await {
            Ok(content) => {
                settings_json = Some(content);
                break;
            }
            Err(e) => {
                last_error = format!("Failed to read {}: {}", path, e);
                continue;
            }
        }
    }

    // If not found, try from current_dir parent
    if settings_json.is_none() {
        if let Ok(current_dir) = std::env::current_dir() {
            if let Some(parent) = current_dir.parent() {
                let settings_path = parent.join("settings.json");
                match tokio::fs::read_to_string(&settings_path).await {
                    Ok(content) => settings_json = Some(content),
                    Err(e) => last_error = format!("Failed to read {:?}: {}", settings_path, e),
                }
            }
        }
    }

    let settings_content = settings_json
        .ok_or_else(|| format!("Could not find settings.json. Last error: {}", last_error))?;

    serde_json::from_str(&settings_content)
        .map_err(|e| format!("Failed to parse settings.json: {}", e))
}

/// Save settings to settings.json file (legacy endpoint)
#[tauri::command]
pub async fn save_settings(
    settings: SettingsConfig,
    app_handle: AppHandle,
) -> Result<String, String> {
    v1_save_settings(settings, app_handle).await
}

/// Save settings to settings.json file with atomic writes and proper error handling
#[tauri::command]
pub async fn v1_save_settings(
    settings: SettingsConfig,
    app_handle: AppHandle,
) -> Result<String, String> {
    let target_path = find_config_file_path("settings.json")
        .ok_or_else(|| "Could not determine settings.json path".to_string())?;

    // Create backup before attempting to save
    let backup_path = create_backup(&target_path)
        .await
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    // Attempt atomic write
    match atomic_write_json(&target_path, &settings).await {
        Ok(_) => {
            // Clean up backup on success
            if let Some(backup) = backup_path {
                let _ = tokio::fs::remove_file(backup).await;
            }
            Ok(format!(
                "Settings saved successfully to {}",
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

            // Show error toast for disk full scenarios
            if e.is_disk_full() {
                let notifier = TauriNotifierService::new(app_handle.clone());
                let _ = notifier
                    .error("Disk full - unable to save settings. Settings have been rolled back.")
                    .await;

                // Emit event for frontend to handle
                let _ = app_handle.emit_to(
                    "main",
                    "disk_full_error",
                    serde_json::json!({
                        "type": "settings",
                        "message": "Disk full - settings rollback performed"
                    }),
                );

                Err(format!("DISK_FULL: {}", e))
            } else {
                // Show generic error toast
                let notifier = TauriNotifierService::new(app_handle.clone());
                let _ = notifier
                    .error(&format!("Failed to save settings: {}", e))
                    .await;

                Err(format!("Settings save failed: {}", e))
            }
        }
    }
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
        // Check if the shortcut is already registered
        let is_registered = mgr.is_shortcut_registered(&shortcut).await;
        // Return true if NOT conflicting (i.e., not registered)
        Ok(!is_registered)
    } else {
        // If shortcut manager is not initialized, we can't check conflicts
        // Consider it valid for now
        Ok(true)
    }
}
