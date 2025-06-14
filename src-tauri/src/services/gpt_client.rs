use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors that can occur during GPT API operations
#[derive(Error, Debug)]
pub enum GptError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),

    #[error("API error: {message}")]
    ApiError { message: String },

    #[error("Invalid response format: {message}")]
    InvalidResponse { message: String },

    #[error("Request timeout")]
    Timeout,

    #[error("API key not configured")]
    ApiKeyNotConfigured,
}

pub type GptResult<T> = Result<T, GptError>;

/// Request structure for OpenAI GPT API
#[derive(Debug, Serialize)]
struct GptRequest {
    model: String,
    messages: Vec<GptMessage>,
    temperature: f32,
}

/// Message structure for GPT requests
#[derive(Debug, Serialize)]
struct GptMessage {
    role: String,
    content: String,
}

/// Response structure from OpenAI GPT API
#[derive(Debug, Deserialize)]
struct GptResponse {
    choices: Vec<GptChoice>,
}

/// Choice structure in GPT response
#[derive(Debug, Deserialize)]
struct GptChoice {
    message: GptResponseMessage,
}

/// Message structure in GPT response
#[derive(Debug, Deserialize)]
struct GptResponseMessage {
    content: String,
}

/// Error response structure from OpenAI API
#[derive(Debug, Deserialize)]
struct GptErrorResponse {
    error: GptErrorDetail,
}

/// Error detail structure from OpenAI API
#[derive(Debug, Deserialize)]
struct GptErrorDetail {
    message: String,
    #[serde(rename = "type")]
    error_type: Option<String>,
    #[allow(dead_code)]
    code: Option<String>,
}

/// GPT client for formatting text through OpenAI's API
pub struct GptClient {
    client: Client,
    api_key: String,
}

impl GptClient {
    /// Create a new GPT client with the provided API key
    pub fn new(api_key: String) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self { client, api_key }
    }

    /// Format text using GPT-4o with profile instructions
    ///
    /// # Arguments
    /// * `text` - The text to format
    /// * `profile_prompt` - The profile instructions
    /// * `input_example` - Example input text (optional)
    /// * `output_example` - Example output text (optional)
    ///
    /// # Returns
    /// * Formatted text string
    pub async fn format_text(
        &self,
        text: &str,
        profile_prompt: &str,
        input_example: &str,
        output_example: &str,
    ) -> GptResult<String> {
        if self.api_key.is_empty() {
            return Err(GptError::ApiKeyNotConfigured);
        }

        // Build the system prompt with profile instructions
        let system_prompt = self.build_prompt(profile_prompt, input_example, output_example);

        // Construct the request
        let request = GptRequest {
            model: "gpt-4o".to_string(), // Fast and cost-effective
            messages: vec![
                GptMessage {
                    role: "system".to_string(),
                    content: system_prompt,
                },
                GptMessage {
                    role: "user".to_string(),
                    content: text.to_string(),
                },
            ],
            temperature: 0.1, // Low temperature for consistent formatting
        };

        // Send the request
        self.send_request(request).await
    }

    /// Build the system prompt combining instructions and examples
    fn build_prompt(
        &self,
        instructions: &str,
        input_example: &str,
        output_example: &str,
    ) -> String {
        let mut prompt = instructions.to_string();

        // Add examples if both are provided
        if !input_example.is_empty() && !output_example.is_empty() {
            prompt.push_str(&format!(
                "\n\nExample:\nInput: {}\nOutput: {}",
                input_example, output_example
            ));
        }

        prompt
    }

    /// Send the GPT request and handle the response
    async fn send_request(&self, request: GptRequest) -> GptResult<String> {
        log::debug!("Sending GPT-4 request with model: {}", request.model);

        let response = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        let response_text = response.text().await?;

        if !status.is_success() {
            // Try to parse error response
            if let Ok(error_response) = serde_json::from_str::<GptErrorResponse>(&response_text) {
                return Err(GptError::ApiError {
                    message: format!(
                        "{} ({})",
                        error_response.error.message,
                        error_response.error.error_type.unwrap_or_default()
                    ),
                });
            } else {
                return Err(GptError::ApiError {
                    message: format!("HTTP {}: {}", status, response_text),
                });
            }
        }

        // Parse successful response
        let gpt_response: GptResponse =
            serde_json::from_str(&response_text).map_err(|e| GptError::InvalidResponse {
                message: format!("Failed to parse response: {}", e),
            })?;

        if gpt_response.choices.is_empty() {
            return Err(GptError::InvalidResponse {
                message: "No choices in response".to_string(),
            });
        }

        let formatted_text = gpt_response.choices[0].message.content.clone();
        log::debug!(
            "GPT-4 formatting successful, output length: {}",
            formatted_text.len()
        );

        Ok(formatted_text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gpt_client_creation() {
        let client = GptClient::new("test-key".to_string());
        assert_eq!(client.api_key, "test-key");
    }

    #[test]
    fn test_build_prompt_with_examples() {
        let client = GptClient::new("test-key".to_string());
        let prompt = client.build_prompt(
            "Format as medical report",
            "patient has fever",
            "Patient presents with fever.",
        );

        assert!(prompt.contains("Format as medical report"));
        assert!(prompt.contains("Input: patient has fever"));
        assert!(prompt.contains("Output: Patient presents with fever."));
    }

    #[test]
    fn test_build_prompt_without_examples() {
        let client = GptClient::new("test-key".to_string());
        let prompt = client.build_prompt("Format as medical report", "", "");

        assert_eq!(prompt, "Format as medical report");
    }

    #[test]
    fn test_build_prompt_incomplete_examples() {
        let client = GptClient::new("test-key".to_string());

        // Only input example
        let prompt1 = client.build_prompt("Format text", "input", "");
        assert_eq!(prompt1, "Format text");

        // Only output example
        let prompt2 = client.build_prompt("Format text", "", "output");
        assert_eq!(prompt2, "Format text");
    }

    #[tokio::test]
    async fn test_format_text_no_api_key() {
        let client = GptClient::new("".to_string());
        let result = client.format_text("test", "prompt", "", "").await;

        assert!(matches!(result, Err(GptError::ApiKeyNotConfigured)));
    }
}
