//! ProfileEngine service for applying profile instructions to transcripts
//!
//! This service processes transcripts according to profile instructions and examples.
//! It handles different profile types and formats output for clipboard usage.
//!
//! ## Usage Example
//!
//! ```rust,no_run
//! use dicta_clerk_lib::services::{ProfileEngine, Profile};
//!
//! let engine = ProfileEngine::new();
//! let profile = Profile {
//!     id: "medical".to_string(),
//!     name: "Medical Transcription".to_string(),
//!     description: Some("Medical profile".to_string()),
//!     prompt: Some("Format as medical report".to_string()),
//!     example_input: Some("patient has fever".to_string()),
//!     example_output: Some("Patient presents with fever.".to_string()),
//!     active: true,
//!     visible: Some(true),
//!     shortcut: Some("Ctrl+Alt+M".to_string()),
//!     created_at: "2025-01-01T00:00:00Z".to_string(),
//!     updated_at: "2025-01-01T00:00:00Z".to_string(),
//! };
//!
//! let result = engine.apply_profile(&profile, "transcript text");
//! ```

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Configuration for ProfileEngine
#[derive(Debug, Clone)]
pub struct ProfileEngineConfig {
    /// Maximum transcript length to process (default: 50000 characters)
    pub max_transcript_length: usize,
    /// Whether to validate profile structure (default: true)
    pub validate_profiles: bool,
}

impl Default for ProfileEngineConfig {
    fn default() -> Self {
        Self {
            max_transcript_length: 50000,
            validate_profiles: true,
        }
    }
}

/// Profile structure matching the JSON schema
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Profile {
    /// Unique profile identifier
    pub id: String,
    /// Human-readable profile name
    pub name: String,
    /// Profile description
    pub description: Option<String>,
    /// Profile instruction/prompt for formatting
    pub prompt: Option<String>,
    /// Example input text for this profile
    pub example_input: Option<String>,
    /// Expected output for the example input
    pub example_output: Option<String>,
    /// Whether this profile is active
    pub active: bool,
    /// Whether this profile is visible in the UI (max 5)
    pub visible: Option<bool>,
    /// Optional keyboard shortcut for quick profile selection
    pub shortcut: Option<String>,
    /// Profile creation timestamp
    pub created_at: String,
    /// Profile last update timestamp
    pub updated_at: String,
}

/// Collection of profiles with default selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileCollection {
    /// List of available profiles
    pub profiles: Vec<Profile>,
    /// ID of the default profile to use
    pub default_profile_id: String,
}

/// Errors that can occur during profile processing
#[derive(Error, Debug)]
pub enum ProfileError {
    #[error("Profile validation failed: {reason}")]
    ValidationFailed { reason: String },

    #[error("Transcript too long: {length} characters (max: {max} characters)")]
    TranscriptTooLong { length: usize, max: usize },

    #[error(
        "Profile has incomplete example: example_input provided but example_output is missing"
    )]
    IncompleteExample,

    #[error("Profile processing error: {message}")]
    ProcessingError { message: String },

    #[error("Profile not found: {id}")]
    ProfileNotFound { id: String },

    #[error("Maximum five visible profiles")]
    MaxVisibleProfilesExceeded,

    #[error("Shortcut conflict")]
    ShortcutConflict,
}

/// Result type for profile operations
pub type ProfileResult<T> = Result<T, ProfileError>;

/// ProfileEngine for applying profile instructions to transcripts
pub struct ProfileEngine {
    /// Configuration
    config: ProfileEngineConfig,
}

impl ProfileEngine {
    /// Create a new ProfileEngine with default configuration
    pub fn new() -> Self {
        Self {
            config: ProfileEngineConfig::default(),
        }
    }

    /// Create a new ProfileEngine with custom configuration
    pub fn with_config(config: ProfileEngineConfig) -> Self {
        Self { config }
    }

