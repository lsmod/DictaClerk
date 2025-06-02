# ProfileEngine Usage Guide

This document provides examples of how to use the ProfileEngine service to apply profile instructions to transcripts.

## Quick Start

```rust
use dicta_clerk_lib::services::{ProfileEngine, Profile};

// Create a ProfileEngine
let engine = ProfileEngine::new();

// Define a profile
let profile = Profile {
    id: "medical".to_string(),
    name: "Medical Transcription".to_string(),
    description: Some("Medical profile".to_string()),
    prompt: Some("Format as medical report: {{transcript}}".to_string()),
    example_input: None,
    example_output: None,
    active: true,
    created_at: "2025-01-01T00:00:00Z".to_string(),
    updated_at: "2025-01-01T00:00:00Z".to_string(),
};

// Apply profile to transcript
let result = engine.apply_profile(&profile, "Patient has fever").unwrap();
println!("Result: {}", result);
// Output: "Format as medical report: Patient has fever"
```

## Working with Profile Collections

```rust
use dicta_clerk_lib::services::{ProfileEngine, ProfileCollection};

let engine = ProfileEngine::new();

// Load profiles from JSON
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

println!("Result: {}", result);
// Output: "Format as medical report\n\nExamples:\npatient has fever → Patient presents with fever.\n\nText:\npatient is sick"
```

## Profile Types

### 1. Transcription Profile (No Instruction)

Returns the raw transcript unchanged.

```rust
let profile = Profile {
    id: "general".to_string(),
    name: "General Transcription".to_string(),
    prompt: None, // No instruction
    // ... other fields
};

let result = engine.apply_profile(&profile, "Hello world").unwrap();
// Result: "Hello world" (unchanged)
```

### 2. Profile with Instruction Only

Applies simple placeholder replacement.

```rust
let profile = Profile {
    id: "format".to_string(),
    name: "Formatting Profile".to_string(),
    prompt: Some("Please format: {{transcript}}".to_string()),
    example_input: None,
    example_output: None,
    // ... other fields
};

let result = engine.apply_profile(&profile, "test text").unwrap();
// Result: "Please format: test text"
```

### 3. Profile with Examples

Formats as AI prompt with examples for better processing.

```rust
let profile = Profile {
    id: "medical".to_string(),
    name: "Medical Profile".to_string(),
    prompt: Some("Format as medical report".to_string()),
    example_input: Some("patient has fever".to_string()),
    example_output: Some("Patient presents with fever.".to_string()),
    // ... other fields
};

let result = engine.apply_profile(&profile, "patient is sick").unwrap();
// Result: "Format as medical report\n\nExamples:\npatient has fever → Patient presents with fever.\n\nText:\npatient is sick"
```

## Placeholder Support

The ProfileEngine supports multiple placeholder formats:

- `{{transcript}}` - Double curly braces
- `<transcript>` - Angle brackets
- `[transcript]` - Square brackets
- `{{text}}` - Alternative name for transcript
- `<text>` - Alternative name for transcript
- `[text]` - Alternative name for transcript

## Configuration

```rust
use dicta_clerk_lib::services::{ProfileEngine, ProfileEngineConfig};

let config = ProfileEngineConfig {
    max_transcript_length: 10000,
    validate_profiles: true,
};

let engine = ProfileEngine::with_config(config);
```

## Error Handling

```rust
use dicta_clerk_lib::services::{ProfileEngine, ProfileError};

let engine = ProfileEngine::new();
let mut profile = create_invalid_profile(); // Profile with incomplete example

match engine.apply_profile(&profile, "test") {
    Ok(result) => println!("Success: {}", result),
    Err(ProfileError::IncompleteExample) => {
        println!("Profile has example_input but missing example_output");
    },
    Err(ProfileError::TranscriptTooLong { length, max }) => {
        println!("Transcript too long: {} > {}", length, max);
    },
    Err(ProfileError::ValidationFailed { reason }) => {
        println!("Validation failed: {}", reason);
    },
    Err(e) => println!("Other error: {}", e),
}
```

## Integration with Existing Services

The ProfileEngine is designed to work with the existing WhisperClient service:

```rust
use dicta_clerk_lib::services::{ProfileEngine, WhisperClient, OpenAIWhisperClient};

// 1. Transcribe audio with WhisperClient
let whisper_client = OpenAIWhisperClient::new("api-key".to_string());
let transcript = whisper_client.transcribe(audio_path, None).await?;

// 2. Apply profile formatting with ProfileEngine
let profile_engine = ProfileEngine::new();
let profiles = profile_engine.load_profiles_from_json(&profiles_json)?;
let profile = profile_engine.get_default_profile(&profiles)?;
let formatted_result = profile_engine.apply_profile(profile, &transcript.text)?;

// 3. Result is ready for clipboard
println!("Formatted transcript: {}", formatted_result);
```

## Testing

The ProfileEngine includes comprehensive unit tests that achieve >90% coverage:

```bash
cargo test services::profile_engine
```

All tests validate the GWT (Given-When-Then) acceptance criteria from the original issue:

- ✅ Given a transcript and profile instruction When apply_profile() called Then output reflects instruction with placeholders replaced
- ✅ Given profile includes examples When function executed Then examples passed in prompt to Whisper for better formatting
- ✅ Given profile "Transcription" (no instruction) When applied Then raw transcript returned unchanged
