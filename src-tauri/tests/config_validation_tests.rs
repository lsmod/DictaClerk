//! Integration tests for configuration validation
//!
//! These tests validate the config validation system against real files
//! and ensure proper error handling and coverage.

use dicta_clerk_lib::config::{validate_config_files, ConfigError};
use std::env;
use std::fs;
use tempfile::TempDir;

fn create_test_environment_with_files(
    settings_content: &str,
    profiles_content: &str,
) -> (TempDir, std::path::PathBuf) {
    let temp_dir = TempDir::new().unwrap();
    let original_dir = env::current_dir().unwrap();

    fs::write(temp_dir.path().join("settings.json"), settings_content).unwrap();
    fs::write(temp_dir.path().join("profiles.json"), profiles_content).unwrap();

    (temp_dir, original_dir)
}

fn with_temp_dir<F, R>(settings_content: &str, profiles_content: &str, test_fn: F) -> R
where
    F: FnOnce() -> R,
{
    let (temp_dir, original_dir) =
        create_test_environment_with_files(settings_content, profiles_content);

    // Change to temp directory for the test
    env::set_current_dir(temp_dir.path()).unwrap();

    // Run the test
    let result = test_fn();

    // Restore original directory
    env::set_current_dir(original_dir).unwrap();

    result
}

#[test]
fn test_valid_configuration_files() {
    let valid_settings = r#"{
        "whisper": {
            "api_key": "sk-test123"
        }
    }"#;

    let valid_profiles = r#"{
        "profiles": [
            {
                "id": "general",
                "name": "General Transcription"
            }
        ]
    }"#;

    with_temp_dir(valid_settings, valid_profiles, || {
        let result = validate_config_files();
        assert!(result.is_ok(), "Valid configuration should pass validation");
    });
}

#[test]
fn test_missing_settings_file() {
    let temp_dir = TempDir::new().unwrap();
    let original_dir = env::current_dir().unwrap();

    // Only create profiles.json, leave settings.json missing
    fs::write(temp_dir.path().join("profiles.json"), r#"{"profiles": []}"#).unwrap();

    env::set_current_dir(temp_dir.path()).unwrap();

    let result = validate_config_files();

    // Restore directory before assertions
    env::set_current_dir(original_dir).unwrap();

    assert!(result.is_err());

    match result.unwrap_err() {
        ConfigError::FileNotFound { path } => {
            assert_eq!(path, "settings.json");
        }
        other => panic!("Expected FileNotFound error, got: {:?}", other),
    }
}

#[test]
fn test_missing_profiles_file() {
    let temp_dir = TempDir::new().unwrap();
    let original_dir = env::current_dir().unwrap();

    // Only create settings.json, leave profiles.json missing
    fs::write(
        temp_dir.path().join("settings.json"),
        r#"{"whisper": {"api_key": "test"}}"#,
    )
    .unwrap();

    env::set_current_dir(temp_dir.path()).unwrap();

    let result = validate_config_files();

    // Restore directory before assertions
    env::set_current_dir(original_dir).unwrap();

    assert!(result.is_err());

    match result.unwrap_err() {
        ConfigError::FileNotFound { path } => {
            assert_eq!(path, "profiles.json");
        }
        other => panic!("Expected FileNotFound error, got: {:?}", other),
    }
}

#[test]
fn test_malformed_settings_json() {
    let malformed_settings = r#"{
        "whisper": {
            "api_key": "test"
        // missing closing brace
    "#;

    let valid_profiles = r#"{"profiles": []}"#;

    with_temp_dir(malformed_settings, valid_profiles, || {
        let result = validate_config_files();
        assert!(result.is_err());

        match result.unwrap_err() {
            ConfigError::InvalidJson { path, .. } => {
                assert_eq!(path, "settings.json");
            }
            other => panic!("Expected InvalidJson error, got: {:?}", other),
        }
    });
}

#[test]
fn test_settings_validation_missing_required_field() {
    let invalid_settings = r#"{
        "whisper": {}
    }"#;

    let valid_profiles = r#"{"profiles": []}"#;

    with_temp_dir(invalid_settings, valid_profiles, || {
        let result = validate_config_files();
        assert!(result.is_err());

        match result.unwrap_err() {
            ConfigError::ValidationError { path, message } => {
                assert_eq!(path, "settings.json");
                assert!(
                    message.contains("api_key"),
                    "Error should mention missing api_key: {}",
                    message
                );
            }
            other => panic!("Expected ValidationError, got: {:?}", other),
        }
    });
}

#[test]
fn test_profiles_incomplete_example() {
    let valid_settings = r#"{
        "whisper": {
            "api_key": "sk-test123"
        }
    }"#;

    let invalid_profiles = r#"{
        "profiles": [
            {
                "id": "medical",
                "name": "Medical Transcription",
                "example_input": "Patient presents with chest pain"
            }
        ]
    }"#;

    with_temp_dir(valid_settings, invalid_profiles, || {
        let result = validate_config_files();
        assert!(result.is_err());

        match result.unwrap_err() {
            ConfigError::IncompleteProfileExample => {}
            other => panic!("Expected IncompleteProfileExample error, got: {:?}", other),
        }
    });
}

#[test]
fn test_profiles_complete_example() {
    let valid_settings = r#"{
        "whisper": {
            "api_key": "sk-test123"
        }
    }"#;

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

    with_temp_dir(valid_settings, valid_profiles, || {
        let result = validate_config_files();
        assert!(result.is_ok(), "Complete example should be valid");
    });
}

#[test]
fn test_profiles_with_null_examples() {
    let valid_settings = r#"{
        "whisper": {
            "api_key": "sk-test123"
        }
    }"#;

    let valid_profiles = r#"{
        "profiles": [
            {
                "id": "general",
                "name": "General Transcription",
                "example_input": null,
                "example_output": null
            }
        ]
    }"#;

    with_temp_dir(valid_settings, valid_profiles, || {
        let result = validate_config_files();
        assert!(result.is_ok(), "Null examples should be valid");
    });
}

#[test]
fn test_settings_with_all_optional_fields() {
    let comprehensive_settings = r#"{
        "whisper": {
            "api_key": "sk-test123",
            "endpoint": "https://custom-endpoint.com/v1/audio/transcriptions",
            "model": "whisper-1",
            "timeout_seconds": 60,
            "max_retries": 5
        },
        "audio": {
            "input_device": "Built-in Microphone",
            "sample_rate": 22050,
            "buffer_size": 512
        },
        "encoding": {
            "bitrate": 64000,
            "size_limit_mb": 20
        },
        "ui": {
            "theme": "dark",
            "auto_start_recording": true
        }
    }"#;

    let valid_profiles = r#"{"profiles": []}"#;

    with_temp_dir(comprehensive_settings, valid_profiles, || {
        let result = validate_config_files();
        assert!(result.is_ok(), "Comprehensive settings should be valid");
    });
}

#[test]
fn test_settings_invalid_values() {
    let invalid_settings = r#"{
        "whisper": {
            "api_key": "sk-test123",
            "timeout_seconds": -1
        }
    }"#;

    let valid_profiles = r#"{"profiles": []}"#;

    with_temp_dir(invalid_settings, valid_profiles, || {
        let result = validate_config_files();
        assert!(result.is_err());

        match result.unwrap_err() {
            ConfigError::ValidationError { message, .. } => {
                assert!(
                    message.contains("timeout_seconds") || message.contains("minimum"),
                    "Error should mention invalid timeout_seconds: {}",
                    message
                );
            }
            other => panic!("Expected ValidationError, got: {:?}", other),
        }
    });
}
