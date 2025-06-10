//! Configuration file validator for DictaClerk
//!
//! This module validates settings.json and profiles.json against predefined JSON schemas
//! to ensure the application starts with valid configurations.

use crate::utils::find_config_file_path;
use jsonschema::{Draft, JSONSchema};
use serde_json::Value;
use std::fs;
use std::path::Path;
use thiserror::Error;

/// Errors that can occur during configuration validation
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Configuration file not found: {path}")]
    FileNotFound { path: String },

    #[error("Failed to read configuration file {path}: {source}")]
    FileReadError {
        path: String,
        source: std::io::Error,
    },

    #[error("Invalid JSON in configuration file {path}: {source}")]
    InvalidJson {
        path: String,
        source: serde_json::Error,
    },

    #[error("Schema validation failed for {path}: {message}")]
    ValidationError { path: String, message: String },

    #[error("Failed to compile JSON schema: {message}")]
    SchemaCompilationError { message: String },

    #[error("Profile validation failed: example_input is provided but example_output is missing")]
    IncompleteProfileExample,

    #[error("Maximum five visible profiles")]
    MaxVisibleProfilesExceeded,

    #[error("Shortcut conflict")]
    ShortcutConflict,
}

/// Settings JSON Schema - defines application-wide settings
const SETTINGS_SCHEMA: &str = r#"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DictaClerk Settings",
  "type": "object",
  "properties": {
    "whisper": {
      "type": "object",
      "properties": {
        "api_key": {
          "type": "string",
          "minLength": 1,
          "description": "OpenAI API key for Whisper service"
        },
        "endpoint": {
          "type": "string",
          "format": "uri",
          "default": "https://api.openai.com/v1/audio/transcriptions",
          "description": "Whisper API endpoint URL"
        },
        "model": {
          "type": "string",
          "default": "whisper-1",
          "description": "Whisper model to use"
        },
        "timeout_seconds": {
          "type": "integer",
          "minimum": 1,
          "maximum": 300,
          "default": 30,
          "description": "Request timeout in seconds"
        },
        "max_retries": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10,
          "default": 3,
          "description": "Maximum number of retries for 5xx errors"
        }
      },
      "required": ["api_key"],
      "additionalProperties": false
    },
    "audio": {
      "type": "object",
      "properties": {
        "input_device": {
          "type": ["string", "null"],
          "description": "Audio input device name or null for default"
        },
        "sample_rate": {
          "type": "integer",
          "minimum": 8000,
          "maximum": 48000,
          "default": 44100,
          "description": "Audio sample rate in Hz"
        },
        "buffer_size": {
          "type": "integer",
          "minimum": 128,
          "maximum": 8192,
          "default": 1024,
          "description": "Audio buffer size in samples"
        }
      },
      "additionalProperties": false
    },
    "encoding": {
      "type": "object",
      "properties": {
        "bitrate": {
          "type": "integer",
          "minimum": 8000,
          "maximum": 512000,
          "default": 32000,
          "description": "Opus encoding bitrate in bits per second"
        },
        "size_limit_mb": {
          "type": "number",
          "minimum": 1,
          "maximum": 25,
          "default": 23,
          "description": "Maximum file size in MB"
        }
      },
      "additionalProperties": false
    },
    "ui": {
      "type": "object",
      "properties": {
        "theme": {
          "type": "string",
          "enum": ["light", "dark", "auto"],
          "default": "auto",
          "description": "UI theme preference"
        },
        "auto_start_recording": {
          "type": "boolean",
          "default": false,
          "description": "Start recording automatically on app launch"
        }
      },
      "additionalProperties": false
    },
    "global_shortcut": {
      "type": "string",
      "minLength": 1,
      "default": "CmdOrCtrl+Shift+F9",
      "description": "Global keyboard shortcut for toggling recording"
    }
  },
  "required": ["whisper"],
  "additionalProperties": false
}"#;

