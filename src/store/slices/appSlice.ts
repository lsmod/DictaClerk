import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Profile interface (moving from ProfileContext to Redux)
export interface Profile {
  id: string
  name: string
  description?: string
  prompt?: string
  example_input?: string
  example_output?: string
  active: boolean
  visible?: boolean
  shortcut?: string
  created_at: string
  updated_at: string
}

export interface ProfileCollection {
  profiles: Profile[]
  default_profile_id: string
}

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

// Advanced error types for better error handling
export interface AppError {
  type:
    | 'transcription'
    | 'gpt-formatting'
    | 'clipboard'
    | 'profile-validation'
    | 'system'
  message: string
  recoverable: boolean
  timestamp: number
  context?: Record<string, unknown>
}

// Processing progress for better UX
export interface ProcessingProgress {
  stage: 'transcription' | 'gpt-formatting' | 'clipboard'
  progress: number // 0-100
  message?: string
}

// Clipboard state for advanced clipboard integration
export interface ClipboardState {
  lastCopiedText: string | null
  lastCopiedAt: number | null
  copyHistory: Array<{
    text: string
    timestamp: number
    profileId: string
  }>
}

// Window management state
export interface WindowState {
  mainWindow: {
    visible: boolean
    focused: boolean
    position?: { x: number; y: number }
    size?: { width: number; height: number }
  }
  settingsWindow: {
    visible: boolean
    focused: boolean
  }
  profileEditorWindow: {
    visible: boolean
    focused: boolean
    editingProfileId: string | null
  }
}

export interface AppState {
  // Core state
  status: AppStatus

  // Window management (enhanced)
  mainWindowVisible: boolean
  hasModalWindow: boolean
  windowState: WindowState

  // Recording data
  recordingStartTime: number | null
  recordingTime: number

  // Processing data (enhanced)
  originalTranscript: string | null
  finalText: string | null
  profileId: string | null
  processingProgress: ProcessingProgress | null

  // Profile management (moved from ProfileContext)
  profiles: Profile[]
  activeProfileId: string | null
  profilesLoading: boolean
  profilesError: string | null

  // Enhanced error handling
  error: string | null
  errors: AppError[]
  lastError: AppError | null

  // Clipboard integration
  clipboard: ClipboardState

  // Backend sync
  lastBackendSync: number
  backendConnected: boolean
  connectionRetries: number

  // Advanced features
  systemTrayVisible: boolean
  shortcutsEnabled: boolean
  autoRecoveryMode: boolean
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
  windowState: {
    mainWindow: {
      visible: true,
      focused: true,
    },
    settingsWindow: {
      visible: false,
      focused: false,
    },
    profileEditorWindow: {
      visible: false,
      focused: false,
      editingProfileId: null,
    },
  },
  recordingStartTime: null,
  recordingTime: 0,
  originalTranscript: null,
  finalText: null,
  profileId: null,
  processingProgress: null,
  profiles: [],
  activeProfileId: null,
  profilesLoading: false,
  profilesError: null,
  error: null,
  errors: [],
  lastError: null,
  clipboard: {
    lastCopiedText: null,
    lastCopiedAt: null,
    copyHistory: [],
  },
  lastBackendSync: 0,
  backendConnected: false,
  connectionRetries: 0,
  systemTrayVisible: true,
  shortcutsEnabled: true,
  autoRecoveryMode: false,
}

// Helper function to check if a profile is the clipboard profile
const isClipboardProfile = (profileId: string): boolean => {
  return profileId === '1'
}

// Helper function to get visible profiles (clipboard + up to 4 user profiles)
const getVisibleProfiles = (profiles: Profile[]): Profile[] => {
  const clipboardProfile = profiles.find((p) => p.id === '1')
  const userProfiles = profiles
    .filter((p) => p.id !== '1' && p.visible === true)
    .slice(0, 4)

  return clipboardProfile ? [clipboardProfile, ...userProfiles] : userProfiles
}

