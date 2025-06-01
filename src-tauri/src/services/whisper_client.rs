//! WhisperClient service for audio transcription via OpenAI Whisper API
//!
//! This service provides async function to transcribe encoded audio via OpenAI Whisper API.
//! It supports OGG files up to 25MB with exponential backoff retry logic for 5xx errors.
//!
//! ## Usage Example
//!
//! ```rust,no_run
//! use std::path::Path;
//! use dicta_clerk_lib::services::{OpenAIWhisperClient, WhisperClient};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let client = OpenAIWhisperClient::new("your-api-key".to_string());
//!
//!     let transcript = client.transcribe(
//!         Path::new("audio.ogg"),
//!         Some("This is a prompt to help the model understand context".to_string())
//!     ).await?;
//!
//!     println!("Transcript: {}", transcript.text);
//!     Ok(())
//! }
//! ```

use async_trait::async_trait;
use reqwest::{multipart, Client, StatusCode};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;
use thiserror::Error;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

/// Configuration for WhisperClient
#[derive(Debug, Clone)]
pub struct WhisperClientConfig {
    /// OpenAI API key
    pub api_key: String,
    /// API endpoint URL
    pub endpoint: String,
    /// Model name to use (default: "whisper-1")
    pub model: String,
    /// Request timeout in seconds (default: 30)
    pub timeout_seconds: u64,
    /// Maximum file size in bytes (default: 25MB)
    pub max_file_size: u64,
    /// Maximum number of retries for 5xx errors (default: 3)
    pub max_retries: u32,
    /// Base delay for exponential backoff in milliseconds (default: 1000)
    pub retry_base_delay_ms: u64,
}

impl Default for WhisperClientConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            endpoint: "https://api.openai.com/v1/audio/transcriptions".to_string(),
            model: "whisper-1".to_string(),
            timeout_seconds: 30,
            max_file_size: 25 * 1024 * 1024, // 25MB as per requirements
            max_retries: 3,
            retry_base_delay_ms: 1000,
        }
    }
}

/// Transcription response from Whisper API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResponse {
    /// The transcribed text
    pub text: String,
    /// Optional language detected (when using verbose_json format)
    pub language: Option<String>,
    /// Optional duration (when using verbose_json format)
    pub duration: Option<f64>,
    /// Optional segments (when using verbose_json format)
    pub segments: Option<Vec<TranscriptionSegment>>,
}

/// Segment information from verbose Whisper response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionSegment {
    /// Segment ID
    pub id: u32,
    /// Start time in seconds
    pub start: f64,
    /// End time in seconds
    pub end: f64,
    /// Segment text
    pub text: String,
    /// Average log probability
    pub avg_logprob: Option<f64>,
    /// Compression ratio
    pub compression_ratio: Option<f64>,
    /// No speech probability
    pub no_speech_prob: Option<f64>,
}

/// Errors that can occur during Whisper API operations
#[derive(Error, Debug)]
pub enum WhisperError {
    #[error("File too large: {size} bytes (max: {max} bytes)")]
    FileTooLarge { size: u64, max: u64 },

