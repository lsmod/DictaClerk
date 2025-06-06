use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

use crate::commands::ShortcutMgrState;
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

/// Save settings to settings.json file
#[tauri::command]
pub async fn save_settings(settings: SettingsConfig) -> Result<String, String> {
    // Try to find the existing settings.json file first
    let possible_paths = vec!["settings.json", "../settings.json", "../../settings.json"];

    let mut target_path = None;

    // First try the possible relative paths to find existing file
    for path in &possible_paths {
        if Path::new(path).exists() {
            target_path = Some(path.to_string());
            break;
        }
    }

    // If not found, try from current_dir parent
    if target_path.is_none() {
        if let Ok(current_dir) = std::env::current_dir() {
            if let Some(parent) = current_dir.parent() {
                let settings_path = parent.join("settings.json");
                if settings_path.exists() {
                    target_path = Some(settings_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // If still not found, default to current directory
    let final_path = target_path.unwrap_or_else(|| "settings.json".to_string());

    // Serialize settings to JSON with pretty formatting
    let json_content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    // Write to file
    tokio::fs::write(&final_path, json_content)
        .await
        .map_err(|e| format!("Failed to write settings to {}: {}", final_path, e))?;

    Ok(format!("Settings saved successfully to {}", final_path))
}

/// Save profiles to profiles.json file
#[tauri::command]
pub async fn save_profiles(profiles: ProfileCollection) -> Result<String, String> {
    // Try to find the existing profiles.json file first
    let possible_paths = vec!["profiles.json", "../profiles.json", "../../profiles.json"];

    let mut target_path = None;

    // First try the possible relative paths to find existing file
    for path in &possible_paths {
        if Path::new(path).exists() {
            target_path = Some(path.to_string());
            break;
        }
    }

    // If not found, try from current_dir parent
    if target_path.is_none() {
        if let Ok(current_dir) = std::env::current_dir() {
            if let Some(parent) = current_dir.parent() {
                let profiles_path = parent.join("profiles.json");
                if profiles_path.exists() {
                    target_path = Some(profiles_path.to_string_lossy().to_string());
                }
            }
        }
    }

    // If still not found, default to current directory
    let final_path = target_path.unwrap_or_else(|| "profiles.json".to_string());

    // Validate profiles before saving
    let engine = ProfileEngine::new();
    engine
        .validate_profiles_collection(&profiles)
        .map_err(|e| format!("Profile validation failed: {}", e))?;

    // Serialize profiles to JSON with pretty formatting
    let json_content = serde_json::to_string_pretty(&profiles)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;

    // Write to file
    tokio::fs::write(&final_path, json_content)
        .await
        .map_err(|e| format!("Failed to write profiles to {}: {}", final_path, e))?;

    Ok(format!("Profiles saved successfully to {}", final_path))
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