// Helper function to get editable profiles (excluding clipboard, max 4)
const getEditableProfiles = (profiles: Profile[]): Profile[] => {
  return profiles.filter((p) => p.id !== '1').slice(0, 4)
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
      state.connectionRetries = 0

      // Update window state
      state.windowState.mainWindow.visible = context.main_window_visible
      state.windowState.settingsWindow.visible =
        current_state.includes('SettingsWindowOpen')
      state.windowState.profileEditorWindow.visible =
        current_state.includes('ProfileEditorOpen')

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
        state.processingProgress = null
      }

      // Handle processing progress
      if (context.is_processing) {
        if (!state.processingProgress) {
          state.processingProgress = {
            stage: state.status.includes('transcription')
              ? 'transcription'
              : state.status.includes('gpt')
                ? 'gpt-formatting'
                : 'clipboard',
            progress: 0,
          }
        }
      } else {
        state.processingProgress = null
      }
    },

    // Local UI state updates
    updateRecordingTime: (state) => {
      if (state.status === 'recording' && state.recordingStartTime) {
        state.recordingTime = Date.now() - state.recordingStartTime
      }
    },

    // Processing progress updates
    updateProcessingProgress: (
      state,
      action: PayloadAction<ProcessingProgress>
    ) => {
      state.processingProgress = action.payload
    },

    // Profile management actions
    setProfilesLoading: (state, action: PayloadAction<boolean>) => {
      state.profilesLoading = action.payload
    },

    setProfilesError: (state, action: PayloadAction<string | null>) => {
      state.profilesError = action.payload
    },

    setProfiles: (state, action: PayloadAction<Profile[]>) => {
      state.profiles = action.payload
      state.profilesError = null
    },

    setActiveProfile: (state, action: PayloadAction<string>) => {
      state.activeProfileId = action.payload
    },

    profileSelected: (state, action: PayloadAction<{ profile_id: string }>) => {
      state.activeProfileId = action.payload.profile_id
    },

    // Enhanced error handling
    addError: (state, action: PayloadAction<AppError>) => {
      state.errors.push(action.payload)
      state.lastError = action.payload
      if (action.payload.type === 'system') {
        state.error = action.payload.message
      }
    },

    removeError: (state, action: PayloadAction<number>) => {
      state.errors = state.errors.filter((_, index) => index !== action.payload)
    },

    clearErrors: (state) => {
      state.errors = []
      state.lastError = null
      state.error = null
    },

    // Error acknowledgment
    acknowledgeError: (state) => {
      if (state.status.startsWith('error-')) {
        state.status = 'idle'
        state.error = null
        state.lastError = null
        // Clear any processing data when acknowledging errors
        state.originalTranscript = null
        state.finalText = null
        state.profileId = null
        state.processingProgress = null
      }
    },

    // Clipboard integration
    updateClipboard: (
      state,
      action: PayloadAction<{
        text: string
        profileId: string
      }>
    ) => {
      const { text, profileId } = action.payload
      const timestamp = Date.now()

      state.clipboard.lastCopiedText = text
      state.clipboard.lastCopiedAt = timestamp

      // Add to history (keep last 10 entries)
      state.clipboard.copyHistory.unshift({
        text,
        timestamp,
        profileId,
      })
      if (state.clipboard.copyHistory.length > 10) {
        state.clipboard.copyHistory = state.clipboard.copyHistory.slice(0, 10)
      }
    },

    clearClipboardHistory: (state) => {
      state.clipboard.copyHistory = []
    },

    // Window management
    updateWindowState: (state, action: PayloadAction<Partial<WindowState>>) => {
      state.windowState = { ...state.windowState, ...action.payload }
    },

    setWindowFocus: (
      state,
      action: PayloadAction<{
        window: keyof WindowState
        focused: boolean
      }>
    ) => {
      const { window, focused } = action.payload
      state.windowState[window].focused = focused
    },

    // Backend connection status
    setBackendConnected: (state, action: PayloadAction<boolean>) => {
      state.backendConnected = action.payload
      if (action.payload) {
        state.connectionRetries = 0
      } else {
        state.connectionRetries += 1
        // Reset to safe state when backend disconnects
        state.status = 'idle'
        state.recordingStartTime = null
        state.recordingTime = 0
        state.processingProgress = null

        // Enable auto-recovery mode after 3 failed connections
        if (state.connectionRetries >= 3) {
          state.autoRecoveryMode = true
        }
      }
    },

    // Auto-recovery
    setAutoRecoveryMode: (state, action: PayloadAction<boolean>) => {
      state.autoRecoveryMode = action.payload
    },

    // System tray
    setSystemTrayVisible: (state, action: PayloadAction<boolean>) => {
      state.systemTrayVisible = action.payload
    },

    // Shortcuts
    setShortcutsEnabled: (state, action: PayloadAction<boolean>) => {
      state.shortcutsEnabled = action.payload
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

    // Set error message (legacy support)
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      // Also add to advanced error system
      const error: AppError = {
        type: 'system',
        message: action.payload,
        recoverable: true,
        timestamp: Date.now(),
      }
      state.errors.push(error)
      state.lastError = error
    },
  },
})

// Enhanced selectors for computed profile values
export const selectVisibleProfiles = (state: { app: AppState }): Profile[] => {
  return getVisibleProfiles(state.app.profiles)
}

export const selectEditableProfiles = (state: { app: AppState }): Profile[] => {
  return getEditableProfiles(state.app.profiles)
}

export const selectIsClipboardProfile = (profileId: string): boolean => {
  return isClipboardProfile(profileId)
}

export const selectActiveProfile = (state: {
  app: AppState
}): Profile | null => {
  return (
    state.app.profiles.find((p) => p.id === state.app.activeProfileId) || null
  )
}

// Advanced selectors
export const selectIsRecording = (state: { app: AppState }): boolean => {
  return state.app.status === 'recording'
}

export const selectIsProcessing = (state: { app: AppState }): boolean => {
  return state.app.status.startsWith('processing')
}

export const selectHasErrors = (state: { app: AppState }): boolean => {
  return state.app.errors.length > 0 || !!state.app.error
}

export const selectRecoverableErrors = (state: {
  app: AppState
}): AppError[] => {
  return state.app.errors.filter((error) => error.recoverable)
}

export const selectClipboardHistory = (state: { app: AppState }) => {
  return state.app.clipboard.copyHistory
}

export const selectWindowVisible =
  (window: keyof WindowState) =>
  (state: { app: AppState }): boolean => {
    return state.app.windowState[window].visible
  }

export const {
  backendStateChanged,
  updateRecordingTime,
  updateProcessingProgress,
  setProfilesLoading,
  setProfilesError,
  setProfiles,
  setActiveProfile,
  profileSelected,
  addError,
  removeError,
  clearErrors,
  acknowledgeError,
  updateClipboard,
  clearClipboardHistory,
  updateWindowState,
  setWindowFocus,
  setBackendConnected,
  setAutoRecoveryMode,
  setSystemTrayVisible,
  setShortcutsEnabled,
  setProcessingData,
  setError,
} = appSlice.actions

export default appSlice.reducer