/// Profiles JSON Schema - defines transcription profiles with examples
const PROFILES_SCHEMA: &str = r#"{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DictaClerk Profiles",
  "type": "object",
  "properties": {
    "profiles": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "description": "Unique profile identifier"
          },
          "name": {
            "type": "string",
            "minLength": 1,
            "description": "Human-readable profile name"
          },
          "description": {
            "type": ["string", "null"],
            "description": "Profile description"
          },
          "prompt": {
            "type": ["string", "null"],
            "description": "Whisper prompt to guide transcription style"
          },
          "example_input": {
            "type": ["string", "null"],
            "description": "Example input text for this profile"
          },
          "example_output": {
            "type": ["string", "null"],
            "description": "Expected output for the example input"
          },
          "active": {
            "type": "boolean",
            "default": true,
            "description": "Whether this profile is active"
          },
          "visible": {
            "type": ["boolean", "null"],
            "default": false,
            "description": "Whether this profile is visible in the UI (max 5)"
          },
          "shortcut": {
            "type": ["string", "null"],
            "description": "Optional keyboard shortcut for quick profile selection"
          },
          "created_at": {
            "type": "string",
            "format": "date-time",
            "description": "Profile creation timestamp"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "description": "Profile last update timestamp"
          }
        },
        "required": ["id", "name"],
        "additionalProperties": false
      },
      "minItems": 0
    },
    "default_profile_id": {
      "type": ["string", "null"],
      "description": "ID of the default profile to use"
    }
  },
  "required": ["profiles"],
  "additionalProperties": false
}"#;

/// Validates both configuration files against their schemas
pub fn validate_config_files() -> Result<(), ConfigError> {
    // Use the new unified search logic for settings.json
    if let Some(settings_path) = find_config_file_path("settings.json") {
        if settings_path.exists() {
            validate_settings_file(&settings_path)?;
        } else {
            eprintln!("Warning: settings.json not found at expected location: {}. Skipping settings validation.", settings_path.display());
        }
    } else {
        eprintln!("Warning: Could not determine settings.json path. Skipping settings validation.");
    }

    // Use the new unified search logic for profiles.json
    if let Some(profiles_path) = find_config_file_path("profiles.json") {
        if profiles_path.exists() {
            validate_profiles_file(&profiles_path)?;
        } else {
            eprintln!("Warning: profiles.json not found at expected location: {}. Skipping profiles validation.", profiles_path.display());
        }
    } else {
        eprintln!("Warning: Could not determine profiles.json path. Skipping profiles validation.");
    }

    Ok(())
}

/// Validates both configuration files against their schemas (strict mode for tests)
/// This version requires both files to exist and will return errors if they're missing
pub fn validate_config_files_strict() -> Result<(), ConfigError> {
    validate_settings_file("settings.json")?;
    validate_profiles_file("profiles.json")?;
    Ok(())
}

/// Validates the settings.json file against the settings schema
fn validate_settings_file<P: AsRef<Path>>(path: P) -> Result<(), ConfigError> {
    let path_str = path.as_ref().to_string_lossy().to_string();

    // Read the file
    let content = fs::read_to_string(&path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => ConfigError::FileNotFound {
            path: path_str.clone(),
        },
        _ => ConfigError::FileReadError {
            path: path_str.clone(),
            source: e,
        },
    })?;

    // Parse JSON
    let json: Value = serde_json::from_str(&content).map_err(|e| ConfigError::InvalidJson {
        path: path_str.clone(),
        source: e,
    })?;

    // Compile schema
    let schema_value: Value = serde_json::from_str(SETTINGS_SCHEMA)
        .expect("Built-in settings schema should be valid JSON");
    let schema = JSONSchema::options()
        .with_draft(Draft::Draft7)
        .compile(&schema_value)
        .map_err(|e| ConfigError::SchemaCompilationError {
            message: e.to_string(),
        })?;

    // Validate against schema
    if let Err(errors) = schema.validate(&json) {
        let error_messages: Vec<String> = errors
            .map(|error| format!("{}: {}", error.instance_path, error))
            .collect();
        return Err(ConfigError::ValidationError {
            path: path_str,
            message: error_messages.join("; "),
        });
    }

    Ok(())
}