    /// Apply profile instruction to transcript
    ///
    /// # Arguments
    /// * `profile` - Profile containing instruction and examples
    /// * `transcript` - Raw transcript text to process
    ///
    /// # Returns
    /// * Formatted text string ready for clipboard
    ///
    /// # Behavior
    /// * If profile is "Transcription" (no instruction), returns raw transcript unchanged
    /// * If profile has instruction but no examples, applies instruction with simple placeholder replacement
    /// * If profile has examples, formats as AI prompt with examples for better formatting
    ///
    /// # Requirements (from GWT)
    /// * Given a transcript and profile instruction When apply_profile() called Then output reflects instruction with placeholders replaced
    /// * Given profile includes examples When function executed Then examples passed in prompt to Whisper for better formatting
    /// * Given profile "Transcription" (no instruction) When applied Then raw transcript returned unchanged
    pub fn apply_profile(&self, profile: &Profile, transcript: &str) -> ProfileResult<String> {
        // Validate inputs
        if self.config.validate_profiles {
            self.validate_profile(profile)?;
        }

        self.validate_transcript_length(transcript)?;

        // Handle "Transcription" profile (no instruction) - return raw transcript
        if profile.name == "General Transcription" || profile.prompt.is_none() {
            return Ok(transcript.to_string());
        }

        let instruction = profile.prompt.as_ref().unwrap();

        // Handle profile with examples - format as AI prompt
        if let (Some(example_input), Some(example_output)) =
            (&profile.example_input, &profile.example_output)
        {
            return Ok(self.format_with_examples(
                instruction,
                example_input,
                example_output,
                transcript,
            ));
        }

        // Handle profile with instruction only - simple placeholder replacement
        Ok(self.apply_instruction_with_placeholders(instruction, transcript))
    }

    /// Validate profile structure
    fn validate_profile(&self, profile: &Profile) -> ProfileResult<()> {
        // Check for incomplete examples
        if let (Some(_), None) = (&profile.example_input, &profile.example_output) {
            return Err(ProfileError::IncompleteExample);
        }

        // Validate profile ID is not empty
        if profile.id.trim().is_empty() {
            return Err(ProfileError::ValidationFailed {
                reason: "Profile ID cannot be empty".to_string(),
            });
        }

        // Validate profile name is not empty
        if profile.name.trim().is_empty() {
            return Err(ProfileError::ValidationFailed {
                reason: "Profile name cannot be empty".to_string(),
            });
        }

        Ok(())
    }

    /// Validate transcript length
    fn validate_transcript_length(&self, transcript: &str) -> ProfileResult<()> {
        let length = transcript.len();
        if length > self.config.max_transcript_length {
            return Err(ProfileError::TranscriptTooLong {
                length,
                max: self.config.max_transcript_length,
            });
        }
        Ok(())
    }

    /// Format with examples for AI processing
    /// Uses the specified prompt format: instruction\n\nExamples:\n<example_input> → <example_output>\n\nText:\n<transcript>
    fn format_with_examples(
        &self,
        instruction: &str,
        example_input: &str,
        example_output: &str,
        transcript: &str,
    ) -> String {
        format!(
            "{}\n\nExamples:\n{} → {}\n\nText:\n{}",
            instruction, example_input, example_output, transcript
        )
    }

    /// Apply instruction with simple placeholder replacement
    fn apply_instruction_with_placeholders(&self, instruction: &str, transcript: &str) -> String {
        // Create placeholders map
        let mut placeholders = HashMap::new();
        placeholders.insert("transcript", transcript);
        placeholders.insert("text", transcript);

        // Replace placeholders in instruction
        let mut result = instruction.to_string();
        for (placeholder, value) in placeholders {
            let placeholder_variants = [
                format!("{{{{{}}}}}", placeholder), // {{transcript}}
                format!("<{}>", placeholder),       // <transcript>
                format!("[{}]", placeholder),       // [transcript]
            ];

            for variant in &placeholder_variants {
                result = result.replace(variant, value);
            }
        }

        // If no placeholders found, append transcript to instruction
        if result == instruction {
            format!("{}\n\n{}", instruction, transcript)
        } else {
            result
        }
    }

