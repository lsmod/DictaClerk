use std::sync::Mutex;
use tauri::{Emitter, State};

use crate::services::profile_engine::{
    ensure_clipboard_profile, ProfileBehavior, ProfileCollection, ProfileEngine,
};
use crate::utils::find_config_file_path;

/// State to hold the active profile ID
#[derive(Default)]
pub struct ProfileState {
    pub active_profile_id: Option<String>,
}

pub type ProfileAppState = Mutex<ProfileState>;

/// Load profiles from the profiles.json file
#[tauri::command]
pub async fn load_profiles() -> Result<ProfileCollection, String> {
    let engine = ProfileEngine::new();

    // Use the new unified config file search logic
    let profiles_path = find_config_file_path("profiles.json")
        .ok_or_else(|| "Could not determine profiles.json path".to_string())?;

    let profiles_content = tokio::fs::read_to_string(&profiles_path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", profiles_path.display(), e))?;

    let mut profile_collection = engine
        .load_profiles_from_json(&profiles_content)
        .map_err(|e| format!("Failed to parse profiles: {}", e))?;

    // Ensure clipboard profile always exists as Profile 1
    ensure_clipboard_profile(&mut profile_collection.profiles);

    Ok(profile_collection)
}

/// Select a profile and set it as active
#[tauri::command]
pub async fn select_profile(
    profile_id: String,
    state: State<'_, ProfileAppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Update the active profile in state
    {
        let mut profile_state = state.lock().unwrap();
        profile_state.active_profile_id = Some(profile_id.clone());
    }

    // Emit an event to notify the frontend
    app_handle
        .emit_to(
            "main",
            "selectProfile",
            serde_json::json!({
                "profile_id": profile_id
            }),
        )
        .map_err(|e| format!("Failed to emit selectProfile event: {}", e))?;

    Ok(format!("Profile '{}' selected", profile_id))
}

/// Get the currently active profile ID
#[tauri::command]
pub async fn get_active_profile(
    state: State<'_, ProfileAppState>,
) -> Result<Option<String>, String> {
    let profile_state = state.lock().unwrap();
    Ok(profile_state.active_profile_id.clone())
}

/// Apply a profile to text using the ProfileEngine
#[tauri::command]
pub async fn apply_profile_to_text(profile_id: String, text: String) -> Result<String, String> {
    let engine = ProfileEngine::new();

    // Use the new unified config file search logic
    let profiles_path = find_config_file_path("profiles.json")
        .ok_or_else(|| "Could not determine profiles.json path".to_string())?;

    let profiles_content = tokio::fs::read_to_string(&profiles_path)
        .await
        .map_err(|e| format!("Failed to read {}: {}", profiles_path.display(), e))?;

    let mut profile_collection = engine
        .load_profiles_from_json(&profiles_content)
        .map_err(|e| format!("Failed to parse profiles: {}", e))?;

    // Ensure clipboard profile always exists as Profile 1
    ensure_clipboard_profile(&mut profile_collection.profiles);

    let profile = engine
        .find_profile_by_id(&profile_collection, &profile_id)
        .map_err(|e| format!("Profile not found: {}", e))?;

    // Handle clipboard profile - return text directly without GPT formatting
    if profile.is_clipboard_profile() {
        return Ok(text);
    }

    engine
        .apply_profile(profile, &text)
        .map_err(|e| format!("Failed to apply profile: {}", e))
}