/// Validates the profiles.json file against the profiles schema
fn validate_profiles_file<P: AsRef<Path>>(path: P) -> Result<(), ConfigError> {
    let path_str = path.as_ref().to_string_lossy().to_string();

    // Read the file
    let content = fs::read_to_string(&path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => ConfigError::FileNotFound {
            path: path_str.clone(),
        },
        _ => ConfigError::FileReadError {
            path: path_str.clone(),
            source: e,
        },
    })?;

    // Parse JSON
    let json: Value = serde_json::from_str(&content).map_err(|e| ConfigError::InvalidJson {
        path: path_str.clone(),
        source: e,
    })?;

    // Compile schema
    let schema_value: Value = serde_json::from_str(PROFILES_SCHEMA)
        .expect("Built-in profiles schema should be valid JSON");
    let schema = JSONSchema::options()
        .with_draft(Draft::Draft7)
        .compile(&schema_value)
        .map_err(|e| ConfigError::SchemaCompilationError {
            message: e.to_string(),
        })?;

    // Validate against schema
    if let Err(errors) = schema.validate(&json) {
        let error_messages: Vec<String> = errors
            .map(|error| format!("{}: {}", error.instance_path, error))
            .collect();
        return Err(ConfigError::ValidationError {
            path: path_str.clone(),
            message: error_messages.join("; "),
        });
    }

    // Additional validation: check example_input/example_output consistency
    validate_profile_examples(&json)?;

    // Additional validation: enforce visible profiles limit
    validate_visible_profiles_limit(&json)?;

    // Additional validation: check for shortcut conflicts
    validate_shortcut_conflicts(&json)?;

    // Additional validation: check clipboard profile constraints
    validate_clipboard_profile_constraints(&json)?;

    Ok(())
}

/// Validates that profiles with example_input also have example_output
fn validate_profile_examples(json: &Value) -> Result<(), ConfigError> {
    if let Some(profiles) = json.get("profiles").and_then(|p| p.as_array()) {
        for profile in profiles {
            let example_input = profile.get("example_input");
            let example_output = profile.get("example_output");

            // Check if example_input is provided (not null and not empty string)
            let has_example_input = example_input
                .and_then(|v| v.as_str())
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false);

            // Check if example_output is provided (not null and not empty string)
            let has_example_output = example_output
                .and_then(|v| v.as_str())
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false);

            // If example_input is provided but example_output is missing, that's an error
            if has_example_input && !has_example_output {
                return Err(ConfigError::IncompleteProfileExample);
            }
        }
    }

    Ok(())
}

/// Validates the visible profiles limit
fn validate_visible_profiles_limit(json: &Value) -> Result<(), ConfigError> {
    if let Some(profiles) = json.get("profiles").and_then(|p| p.as_array()) {
        let visible_count = profiles
            .iter()
            .filter(|profile| {
                profile
                    .get("visible")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
            })
            .count();

        if visible_count > 5 {
            return Err(ConfigError::MaxVisibleProfilesExceeded);
        }
    }

    Ok(())
}

/// Validates the shortcut conflicts
fn validate_shortcut_conflicts(json: &Value) -> Result<(), ConfigError> {
    if let Some(profiles) = json.get("profiles").and_then(|p| p.as_array()) {
        let mut shortcuts_seen = std::collections::HashSet::new();

        for profile in profiles {
            if let Some(shortcut_value) = profile.get("shortcut") {
                if let Some(shortcut) = shortcut_value.as_str() {
                    if !shortcut.trim().is_empty() {
                        if shortcuts_seen.contains(shortcut) {
                            return Err(ConfigError::ShortcutConflict);
                        }
                        shortcuts_seen.insert(shortcut);
                    }
                }
            }
        }
    }

    Ok(())
}