    /// Find profile by ID in a profile collection
    pub fn find_profile_by_id<'a>(
        &self,
        profiles: &'a ProfileCollection,
        profile_id: &str,
    ) -> ProfileResult<&'a Profile> {
        profiles
            .profiles
            .iter()
            .find(|p| p.id == profile_id)
            .ok_or_else(|| ProfileError::ProfileNotFound {
                id: profile_id.to_string(),
            })
    }

    /// Get default profile from collection
    pub fn get_default_profile<'a>(
        &self,
        profiles: &'a ProfileCollection,
    ) -> ProfileResult<&'a Profile> {
        self.find_profile_by_id(profiles, &profiles.default_profile_id)
    }

    /// Load profiles from JSON string
    pub fn load_profiles_from_json(&self, json: &str) -> ProfileResult<ProfileCollection> {
        serde_json::from_str(json).map_err(|e| ProfileError::ProcessingError {
            message: format!("Failed to parse profiles JSON: {}", e),
        })
    }

    /// Validate a profile collection before saving
    /// Enforces business rules like visible profile limits
    pub fn validate_profiles_collection(&self, profiles: &ProfileCollection) -> ProfileResult<()> {
        let visible_count = profiles
            .profiles
            .iter()
            .filter(|profile| profile.visible.unwrap_or(false))
            .count();

        if visible_count > 5 {
            return Err(ProfileError::MaxVisibleProfilesExceeded);
        }

        Ok(())
    }

    /// Validate shortcut conflicts within a profile collection and against global shortcut
    pub fn validate_shortcut_conflicts(
        &self,
        profiles: &ProfileCollection,
        global_shortcut: Option<&str>,
    ) -> ProfileResult<()> {
        let mut shortcuts_seen = std::collections::HashSet::new();

        // Add global shortcut to the set if provided
        if let Some(global) = global_shortcut {
            if !global.trim().is_empty() {
                shortcuts_seen.insert(global.to_string());
            }
        }

        // Check for conflicts within profiles
        for profile in &profiles.profiles {
            if let Some(ref shortcut) = profile.shortcut {
                if !shortcut.trim().is_empty() {
                    if shortcuts_seen.contains(shortcut) {
                        return Err(ProfileError::ShortcutConflict);
                    }
                    shortcuts_seen.insert(shortcut.clone());
                }
            }
        }

        Ok(())
    }
}

impl Default for ProfileEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl Profile {
    /// Check if this profile is the clipboard profile (direct copy without formatting)
    pub fn is_clipboard_profile(&self) -> bool {
        self.id == "1"
    }

    /// Check if this profile should use GPT formatting
    pub fn should_use_gpt_formatting(&self) -> bool {
        !self.is_clipboard_profile()
            && self.prompt.is_some()
            && !self.prompt.as_ref().unwrap().is_empty()
    }
}

