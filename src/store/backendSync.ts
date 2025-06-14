import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { AppDispatch } from './store'
import {
  backendStateChanged,
  setBackendConnected,
  setProcessingData,
  setError,
  acknowledgeError as acknowledgeErrorAction,
  setProfilesLoading,
  setProfilesError,
  setProfiles,
  setActiveProfile,
  profileSelected,
  BackendStateEvent,
  ProfileCollection,
  addError,
  updateProcessingProgress,
  updateClipboard,
  updateWindowState,
  setWindowFocus,
  setAutoRecoveryMode,
  AppError,
  ProcessingProgress,
  WindowState,
  clearErrors,
} from './slices/appSlice'

// Backend command interface
export interface BackendCommands {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  cancelRecording: () => Promise<void>
  openSettings: () => Promise<void>
  closeSettings: () => Promise<void>
  acknowledgeError: () => Promise<void>
  reformatWithProfile: (profileId: string) => Promise<void>
  showMainWindow: () => Promise<void>
  hideMainWindow: () => Promise<void>

  // Profile management commands
  loadProfiles: () => Promise<void>
  selectProfile: (profileId: string) => Promise<void>
  saveProfiles: (profileCollection: ProfileCollection) => Promise<void>

  // Advanced features
  clearClipboardHistory: () => Promise<void>
  enableAutoRecovery: () => Promise<void>
  disableAutoRecovery: () => Promise<void>
  retryConnection: () => Promise<void>
  getClipboardHistory: () => Promise<void>
}