/// Validates clipboard profile specific constraints
fn validate_clipboard_profile_constraints(json: &Value) -> Result<(), ConfigError> {
    if let Some(profiles) = json.get("profiles").and_then(|p| p.as_array()) {
        for profile in profiles {
            if let Some(id) = profile.get("id").and_then(|v| v.as_str()) {
                if id == "1" {
                    // This is the clipboard profile - validate its constraints

                    // Name must be "Clipboard"
                    if let Some(name) = profile.get("name").and_then(|v| v.as_str()) {
                        if name != "Clipboard" {
                            return Err(ConfigError::ValidationError {
                                path: "profiles".to_string(),
                                message: "Clipboard profile (ID='1') must be named 'Clipboard'"
                                    .to_string(),
                            });
                        }
                    }

                    // Prompt must be null or absent
                    if let Some(prompt) = profile.get("prompt") {
                        if !prompt.is_null() {
                            return Err(ConfigError::ValidationError {
                                path: "profiles".to_string(),
                                message: "Clipboard profile (ID='1') cannot have a prompt"
                                    .to_string(),
                            });
                        }
                    }

                    // Example fields must be null or absent
                    if let Some(example_input) = profile.get("example_input") {
                        if !example_input.is_null() {
                            return Err(ConfigError::ValidationError {
                                path: "profiles".to_string(),
                                message: "Clipboard profile (ID='1') cannot have example_input"
                                    .to_string(),
                            });
                        }
                    }

                    if let Some(example_output) = profile.get("example_output") {
                        if !example_output.is_null() {
                            return Err(ConfigError::ValidationError {
                                path: "profiles".to_string(),
                                message: "Clipboard profile (ID='1') cannot have example_output"
                                    .to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_valid_settings() {
        let valid_settings = r#"{
            "whisper": {
                "api_key": "sk-test123"
            }
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("settings.json");
        fs::write(&settings_path, valid_settings).unwrap();

        assert!(validate_settings_file(&settings_path).is_ok());
    }

    #[test]
    fn test_invalid_settings_missing_api_key() {
        let invalid_settings = r#"{
            "whisper": {}
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("settings.json");
        fs::write(&settings_path, invalid_settings).unwrap();

        let result = validate_settings_file(&settings_path);
        assert!(result.is_err());
        match result.unwrap_err() {
            ConfigError::ValidationError { message, .. } => {
                assert!(message.contains("api_key"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[test]
    fn test_valid_profiles() {
        let valid_profiles = r#"{
            "profiles": [
                {
                    "id": "general",
                    "name": "General Transcription"
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, valid_profiles).unwrap();

        assert!(validate_profiles_file(&profiles_path).is_ok());
    }

    #[test]
    fn test_profiles_with_complete_example() {
        let valid_profiles = r#"{
            "profiles": [
                {
                    "id": "medical",
                    "name": "Medical Transcription",
                    "example_input": "Patient presents with chest pain",
                    "example_output": "Patient presents with chest pain."
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, valid_profiles).unwrap();

        assert!(validate_profiles_file(&profiles_path).is_ok());
    }

    #[test]
    fn test_profiles_with_incomplete_example() {
        let invalid_profiles = r#"{
            "profiles": [
                {
                    "id": "medical",
                    "name": "Medical Transcription",
                    "example_input": "Patient presents with chest pain"
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, invalid_profiles).unwrap();

        let result = validate_profiles_file(&profiles_path);
        assert!(result.is_err());
        match result.unwrap_err() {
            ConfigError::IncompleteProfileExample => {}
            _ => panic!("Expected IncompleteProfileExample error"),
        }
    }

    #[test]
    fn test_malformed_json() {
        let malformed_json = r#"{
            "whisper": {
                "api_key": "test"
            // missing closing brace
        "#;

        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("settings.json");
        fs::write(&settings_path, malformed_json).unwrap();

        let result = validate_settings_file(&settings_path);
        assert!(result.is_err());
        match result.unwrap_err() {
            ConfigError::InvalidJson { .. } => {}
            _ => panic!("Expected InvalidJson error"),
        }
    }

    #[test]
    fn test_file_not_found() {
        let result = validate_settings_file("nonexistent.json");
        assert!(result.is_err());
        match result.unwrap_err() {
            ConfigError::FileNotFound { .. } => {}
            _ => panic!("Expected FileNotFound error"),
        }
    }

    #[test]
    fn test_visible_profiles_within_limit() {
        let valid_profiles = r#"{
            "profiles": [
                {
                    "id": "profile1",
                    "name": "Profile 1",
                    "visible": true
                },
                {
                    "id": "profile2",
                    "name": "Profile 2",
                    "visible": true
                },
                {
                    "id": "profile3",
                    "name": "Profile 3",
                    "visible": false
                },
                {
                    "id": "profile4",
                    "name": "Profile 4",
                    "visible": null
                },
                {
                    "id": "profile5",
                    "name": "Profile 5"
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, valid_profiles).unwrap();

        assert!(validate_profiles_file(&profiles_path).is_ok());
    }

    #[test]
    fn test_visible_profiles_at_limit() {
        let valid_profiles = r#"{
            "profiles": [
                {
                    "id": "profile1",
                    "name": "Profile 1",
                    "visible": true
                },
                {
                    "id": "profile2",
                    "name": "Profile 2",
                    "visible": true
                },
                {
                    "id": "profile3",
                    "name": "Profile 3",
                    "visible": true
                },
                {
                    "id": "profile4",
                    "name": "Profile 4",
                    "visible": true
                },
                {
                    "id": "profile5",
                    "name": "Profile 5",
                    "visible": true
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, valid_profiles).unwrap();

        assert!(validate_profiles_file(&profiles_path).is_ok());
    }

    #[test]
    fn test_visible_profiles_exceeds_limit() {
        let invalid_profiles = r#"{
            "profiles": [
                {
                    "id": "profile1",
                    "name": "Profile 1",
                    "visible": true
                },
                {
                    "id": "profile2",
                    "name": "Profile 2",
                    "visible": true
                },
                {
                    "id": "profile3",
                    "name": "Profile 3",
                    "visible": true
                },
                {
                    "id": "profile4",
                    "name": "Profile 4",
                    "visible": true
                },
                {
                    "id": "profile5",
                    "name": "Profile 5",
                    "visible": true
                },
                {
                    "id": "profile6",
                    "name": "Profile 6",
                    "visible": true
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, invalid_profiles).unwrap();

        let result = validate_profiles_file(&profiles_path);
        assert!(result.is_err());
        match result.unwrap_err() {
            ConfigError::MaxVisibleProfilesExceeded => {}
            _ => panic!("Expected MaxVisibleProfilesExceeded error"),
        }
    }

    #[test]
    fn test_visible_profiles_null_and_false_ignored() {
        let valid_profiles = r#"{
            "profiles": [
                {
                    "id": "profile1",
                    "name": "Profile 1",
                    "visible": true
                },
                {
                    "id": "profile2",
                    "name": "Profile 2",
                    "visible": false
                },
                {
                    "id": "profile3",
                    "name": "Profile 3",
                    "visible": null
                },
                {
                    "id": "profile4",
                    "name": "Profile 4"
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, valid_profiles).unwrap();

        assert!(validate_profiles_file(&profiles_path).is_ok());
    }

    #[test]
    fn test_shortcut_no_conflicts() {
        let valid_profiles = r#"{
            "profiles": [
                {
                    "id": "profile1",
                    "name": "Profile 1",
                    "shortcut": "Ctrl+Alt+1"
                },
                {
                    "id": "profile2",
                    "name": "Profile 2",
                    "shortcut": "Ctrl+Alt+2"
                },
                {
                    "id": "profile3",
                    "name": "Profile 3"
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, valid_profiles).unwrap();

        assert!(validate_profiles_file(&profiles_path).is_ok());
    }

    #[test]
    fn test_shortcut_conflicts() {
        let invalid_profiles = r#"{
            "profiles": [
                {
                    "id": "profile1",
                    "name": "Profile 1",
                    "shortcut": "Ctrl+Alt+1"
                },
                {
                    "id": "profile2",
                    "name": "Profile 2",
                    "shortcut": "Ctrl+Alt+1"
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, invalid_profiles).unwrap();

        let result = validate_profiles_file(&profiles_path);
        assert!(result.is_err());
        match result.unwrap_err() {
            ConfigError::ShortcutConflict => {}
            other => panic!("Expected ShortcutConflict error, got: {:?}", other),
        }
    }

    #[test]
    fn test_shortcut_empty_shortcuts_ignored() {
        let valid_profiles = r#"{
            "profiles": [
                {
                    "id": "profile1",
                    "name": "Profile 1",
                    "shortcut": ""
                },
                {
                    "id": "profile2",
                    "name": "Profile 2",
                    "shortcut": "   "
                },
                {
                    "id": "profile3",
                    "name": "Profile 3",
                    "shortcut": null
                },
                {
                    "id": "profile4",
                    "name": "Profile 4"
                }
            ]
        }"#;

        let temp_dir = TempDir::new().unwrap();
        let profiles_path = temp_dir.path().join("profiles.json");
        fs::write(&profiles_path, valid_profiles).unwrap();

        assert!(validate_profiles_file(&profiles_path).is_ok());
    }
}