/// Ensure clipboard profile (Profile 1) always exists in the system
pub fn ensure_clipboard_profile(profiles: &mut Vec<Profile>) {
    if !profiles.iter().any(|p| p.id == "1") {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let timestamp = format!(
            "2025-01-01T{:02}:{:02}:{:02}Z",
            (now / 3600) % 24,
            (now / 60) % 60,
            now % 60
        );

        let clipboard_profile = Profile {
            id: "1".to_string(),
            name: "Clipboard".to_string(),
            description: Some(
                "Copy transcription directly to clipboard without formatting".to_string(),
            ),
            prompt: None, // No prompt for clipboard profile - bypasses GPT formatting
            example_input: None,
            example_output: None,
            active: false,       // Not active by default, but always available
            visible: Some(true), // Always visible as first profile
            shortcut: None,
            created_at: timestamp.clone(),
            updated_at: timestamp,
        };

        // Insert at the beginning to ensure it's Profile 1
        profiles.insert(0, clipboard_profile);
    } else {
        // Ensure the existing Profile 1 has correct clipboard profile properties
        if let Some(profile_1) = profiles.iter_mut().find(|p| p.id == "1") {
            profile_1.name = "Clipboard".to_string();
            profile_1.description =
                Some("Copy transcription directly to clipboard without formatting".to_string());
            profile_1.prompt = None; // Ensure no prompt for clipboard profile
            profile_1.visible = Some(true); // Always visible
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_profile() -> Profile {
        Profile {
            id: "test".to_string(),
            name: "Test Profile".to_string(),
            description: Some("Test description".to_string()),
            prompt: Some("Please format this text: {{transcript}}".to_string()),
            example_input: None,
            example_output: None,
            active: true,
            visible: None,
            shortcut: None,
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        }
    }

    fn create_transcription_profile() -> Profile {
        Profile {
            id: "general".to_string(),
            name: "General Transcription".to_string(),
            description: Some("Standard transcription".to_string()),
            prompt: None,
            example_input: None,
            example_output: None,
            active: true,
            visible: None,
            shortcut: None,
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        }
    }

    fn create_profile_with_examples() -> Profile {
        Profile {
            id: "medical".to_string(),
            name: "Medical Profile".to_string(),
            description: Some("Medical formatting".to_string()),
            prompt: Some("Format as medical report".to_string()),
            example_input: Some("patient has fever".to_string()),
            example_output: Some("Patient presents with fever.".to_string()),
            active: true,
            visible: None,
            shortcut: None,
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_profile_engine_creation() {
        let engine = ProfileEngine::new();
        assert_eq!(engine.config.max_transcript_length, 50000);
        assert!(engine.config.validate_profiles);
    }

    #[test]
    fn test_profile_engine_with_custom_config() {
        let config = ProfileEngineConfig {
            max_transcript_length: 1000,
            validate_profiles: false,
        };
        let engine = ProfileEngine::with_config(config);
        assert_eq!(engine.config.max_transcript_length, 1000);
        assert!(!engine.config.validate_profiles);
    }

    #[test]
    fn test_apply_profile_transcription_no_prompt() {
        let engine = ProfileEngine::new();
        let profile = create_transcription_profile();
        let transcript = "This is a test transcript";

        let result = engine.apply_profile(&profile, transcript).unwrap();
        assert_eq!(result, transcript);
    }

    #[test]
    fn test_apply_profile_with_instruction_placeholder() {
        let engine = ProfileEngine::new();
        let profile = create_test_profile();
        let transcript = "This is a test transcript";

        let result = engine.apply_profile(&profile, transcript).unwrap();
        assert_eq!(result, "Please format this text: This is a test transcript");
    }

    #[test]
    fn test_apply_profile_with_examples() {
        let engine = ProfileEngine::new();
        let profile = create_profile_with_examples();
        let transcript = "patient is sick";

        let result = engine.apply_profile(&profile, transcript).unwrap();
        let expected = "Format as medical report\n\nExamples:\npatient has fever → Patient presents with fever.\n\nText:\npatient is sick";
        assert_eq!(result, expected);
    }

    #[test]
    fn test_apply_profile_without_placeholders() {
        let engine = ProfileEngine::new();
        let mut profile = create_test_profile();
        profile.prompt = Some("Please format this text properly".to_string());
        let transcript = "This is a test transcript";

        let result = engine.apply_profile(&profile, transcript).unwrap();
        assert_eq!(
            result,
            "Please format this text properly\n\nThis is a test transcript"
        );
    }

    #[test]
    fn test_validate_profile_incomplete_example() {
        let engine = ProfileEngine::new();
        let mut profile = create_test_profile();
        profile.example_input = Some("input".to_string());
        profile.example_output = None;

        let result = engine.apply_profile(&profile, "test");
        assert!(matches!(result, Err(ProfileError::IncompleteExample)));
    }

    #[test]
    fn test_validate_transcript_too_long() {
        let config = ProfileEngineConfig {
            max_transcript_length: 10,
            validate_profiles: true,
        };
        let engine = ProfileEngine::with_config(config);
        let profile = create_test_profile();

        let result = engine.apply_profile(&profile, "This is a very long transcript");
        assert!(matches!(
            result,
            Err(ProfileError::TranscriptTooLong { .. })
        ));
    }

    #[test]
    fn test_validate_profile_empty_id() {
        let engine = ProfileEngine::new();
        let mut profile = create_test_profile();
        profile.id = "".to_string();

        let result = engine.apply_profile(&profile, "test");
        assert!(matches!(result, Err(ProfileError::ValidationFailed { .. })));
    }

    #[test]
    fn test_validate_profile_empty_name() {
        let engine = ProfileEngine::new();
        let mut profile = create_test_profile();
        profile.name = "".to_string();

        let result = engine.apply_profile(&profile, "test");
        assert!(matches!(result, Err(ProfileError::ValidationFailed { .. })));
    }

    #[test]
    fn test_placeholder_variants() {
        let engine = ProfileEngine::new();
        let test_cases = vec![
            ("Format: {{transcript}}", "Format: test text"),
            ("Format: <transcript>", "Format: test text"),
            ("Format: [transcript]", "Format: test text"),
            ("Format: {{text}}", "Format: test text"),
            ("Format: <text>", "Format: test text"),
            ("Format: [text]", "Format: test text"),
        ];

        for (instruction, expected) in test_cases {
            let mut profile = create_test_profile();
            profile.prompt = Some(instruction.to_string());

            let result = engine.apply_profile(&profile, "test text").unwrap();
            assert_eq!(result, expected, "Failed for instruction: {}", instruction);
        }
    }

    #[test]
    fn test_load_profiles_from_json() {
        let engine = ProfileEngine::new();
        let json = r#"{
            "profiles": [
                {
                    "id": "test",
                    "name": "Test Profile",
                    "description": "Test",
                    "prompt": "Test prompt",
                    "active": true,
                    "created_at": "2025-01-01T00:00:00Z",
                    "updated_at": "2025-01-01T00:00:00Z"
                }
            ],
            "default_profile_id": "test"
        }"#;

        let profiles = engine.load_profiles_from_json(json).unwrap();
        assert_eq!(profiles.profiles.len(), 1);
        assert_eq!(profiles.default_profile_id, "test");
        assert_eq!(profiles.profiles[0].id, "test");
    }

    #[test]
    fn test_find_profile_by_id() {
        let engine = ProfileEngine::new();
        let profiles = ProfileCollection {
            profiles: vec![create_test_profile()],
            default_profile_id: "test".to_string(),
        };

        let profile = engine.find_profile_by_id(&profiles, "test").unwrap();
        assert_eq!(profile.id, "test");

        let result = engine.find_profile_by_id(&profiles, "nonexistent");
        assert!(matches!(result, Err(ProfileError::ProfileNotFound { .. })));
    }

    #[test]
    fn test_get_default_profile() {
        let engine = ProfileEngine::new();
        let profiles = ProfileCollection {
            profiles: vec![create_test_profile()],
            default_profile_id: "test".to_string(),
        };

        let profile = engine.get_default_profile(&profiles).unwrap();
        assert_eq!(profile.id, "test");
    }

    #[test]
    fn test_profile_validation_disabled() {
        let config = ProfileEngineConfig {
            max_transcript_length: 50000,
            validate_profiles: false,
        };
        let engine = ProfileEngine::with_config(config);
        let mut profile = create_test_profile();
        profile.id = "".to_string(); // This would normally fail validation

        let result = engine.apply_profile(&profile, "test");
        assert!(result.is_ok()); // Should succeed because validation is disabled
    }

    #[test]
    fn test_complete_example_flow() {
        let engine = ProfileEngine::new();

        // Test the complete workflow from JSON to applying profile
        let json = r#"{
            "profiles": [
                {
                    "id": "medical",
                    "name": "Medical Profile",
                    "description": "Medical formatting",
                    "prompt": "Format as medical report",
                    "example_input": "patient has fever",
                    "example_output": "Patient presents with fever.",
                    "active": true,
                    "created_at": "2025-01-01T00:00:00Z",
                    "updated_at": "2025-01-01T00:00:00Z"
                }
            ],
            "default_profile_id": "medical"
        }"#;

        let profiles = engine.load_profiles_from_json(json).unwrap();
        let profile = engine.get_default_profile(&profiles).unwrap();
        let result = engine.apply_profile(profile, "patient is sick").unwrap();

        let expected = "Format as medical report\n\nExamples:\npatient has fever → Patient presents with fever.\n\nText:\npatient is sick";
        assert_eq!(result, expected);
    }

    #[test]
    fn test_validate_profiles_collection_within_limit() {
        let engine = ProfileEngine::new();
        let mut profile1 = create_test_profile();
        profile1.id = "profile1".to_string();
        profile1.visible = Some(true);

        let mut profile2 = create_test_profile();
        profile2.id = "profile2".to_string();
        profile2.visible = Some(true);

        let mut profile3 = create_test_profile();
        profile3.id = "profile3".to_string();
        profile3.visible = Some(false);

        let profiles = ProfileCollection {
            profiles: vec![profile1, profile2, profile3],
            default_profile_id: "profile1".to_string(),
        };

        assert!(engine.validate_profiles_collection(&profiles).is_ok());
    }

    #[test]
    fn test_validate_profiles_collection_at_limit() {
        let engine = ProfileEngine::new();
        let mut profiles_vec = Vec::new();

        for i in 1..=5 {
            let mut profile = create_test_profile();
            profile.id = format!("profile{}", i);
            profile.visible = Some(true);
            profiles_vec.push(profile);
        }

        let profiles = ProfileCollection {
            profiles: profiles_vec,
            default_profile_id: "profile1".to_string(),
        };

        assert!(engine.validate_profiles_collection(&profiles).is_ok());
    }

    #[test]
    fn test_validate_profiles_collection_exceeds_limit() {
        let engine = ProfileEngine::new();
        let mut profiles_vec = Vec::new();

        for i in 1..=6 {
            let mut profile = create_test_profile();
            profile.id = format!("profile{}", i);
            profile.visible = Some(true);
            profiles_vec.push(profile);
        }

        let profiles = ProfileCollection {
            profiles: profiles_vec,
            default_profile_id: "profile1".to_string(),
        };

        let result = engine.validate_profiles_collection(&profiles);
        assert!(matches!(
            result,
            Err(ProfileError::MaxVisibleProfilesExceeded)
        ));
    }

    #[test]
    fn test_validate_profiles_collection_null_and_false_ignored() {
        let engine = ProfileEngine::new();
        let mut profile1 = create_test_profile();
        profile1.id = "profile1".to_string();
        profile1.visible = Some(true);

        let mut profile2 = create_test_profile();
        profile2.id = "profile2".to_string();
        profile2.visible = Some(false);

        let mut profile3 = create_test_profile();
        profile3.id = "profile3".to_string();
        profile3.visible = None;

        let mut profile4 = create_test_profile();
        profile4.id = "profile4".to_string();
        // visible field is None by default

        let profiles = ProfileCollection {
            profiles: vec![profile1, profile2, profile3, profile4],
            default_profile_id: "profile1".to_string(),
        };

        assert!(engine.validate_profiles_collection(&profiles).is_ok());
    }

    #[test]
    fn test_profile_with_shortcut() {
        let mut profile = create_test_profile();
        profile.shortcut = Some("Ctrl+Alt+1".to_string());

        assert_eq!(profile.shortcut, Some("Ctrl+Alt+1".to_string()));
    }

    #[test]
    fn test_validate_shortcut_conflicts_no_conflicts() {
        let engine = ProfileEngine::new();
        let mut profile1 = create_test_profile();
        profile1.id = "profile1".to_string();
        profile1.shortcut = Some("Ctrl+Alt+1".to_string());

        let mut profile2 = create_test_profile();
        profile2.id = "profile2".to_string();
        profile2.shortcut = Some("Ctrl+Alt+2".to_string());

        let profiles = ProfileCollection {
            profiles: vec![profile1, profile2],
            default_profile_id: "profile1".to_string(),
        };

        assert!(engine
            .validate_shortcut_conflicts(&profiles, Some("Ctrl+Shift+R"))
            .is_ok());
    }

    #[test]
    fn test_validate_shortcut_conflicts_profile_conflict() {
        let engine = ProfileEngine::new();
        let mut profile1 = create_test_profile();
        profile1.id = "profile1".to_string();
        profile1.shortcut = Some("Ctrl+Alt+1".to_string());

        let mut profile2 = create_test_profile();
        profile2.id = "profile2".to_string();
        profile2.shortcut = Some("Ctrl+Alt+1".to_string()); // Same shortcut

        let profiles = ProfileCollection {
            profiles: vec![profile1, profile2],
            default_profile_id: "profile1".to_string(),
        };

        let result = engine.validate_shortcut_conflicts(&profiles, Some("Ctrl+Shift+R"));
        assert!(matches!(result, Err(ProfileError::ShortcutConflict)));
    }

    #[test]
    fn test_validate_shortcut_conflicts_global_conflict() {
        let engine = ProfileEngine::new();
        let mut profile1 = create_test_profile();
        profile1.id = "profile1".to_string();
        profile1.shortcut = Some("Ctrl+Shift+R".to_string()); // Same as global

        let profiles = ProfileCollection {
            profiles: vec![profile1],
            default_profile_id: "profile1".to_string(),
        };

        let result = engine.validate_shortcut_conflicts(&profiles, Some("Ctrl+Shift+R"));
        assert!(matches!(result, Err(ProfileError::ShortcutConflict)));
    }

    #[test]
    fn test_validate_shortcut_conflicts_empty_shortcuts_ignored() {
        let engine = ProfileEngine::new();
        let mut profile1 = create_test_profile();
        profile1.id = "profile1".to_string();
        profile1.shortcut = Some("".to_string()); // Empty shortcut

        let mut profile2 = create_test_profile();
        profile2.id = "profile2".to_string();
        profile2.shortcut = Some("   ".to_string()); // Whitespace only

        let mut profile3 = create_test_profile();
        profile3.id = "profile3".to_string();
        profile3.shortcut = None; // No shortcut

        let profiles = ProfileCollection {
            profiles: vec![profile1, profile2, profile3],
            default_profile_id: "profile1".to_string(),
        };

        assert!(engine
            .validate_shortcut_conflicts(&profiles, Some("Ctrl+Shift+R"))
            .is_ok());
    }
}