// Setup backend event listeners and return command interface
export const setupBackendSync = (dispatch: AppDispatch): BackendCommands => {
  // Define loadProfiles function
  const loadProfilesImpl = async () => {
    try {
      dispatch(setProfilesLoading(true))
      dispatch(setProfilesError(null))

      console.log('Loading profiles via Redux...')
      const profileData = await invoke<ProfileCollection>('load_profiles')
      console.log('Loaded profile data via Redux:', profileData)

      dispatch(setProfiles(profileData.profiles))

      // Set active profile to clipboard profile (ID "1") first, then fallback to default or first active profile
      const clipboardProfile = profileData.profiles.find((p) => p.id === '1')
      const defaultProfile = profileData.profiles.find(
        (p) => p.id === profileData.default_profile_id
      )
      const activeProfile =
        clipboardProfile ||
        defaultProfile ||
        profileData.profiles.find((p) => p.active)

      if (activeProfile) {
        dispatch(setActiveProfile(activeProfile.id))
        console.log('Set active profile ID via Redux:', activeProfile.id)
      } else {
        console.warn('No active profile found')
      }
    } catch (error) {
      console.error('Failed to load profiles via Redux:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load profiles'
      dispatch(setProfilesError(errorMessage))

      // Add detailed error
      const detailedError: AppError = {
        type: 'profile-validation',
        message: errorMessage,
        recoverable: true,
        timestamp: Date.now(),
        context: { operation: 'load_profiles', error: String(error) },
      }
      dispatch(addError(detailedError))
    } finally {
      dispatch(setProfilesLoading(false))
    }
  }

  // Listen to backend state machine events
  const setupEventListeners = async () => {
    try {
      console.log('🔄 [BACKEND-SYNC] Setting up backend event listeners...')

      // Listen for backend state changes
      await listen<BackendStateEvent>('app-state-changed', (event) => {
        console.log('📡 [BACKEND-SYNC] Backend state changed:', event.payload)

        // Add detailed logging about the state transition
        const payload = event.payload
        console.log('🔍 [BACKEND-SYNC] State transition details:', {
          from: payload.previous_state,
          to: payload.current_state,
          event: payload.event,
          timestamp: payload.timestamp,
          context: payload.context,
        })

        // Check if we're transitioning to processing states
        if (payload.current_state.includes('Processing')) {
          console.log(
            '🔄 [BACKEND-SYNC] ✨ PROCESSING STATE DETECTED:',
            payload.current_state
          )
          console.log('📊 [BACKEND-SYNC] Processing context:', payload.context)
        }

        // Check if processing progress should be updated
        if (payload.context.is_processing) {
          console.log('🔄 [BACKEND-SYNC] Processing progress should be tracked')
        }

        dispatch(backendStateChanged(payload))
      })

      // Listen for processing data updates
      await listen<{
        original_transcript?: string
        final_text?: string
        profile_id?: string
      }>('processing-data-updated', (event) => {
        console.log('📊 [BACKEND-SYNC] Processing data updated:', event.payload)
        dispatch(
          setProcessingData({
            originalTranscript: event.payload.original_transcript || null,
            finalText: event.payload.final_text || null,
            profileId: event.payload.profile_id || null,
          })
        )
      })

      // Listen for processing progress updates
      await listen<{
        stage: string
        progress: number
        message?: string
      }>('processing-progress-updated', (event) => {
        console.log('Processing progress updated:', event.payload)
        const progress: ProcessingProgress = {
          stage: event.payload.stage as ProcessingProgress['stage'],
          progress: event.payload.progress,
          message: event.payload.message,
        }
        dispatch(updateProcessingProgress(progress))
      })

      // Listen for clipboard updates
      await listen<{
        text: string
        profile_id: string
      }>('clipboard-updated', (event) => {
        console.log('Clipboard updated:', event.payload)
        dispatch(
          updateClipboard({
            text: event.payload.text,
            profileId: event.payload.profile_id,
          })
        )
      })

      // Listen for errors
      await listen<{ error: string }>('app-error', (event) => {
        console.log('Backend error:', event.payload)
        dispatch(setError(event.payload.error))
      })

      // Listen for detailed errors
      await listen<{
        type: string
        message: string
        recoverable: boolean
        context?: Record<string, unknown>
      }>('app-error-detailed', (event) => {
        console.log('Backend detailed error:', event.payload)
        const error: AppError = {
          type: event.payload.type as AppError['type'],
          message: event.payload.message,
          recoverable: event.payload.recoverable,
          timestamp: Date.now(),
          context: event.payload.context,
        }
        dispatch(addError(error))
      })

      // Listen for window focus events
      await listen<{
        window: string
        focused: boolean
      }>('window-focus-changed', (event) => {
        console.log('Window focus changed:', event.payload)
        dispatch(
          setWindowFocus({
            window: event.payload.window as keyof WindowState,
            focused: event.payload.focused,
          })
        )
      })

      // Listen for window state updates
      await listen<{
        main_window?: {
          visible: boolean
          position?: { x: number; y: number }
        }
        settings_window?: { visible: boolean }
        profile_editor_window?: {
          visible: boolean
          editing_profile_id?: string
        }
      }>('window-state-updated', (event) => {
        console.log('Window state updated:', event.payload)
        const windowUpdate: Partial<WindowState> = {}

        if (event.payload.main_window) {
          windowUpdate.mainWindow = {
            visible: event.payload.main_window.visible,
            focused: false, // Default value
            position: event.payload.main_window.position,
          }
        }

        if (event.payload.settings_window) {
          windowUpdate.settingsWindow = {
            visible: event.payload.settings_window.visible,
            focused: false, // Default value
          }

          // If settings window is closing and main window is becoming visible, refresh profiles
          if (
            !event.payload.settings_window.visible &&
            event.payload.main_window?.visible
          ) {
            // Trigger profile reload with a small delay to ensure settings have been saved
            setTimeout(() => {
              dispatch(setProfilesLoading(true))
              // Use the loadProfiles command from the backend sync
              loadProfilesImpl()
            }, 100)
          }
        }

        if (event.payload.profile_editor_window) {
          windowUpdate.profileEditorWindow = {
            visible: event.payload.profile_editor_window.visible,
            focused: false, // Default value
            editingProfileId:
              event.payload.profile_editor_window.editing_profile_id || null,
          }
        }

        dispatch(updateWindowState(windowUpdate))
      })

      // Listen for profile selection events from shortcuts
      await listen<{ profile_id: string }>('selectProfile', (event) => {
        console.log('Profile selected via shortcut:', event.payload)
        dispatch(profileSelected(event.payload))
      })

      // Listen for profiles-updated events from backend
      await listen<ProfileCollection>('profiles-updated', (event) => {
        dispatch(setProfiles(event.payload.profiles))

        // Set active profile to clipboard profile (ID "1") first, then fallback to default or first active profile
        const clipboardProfile = event.payload.profiles.find(
          (p) => p.id === '1'
        )
        const defaultProfile = event.payload.profiles.find(
          (p) => p.id === event.payload.default_profile_id
        )
        const activeProfile =
          clipboardProfile ||
          defaultProfile ||
          event.payload.profiles.find((p) => p.active)

        if (activeProfile) {
          dispatch(setActiveProfile(activeProfile.id))
        }
      })

      // Listen for auto-recovery events
      await listen<{ enabled: boolean }>('auto-recovery-changed', (event) => {
        console.log('Auto-recovery changed:', event.payload)
        dispatch(setAutoRecoveryMode(event.payload.enabled))
      })

      // Listen for error acknowledgment events from state machine
      await listen('error-acknowledged', () => {
        console.log('Error acknowledged by state machine')
        dispatch(acknowledgeErrorAction())
      })

      // Listen for app state reset events from state machine
      await listen('app-state-reset', () => {
        console.log('App state reset by state machine')
        // Clear all errors and reset to safe state
        dispatch(clearErrors())
        dispatch(setBackendConnected(true))
      })

      // Listen for backend connection retry events
      await listen('backend-connection-retry', () => {
        console.log('Backend connection retry initiated')
        dispatch(setBackendConnected(false))
        // The actual reconnection will be handled by re-establishing listeners
      })

      console.log('Backend sync event listeners set up successfully')

      dispatch(setBackendConnected(true))
      console.log('Backend event listeners setup successfully')
    } catch (error) {
      console.error('Failed to setup backend event listeners:', error)
      dispatch(setBackendConnected(false))

      // Add detailed error
      const detailedError: AppError = {
        type: 'system',
        message: `Failed to setup backend connection: ${error}`,
        recoverable: true,
        timestamp: Date.now(),
        context: { error: String(error) },
      }
      dispatch(addError(detailedError))
    }
  }

  // Initialize event listeners
  setupEventListeners()

  // Return command interface for sending commands to backend
  return {
    startRecording: async () => {
      try {
        console.log('🎙️ [RECORDING] Starting recording command initiated...')
        console.time('start-recording')

        // Check current state before starting
        console.log('🔍 [RECORDING] Checking current state before recording...')
        const currentState = await invoke('get_current_state')
        console.log('📋 [RECORDING] Current state:', currentState)

        // Check if audio capture is ready
        console.log('🔍 [RECORDING] Checking audio capture status...')
        const isCurrentlyRecording = await invoke('is_recording')
        console.log('📊 [RECORDING] Audio capture status:', {
          isCurrentlyRecording,
        })

        // Use state machine transition instead of direct audio commands
        console.log(
          '🚀 [RECORDING] Calling start_recording_via_state_machine...'
        )
        await invoke('start_recording_via_state_machine')
        console.log(
          '✅ [RECORDING] start_recording_via_state_machine completed'
        )

        // Verify recording started
        console.log('🔍 [RECORDING] Verifying recording started...')
        const isNowRecording = await invoke('is_recording')
        const newState = await invoke('get_current_state')
        console.log('📊 [RECORDING] Post-start verification:', {
          isNowRecording,
          newState,
          stateChanged: currentState !== newState,
        })

        console.timeEnd('start-recording')
        console.log('🎉 [RECORDING] Recording startup sequence completed')
      } catch (error) {
        console.error('❌ [RECORDING] Failed to start recording:', error)
        console.error('❌ [RECORDING] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          errorString: String(error),
        })
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to start recording: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: { operation: 'start_recording', error: String(error) },
        }
        dispatch(addError(detailedError))
      }
    },

    stopRecording: async () => {
      try {
        console.log('🛑 [STOP-BUTTON] Stopping recording via state machine...')
        console.log(
          '🔍 [STOP-BUTTON] About to call stop_recording_and_process_to_clipboard'
        )
        console.time('stop-recording-process')

        // Use comprehensive stop and process command
        const result = await invoke('stop_recording_and_process_to_clipboard')

        console.timeEnd('stop-recording-process')
        console.log(
          '✅ [STOP-BUTTON] Recording stopped and processed via state machine:',
          result
        )
      } catch (error) {
        console.error('❌ [STOP-BUTTON] Failed to stop recording:', error)
        console.error('❌ [STOP-BUTTON] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          errorString: String(error),
        })
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to stop recording: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: { operation: 'stop_recording', error: String(error) },
        }
        dispatch(addError(detailedError))
        throw error // Re-throw to let caller handle if needed
      }
    },

    cancelRecording: async () => {
      try {
        console.log('🚫 Cancelling recording via state machine...')
        // Use state machine event to cancel recording
        await invoke('stop_recording_via_state_machine')
        console.log('✅ Recording cancelled via state machine')
      } catch (error) {
        console.error('❌ Failed to cancel recording:', error)
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to cancel recording: ${error}`,
          recoverable: false,
          timestamp: Date.now(),
          context: { operation: 'cancel_recording', error: String(error) },
        }
        dispatch(addError(detailedError))
      }
    },

    openSettings: async () => {
      try {
        await invoke('open_settings_window')
        console.log('Settings opened via Redux')
      } catch (error) {
        console.error('Failed to open settings:', error)
        dispatch(setError(`Failed to open settings: ${error}`))
      }
    },

    closeSettings: async () => {
      try {
        await invoke('close_settings_window')
        console.log('Settings closed via Redux')
      } catch (error) {
        console.error('Failed to close settings:', error)
        dispatch(setError(`Failed to close settings: ${error}`))
      }
    },

    acknowledgeError: async () => {
      try {
        // Use new state machine-connected command for error acknowledgment
        await invoke('acknowledge_error_via_state_machine')
        console.log('Error acknowledged via state machine')

        // Clear frontend error state
        dispatch(acknowledgeErrorAction())
      } catch (error) {
        console.error('Failed to acknowledge error:', error)
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to acknowledge error: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: { operation: 'acknowledge_error', error: String(error) },
        }
        dispatch(addError(detailedError))
      }
    },

    reformatWithProfile: async (profileId: string) => {
      try {
        // This command triggers reformat using the original transcript
        console.log('Reformat with profile via Redux:', profileId)
        await invoke('reformat_with_profile', { profileId })
        console.log('Text reformatted with profile:', profileId)
      } catch (error) {
        console.error('Failed to reformat with profile:', error)
        const detailedError: AppError = {
          type: 'gpt-formatting',
          message: `Failed to reformat with profile: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: { operation: 'reformat', profileId, error: String(error) },
        }
        dispatch(addError(detailedError))
      }
    },

    showMainWindow: async () => {
      try {
        await invoke('show_main_window')
        console.log('Main window shown via Redux')
      } catch (error) {
        console.error('Failed to show main window:', error)
        dispatch(setError(`Failed to show main window: ${error}`))
      }
    },

    hideMainWindow: async () => {
      try {
        await invoke('hide_main_window')
        console.log('Main window hidden via Redux')
      } catch (error) {
        console.error('Failed to hide main window:', error)
        dispatch(setError(`Failed to hide main window: ${error}`))
      }
    },

    // Profile management commands
    loadProfiles: loadProfilesImpl,

    selectProfile: async (profileId: string) => {
      try {
        console.log('Selecting profile via Redux:', profileId)
        await invoke('select_profile', { profileId })
        dispatch(setActiveProfile(profileId))
        console.log('Profile selected via Redux:', profileId)
      } catch (error) {
        console.error('Failed to select profile via Redux:', error)
        const detailedError: AppError = {
          type: 'profile-validation',
          message: `Failed to select profile: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: {
            operation: 'select_profile',
            profileId,
            error: String(error),
          },
        }
        dispatch(addError(detailedError))
      }
    },

    saveProfiles: async (profileCollection: ProfileCollection) => {
      try {
        console.log('Saving profiles via Redux:', profileCollection)
        await invoke('save_profiles', { profiles: profileCollection })

        // Reload profiles to sync with backend
        dispatch(setProfiles(profileCollection.profiles))
        console.log('Profiles saved and synced via Redux')
      } catch (error) {
        console.error('Failed to save profiles via Redux:', error)
        const detailedError: AppError = {
          type: 'profile-validation',
          message: `Failed to save profiles: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: {
            operation: 'save_profiles',
            profileCount: profileCollection.profiles.length,
            error: String(error),
          },
        }
        dispatch(addError(detailedError))
      }
    },

    // Advanced features
    clearClipboardHistory: async () => {
      try {
        // Command doesn't exist yet, provide a simple fallback
        console.log('Clipboard history cleared via Redux (fallback)')
        // Could dispatch an action to clear clipboard state if needed
      } catch (error) {
        console.error('Failed to clear clipboard history:', error)
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to clear clipboard history: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: {
            operation: 'clear_clipboard_history',
            error: String(error),
          },
        }
        dispatch(addError(detailedError))
      }
    },

    enableAutoRecovery: async () => {
      try {
        // Use new state machine-connected command
        await invoke('enable_auto_recovery_via_state_machine')
        console.log('Auto-recovery enabled via state machine')
      } catch (error) {
        console.error('Failed to enable auto-recovery:', error)
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to enable auto-recovery: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: { operation: 'enable_auto_recovery', error: String(error) },
        }
        dispatch(addError(detailedError))
      }
    },

    disableAutoRecovery: async () => {
      try {
        // Use new state machine-connected command
        await invoke('disable_auto_recovery_via_state_machine')
        console.log('Auto-recovery disabled via state machine')
      } catch (error) {
        console.error('Failed to disable auto-recovery:', error)
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to disable auto-recovery: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: { operation: 'disable_auto_recovery', error: String(error) },
        }
        dispatch(addError(detailedError))
      }
    },

    retryConnection: async () => {
      try {
        // Use new state machine-connected command
        console.log('Retrying backend connection via state machine...')
        await invoke('retry_backend_connection')

        // Re-setup event listeners after backend signals retry
        await setupEventListeners()

        console.log('Backend connection retry completed')
      } catch (error) {
        console.error('Failed to retry connection:', error)
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to retry connection: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: { operation: 'retry_connection', error: String(error) },
        }
        dispatch(addError(detailedError))
      }
    },

    getClipboardHistory: async () => {
      try {
        // Command doesn't exist yet, provide a simple fallback
        console.log('Clipboard history loaded via Redux (fallback - no data)')
        // Return empty history for now
      } catch (error) {
        console.error('Failed to get clipboard history:', error)
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to get clipboard history: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: { operation: 'get_clipboard_history', error: String(error) },
        }
        dispatch(addError(detailedError))
      }
    },
  }
}

// Get current backend state
export const getCurrentBackendState = async () => {
  try {
    return await invoke('get_current_state')
  } catch (error) {
    console.error('Failed to get current backend state:', error)
    throw error
  }
}
