import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Frontend state types mirroring backend AppStateMachine
export type AppStatus =
  | 'idle'
  | 'recording'
  | 'processing-transcription'
  | 'processing-gpt-formatting'
  | 'processing-clipboard'
  | 'processing-complete'
  | 'settings-open'
  | 'profile-editor-new'
  | 'profile-editor-edit'
  | 'error-transcription'
  | 'error-gpt-formatting'
  | 'error-clipboard'
  | 'error-profile-validation'

export interface AppState {
  // Core state
  status: AppStatus

  // Window management
  mainWindowVisible: boolean
  hasModalWindow: boolean

  // Recording data
  recordingStartTime: number | null
  recordingTime: number

  // Processing data
  originalTranscript: string | null
  finalText: string | null
  profileId: string | null

  // Error handling
  error: string | null

  // Backend sync
  lastBackendSync: number
  backendConnected: boolean
}

// Backend event payload structure
export interface BackendStateEvent {
  previous_state: string
  current_state: string
  event: string
  timestamp: number
  context: {
    is_recording: boolean
    is_processing: boolean
    main_window_visible: boolean
    has_modal_window: boolean
  }
}

const initialState: AppState = {
  status: 'idle',
  mainWindowVisible: true,
  hasModalWindow: false,
  recordingStartTime: null,
  recordingTime: 0,
  originalTranscript: null,
  finalText: null,
  profileId: null,
  error: null,
  lastBackendSync: 0,
  backendConnected: false,
}

// Map backend states to frontend states
const mapBackendToFrontendStatus = (backendState: string): AppStatus => {
  if (backendState.includes('Idle')) return 'idle'
  if (backendState.includes('Recording')) return 'recording'
  if (backendState.includes('ProcessingTranscription'))
    return 'processing-transcription'
  if (backendState.includes('ProcessingGPTFormatting'))
    return 'processing-gpt-formatting'
  if (backendState.includes('ProcessingClipboard'))
    return 'processing-clipboard'
  if (backendState.includes('ProcessingComplete')) return 'processing-complete'
  if (backendState.includes('SettingsWindowOpen')) return 'settings-open'
  if (backendState.includes('NewProfileEditorOpen')) return 'profile-editor-new'
  if (backendState.includes('EditProfileEditorOpen'))
    return 'profile-editor-edit'
  if (backendState.includes('TranscriptionError')) return 'error-transcription'
  if (backendState.includes('GPTFormattingError')) return 'error-gpt-formatting'
  if (backendState.includes('ClipboardError')) return 'error-clipboard'
  if (backendState.includes('ProfileValidationError'))
    return 'error-profile-validation'
  return 'idle'
}

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // Sync with backend events
    backendStateChanged: (state, action: PayloadAction<BackendStateEvent>) => {
      const { current_state, context, timestamp } = action.payload

      // Update frontend state to match backend
      state.status = mapBackendToFrontendStatus(current_state)
      state.mainWindowVisible = context.main_window_visible
      state.hasModalWindow = context.has_modal_window
      state.lastBackendSync = timestamp
      state.backendConnected = true

      // Handle recording state
      if (context.is_recording && !state.recordingStartTime) {
        state.recordingStartTime = Date.now()
      } else if (!context.is_recording && state.recordingStartTime) {
        state.recordingStartTime = null
        state.recordingTime = 0
      }

      // Clear error when transitioning away from error states
      if (!state.status.startsWith('error-')) {
        state.error = null
      }
    },

    // Local UI state updates
    updateRecordingTime: (state) => {
      if (state.status === 'recording' && state.recordingStartTime) {
        state.recordingTime = Date.now() - state.recordingStartTime
      }
    },

    // Error acknowledgment
    acknowledgeError: (state) => {
      if (state.status.startsWith('error-')) {
        state.status = 'idle'
        state.error = null
      }
    },

    // Backend connection status
    setBackendConnected: (state, action: PayloadAction<boolean>) => {
      state.backendConnected = action.payload
      if (!action.payload) {
        // Reset to safe state when backend disconnects
        state.status = 'idle'
        state.recordingStartTime = null
        state.recordingTime = 0
      }
    },

    // Set processing data (from backend events)
    setProcessingData: (
      state,
      action: PayloadAction<{
        originalTranscript?: string | null
        finalText?: string | null
        profileId?: string | null
      }>
    ) => {
      const { originalTranscript, finalText, profileId } = action.payload
      if (originalTranscript !== undefined)
        state.originalTranscript = originalTranscript
      if (finalText !== undefined) state.finalText = finalText
      if (profileId !== undefined) state.profileId = profileId
    },

    // Set error message
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
    },
  },
})

export const {
  backendStateChanged,
  updateRecordingTime,
  acknowledgeError,
  setBackendConnected,
  setProcessingData,
  setError,
} = appSlice.actions

export default appSlice.reducer