    #[error("File I/O error: {0}")]
    FileIo(#[from] std::io::Error),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Server error (HTTP {status}): {message}")]
    Server { status: u16, message: String },

    #[error("API error: {0}")]
    Api(String),

    #[error("Invalid response format: {0}")]
    InvalidResponse(String),

    #[error("Rate limited (HTTP 429): {message}")]
    RateLimit { message: String },

    #[error("Timeout error: Request took longer than {timeout_seconds}s")]
    Timeout { timeout_seconds: u64 },
}

/// Result type for Whisper operations
pub type WhisperResult<T> = Result<T, WhisperError>;

/// Trait defining Whisper API operations
#[async_trait]
pub trait WhisperClient: Send + Sync {
    /// Transcribe an audio file using OpenAI Whisper API
    ///
    /// # Arguments
    /// * `file_path` - Path to the OGG audio file
    /// * `prompt` - Optional prompt to guide the model's style or provide context
    ///
    /// # Returns
    /// * `TranscriptionResponse` containing the transcript and metadata
    ///
    /// # Requirements
    /// * File must be ≤ 25MB (returns FileTooLarge error otherwise)
    /// * Should complete within 15s wall time for ≤10s audio
    /// * Implements exponential backoff for 5xx responses (up to 3 retries)
    async fn transcribe(
        &self,
        file_path: &Path,
        prompt: Option<String>,
    ) -> WhisperResult<TranscriptionResponse>;
}

/// Request data for building forms on retry
#[derive(Debug, Clone)]
struct RequestData {
    file_content: Vec<u8>,
    file_name: String,
    prompt: Option<String>,
}

/// OpenAI Whisper API client implementation
pub struct OpenAIWhisperClient {
    /// Configuration
    config: WhisperClientConfig,
    /// HTTP client with timeout
    client: Client,
}

impl OpenAIWhisperClient {
    /// Create a new WhisperClient with API key
    pub fn new(api_key: String) -> Self {
        let config = WhisperClientConfig {
            api_key,
            ..Default::default()
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");

        Self { config, client }
    }

    /// Create a new WhisperClient with custom configuration
    pub fn with_config(config: WhisperClientConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");

        Self { config, client }
    }

    /// Validate file size against maximum allowed
    async fn validate_file_size(&self, file_path: &Path) -> WhisperResult<u64> {
        let metadata = tokio::fs::metadata(file_path).await?;
        let file_size = metadata.len();

        if file_size > self.config.max_file_size {
            return Err(WhisperError::FileTooLarge {
                size: file_size,
                max: self.config.max_file_size,
            });
        }

        Ok(file_size)
    }

    /// Read file content into memory
    async fn read_file_content(&self, file_path: &Path) -> WhisperResult<Vec<u8>> {
        let mut file = File::open(file_path).await?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).await?;
        Ok(buffer)
    }

    /// Build multipart form for the API request
    fn build_multipart_form(&self, request_data: &RequestData) -> WhisperResult<multipart::Form> {
        let mut form = multipart::Form::new()
            .text("model", self.config.model.clone())
            .text("response_format", "json");

        // Add the audio file
        let file_part = multipart::Part::bytes(request_data.file_content.clone())
            .file_name(request_data.file_name.clone())
            .mime_str("audio/ogg")
            .map_err(|e| WhisperError::Api(format!("Failed to create file part: {}", e)))?;

        form = form.part("file", file_part);

        // Add prompt if provided
        if let Some(ref prompt_text) = request_data.prompt {
            form = form.text("prompt", prompt_text.clone());
        }

        Ok(form)
    }

