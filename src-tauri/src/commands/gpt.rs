use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

use crate::services::GptClient;

/// Global state for the GPT client service
pub type GptClientState = Arc<Mutex<Option<GptClient>>>;

/// Initialize the GPT client with an API key
#[tauri::command]
pub async fn init_gpt_client(
    api_key: String,
    state: State<'_, GptClientState>,
) -> Result<String, String> {
    if api_key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let client = GptClient::new(api_key);
    let mut state_guard = state.lock().await;
    *state_guard = Some(client);

    log::debug!("GPT client initialized successfully");
    Ok("GPT client initialized successfully".to_string())
}

/// Check if the GPT client is initialized
#[tauri::command]
pub async fn is_gpt_initialized(state: State<'_, GptClientState>) -> Result<bool, String> {
    let state_guard = state.lock().await;
    Ok(state_guard.is_some())
}

/// Format text using GPT-4 with profile instructions
#[tauri::command]
pub async fn format_text_with_gpt(
    text: String,
    profile_prompt: String,
    profile_input_example: String,
    profile_output_example: String,
    gpt_state: State<'_, GptClientState>,
) -> Result<String, String> {
    log::debug!(
        "GPT-4 formatting request for text: {}",
        &text.chars().take(100).collect::<String>()
    );

    let client_guard = gpt_state.lock().await;
    let client = client_guard.as_ref().ok_or("GPT client not initialized")?;

    match client
        .format_text(
            &text,
            &profile_prompt,
            &profile_input_example,
            &profile_output_example,
        )
        .await
    {
        Ok(formatted_text) => {
            log::debug!(
                "GPT-4 formatting successful: {}",
                &formatted_text.chars().take(100).collect::<String>()
            );
            Ok(formatted_text)
        }
        Err(e) => {
            log::error!("GPT-4 formatting failed: {}", e);
            Err(format!("GPT-4 formatting failed: {}", e))
        }
    }
}

/// Get GPT client information
#[tauri::command]
pub async fn get_gpt_info(state: State<'_, GptClientState>) -> Result<serde_json::Value, String> {
    let state_guard = state.lock().await;

    if state_guard.is_some() {
        Ok(serde_json::json!({
            "initialized": true,
            "model": "gpt-4o",
            "temperature": 0.1,
            "timeout_seconds": 10,
            "status": "ready"
        }))
    } else {
        Ok(serde_json::json!({
            "initialized": false,
            "model": null,
            "status": "not_initialized"
        }))
    }
}
