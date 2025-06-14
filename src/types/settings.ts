/**
 * TypeScript type definitions for DictaClerk settings configuration
 * Matches the structure defined in settings.json
 */

export interface WhisperSettings {
  api_key: string
  endpoint: string
  model: string
  timeout_seconds: number
  max_retries: number
}

export interface AudioSettings {
  input_device: string | null
  sample_rate: number
  buffer_size: number
}

export interface EncodingSettings {
  bitrate: number
  size_limit_mb: number
}

export interface UiSettings {
  theme: string
  auto_start_recording: boolean
}

/**
 * Complete settings configuration interface
 * This matches the structure in settings.json and the Rust SettingsConfig struct
 */
export interface SettingsConfig {
  whisper: WhisperSettings
  audio: AudioSettings
  encoding: EncodingSettings
  ui: UiSettings
  global_shortcut: string
}

/**
 * Partial settings for updates - all fields optional
 */
export type PartialSettingsConfig = Partial<SettingsConfig>

/**
 * Settings validation result
 */
export interface SettingsValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Settings save result from backend
 */
export interface SettingsSaveResult {
  success: boolean
  message: string
  path?: string
}

/**
 * Type guard to check if an object is a valid SettingsConfig
 */
export function isSettingsConfig(obj: unknown): obj is SettingsConfig {
  if (!obj || typeof obj !== 'object' || obj === null) {
    return false
  }

  const config = obj as Record<string, unknown>

  return (
    typeof config.global_shortcut === 'string' &&
    isWhisperSettings(config.whisper) &&
    isAudioSettings(config.audio) &&
    isEncodingSettings(config.encoding) &&
    isUiSettings(config.ui)
  )
}

/**
 * Type guard for WhisperSettings
 */
function isWhisperSettings(obj: unknown): obj is WhisperSettings {
  if (!obj || typeof obj !== 'object' || obj === null) {
    return false
  }

  const whisper = obj as Record<string, unknown>

  return (
    typeof whisper.api_key === 'string' &&
    typeof whisper.endpoint === 'string' &&
    typeof whisper.model === 'string' &&
    typeof whisper.timeout_seconds === 'number' &&
    typeof whisper.max_retries === 'number'
  )
}

/**
 * Type guard for AudioSettings
 */
function isAudioSettings(obj: unknown): obj is AudioSettings {
  if (!obj || typeof obj !== 'object' || obj === null) {
    return false
  }

  const audio = obj as Record<string, unknown>

  return (
    (audio.input_device === null || typeof audio.input_device === 'string') &&
    typeof audio.sample_rate === 'number' &&
    typeof audio.buffer_size === 'number'
  )
}

/**
 * Type guard for EncodingSettings
 */
function isEncodingSettings(obj: unknown): obj is EncodingSettings {
  if (!obj || typeof obj !== 'object' || obj === null) {
    return false
  }

  const encoding = obj as Record<string, unknown>

  return (
    typeof encoding.bitrate === 'number' &&
    typeof encoding.size_limit_mb === 'number'
  )
}

/**
 * Type guard for UiSettings
 */
function isUiSettings(obj: unknown): obj is UiSettings {
  if (!obj || typeof obj !== 'object' || obj === null) {
    return false
  }

  const ui = obj as Record<string, unknown>

  return (
    typeof ui.theme === 'string' && typeof ui.auto_start_recording === 'boolean'
  )
}