    /// Execute a single API request
    async fn execute_single_request(
        &self,
        form: multipart::Form,
    ) -> WhisperResult<TranscriptionResponse> {
        let response = self
            .client
            .post(&self.config.endpoint)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    WhisperError::Timeout {
                        timeout_seconds: self.config.timeout_seconds,
                    }
                } else if e.is_connect() || e.is_request() {
                    WhisperError::Network(format!("Request failed: {}", e))
                } else {
                    WhisperError::Network(format!("Unknown network error: {}", e))
                }
            })?;

        let status = response.status();

        match status {
            StatusCode::OK => {
                let response_text = response.text().await.map_err(|e| {
                    WhisperError::Network(format!("Failed to read response: {}", e))
                })?;

                serde_json::from_str::<TranscriptionResponse>(&response_text).map_err(|e| {
                    WhisperError::InvalidResponse(format!(
                        "Failed to parse JSON response: {}. Response: {}",
                        e, response_text
                    ))
                })
            }
            StatusCode::TOO_MANY_REQUESTS => {
                let error_text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Rate limited".to_string());
                Err(WhisperError::RateLimit {
                    message: error_text,
                })
            }
            status if status.is_client_error() => {
                let error_text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Client error".to_string());
                Err(WhisperError::Api(format!(
                    "Client error ({}): {}",
                    status.as_u16(),
                    error_text
                )))
            }
            status if status.is_server_error() => {
                let error_text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Server error".to_string());
                Err(WhisperError::Server {
                    status: status.as_u16(),
                    message: error_text,
                })
            }
            _ => {
                let error_text = response
                    .text()
                    .await
                    .unwrap_or_else(|_| "Unknown error".to_string());
                Err(WhisperError::Api(format!(
                    "Unexpected status ({}): {}",
                    status.as_u16(),
                    error_text
                )))
            }
        }
    }

    /// Execute the API request with retry logic
    async fn execute_request_with_retries(
        &self,
        request_data: RequestData,
    ) -> WhisperResult<TranscriptionResponse> {
        let mut last_error = None;

        for attempt in 0..=self.config.max_retries {
            // Build a fresh form for each attempt
            let form = self.build_multipart_form(&request_data)?;

            match self.execute_single_request(form).await {
                Ok(response) => return Ok(response),
                Err(error) => {
                    last_error = Some(error);

                    // Check if we should retry
                    if let Some(ref err) = last_error {
                        let should_retry = match err {
                            WhisperError::Server { status, .. } if *status >= 500 => true,
                            WhisperError::Network(_) => true,
                            WhisperError::Timeout { .. } => true,
                            _ => false,
                        };

                        if !should_retry || attempt >= self.config.max_retries {
                            break;
                        }

                        // Exponential backoff delay
                        let delay_ms = self.config.retry_base_delay_ms * 2_u64.pow(attempt);
                        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                    }
                }
            }
        }

        Err(last_error
            .unwrap_or_else(|| WhisperError::Api("Unknown error during retry loop".to_string())))
    }
}

#[async_trait]
impl WhisperClient for OpenAIWhisperClient {
    async fn transcribe(
        &self,
        file_path: &Path,
        prompt: Option<String>,
    ) -> WhisperResult<TranscriptionResponse> {
        // Validate file size
        let _file_size = self.validate_file_size(file_path).await?;

        // Read file content
        let file_content = self.read_file_content(file_path).await?;

        // Get file name
        let file_name = file_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("audio.ogg")
            .to_string();

        // Create request data for retries
        let request_data = RequestData {
            file_content,
            file_name,
            prompt,
        };

        // Execute request with retries
        self.execute_request_with_retries(request_data).await
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use tokio::fs;

    /// Mock client for testing without making real API calls
    pub struct MockWhisperClient {
        pub should_fail: bool,
        pub response_delay_ms: u64,
    }

    impl Default for MockWhisperClient {
        fn default() -> Self {
            Self::new()
        }
    }

    impl MockWhisperClient {
        pub fn new() -> Self {
            Self {
                should_fail: false,
                response_delay_ms: 0,
            }
        }

        pub fn with_failure(mut self) -> Self {
            self.should_fail = true;
            self
        }

        pub fn with_delay(mut self, delay_ms: u64) -> Self {
            self.response_delay_ms = delay_ms;
            self
        }
    }

    #[async_trait]
    impl WhisperClient for MockWhisperClient {
        async fn transcribe(
            &self,
            file_path: &Path,
            _prompt: Option<String>,
        ) -> WhisperResult<TranscriptionResponse> {
            // Simulate delay
            if self.response_delay_ms > 0 {
                tokio::time::sleep(Duration::from_millis(self.response_delay_ms)).await;
            }

            // Check file exists
            if !file_path.exists() {
                return Err(WhisperError::FileIo(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "File not found",
                )));
            }

            // Check file size
            let metadata = fs::metadata(file_path).await?;
            if metadata.len() > 25 * 1024 * 1024 {
                return Err(WhisperError::FileTooLarge {
                    size: metadata.len(),
                    max: 25 * 1024 * 1024,
                });
            }

            if self.should_fail {
                return Err(WhisperError::Server {
                    status: 500,
                    message: "Mock server error".to_string(),
                });
            }

            // Return mock response
            Ok(TranscriptionResponse {
                text: format!("Mock transcription for file: {:?}", file_path.file_name()),
                language: Some("en".to_string()),
                duration: Some(5.0),
                segments: Some(vec![TranscriptionSegment {
                    id: 0,
                    start: 0.0,
                    end: 5.0,
                    text: "Mock transcription".to_string(),
                    avg_logprob: Some(-0.1),
                    compression_ratio: Some(1.5),
                    no_speech_prob: Some(0.01),
                }]),
            })
        }
    }

    #[tokio::test]
    async fn test_whisper_client_creation() {
        let client = OpenAIWhisperClient::new("test-key".to_string());
        assert_eq!(client.config.api_key, "test-key");
        assert_eq!(client.config.model, "whisper-1");
        assert_eq!(client.config.max_file_size, 25 * 1024 * 1024);
    }

    #[tokio::test]
    async fn test_whisper_client_with_custom_config() {
        let config = WhisperClientConfig {
            api_key: "custom-key".to_string(),
            model: "whisper-large".to_string(),
            max_file_size: 10 * 1024 * 1024, // 10MB
            timeout_seconds: 60,
            ..Default::default()
        };

        let client = OpenAIWhisperClient::with_config(config);
        assert_eq!(client.config.api_key, "custom-key");
        assert_eq!(client.config.model, "whisper-large");
        assert_eq!(client.config.max_file_size, 10 * 1024 * 1024);
        assert_eq!(client.config.timeout_seconds, 60);
    }

    #[tokio::test]
    async fn test_file_size_validation() {
        let client = OpenAIWhisperClient::new("test-key".to_string());

        // Test with non-existent file
        let result = client
            .validate_file_size(Path::new("non-existent-file.ogg"))
            .await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), WhisperError::FileIo(_)));
    }

    #[tokio::test]
    async fn test_mock_client_success() {
        let client = MockWhisperClient::new();

        // Create a temporary file for testing
        let temp_dir = tempfile::tempdir().unwrap();
        let temp_file = temp_dir.path().join("test.ogg");
        fs::write(&temp_file, b"dummy audio data").await.unwrap();

        let result = client
            .transcribe(&temp_file, Some("Test prompt".to_string()))
            .await;

        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(response.text.contains("Mock transcription"));
        assert_eq!(response.language, Some("en".to_string()));
    }

    #[tokio::test]
    async fn test_mock_client_file_too_large() {
        let client = MockWhisperClient::new();

        // Create a temporary file that's too large
        let temp_dir = tempfile::tempdir().unwrap();
        let temp_file = temp_dir.path().join("large.ogg");

        // Create a file larger than 25MB
        let large_data = vec![0u8; 26 * 1024 * 1024]; // 26MB
        fs::write(&temp_file, large_data).await.unwrap();

        let result = client.transcribe(&temp_file, None).await;

        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            WhisperError::FileTooLarge { .. }
        ));
    }

    #[tokio::test]
    async fn test_mock_client_server_error() {
        let client = MockWhisperClient::new().with_failure();

        // Create a temporary file for testing
        let temp_dir = tempfile::tempdir().unwrap();
        let temp_file = temp_dir.path().join("test.ogg");
        fs::write(&temp_file, b"dummy audio data").await.unwrap();

        let result = client.transcribe(&temp_file, None).await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), WhisperError::Server { .. }));
    }

    #[tokio::test]
    async fn test_request_data_cloning() {
        let request_data = RequestData {
            file_content: vec![1, 2, 3, 4],
            file_name: "test.ogg".to_string(),
            prompt: Some("test prompt".to_string()),
        };

        let cloned = request_data.clone();
        assert_eq!(request_data.file_content, cloned.file_content);
        assert_eq!(request_data.file_name, cloned.file_name);
        assert_eq!(request_data.prompt, cloned.prompt);
    }

    #[tokio::test]
    async fn test_multipart_form_building() {
        let client = OpenAIWhisperClient::new("test-key".to_string());
        let request_data = RequestData {
            file_content: vec![1, 2, 3, 4],
            file_name: "test.ogg".to_string(),
            prompt: Some("test prompt".to_string()),
        };

        let form_result = client.build_multipart_form(&request_data);
        assert!(form_result.is_ok());
    }
}
