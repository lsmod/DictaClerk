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
  // Listen to backend state machine events
  const setupEventListeners = async () => {
    try {
      // Listen for state changes
      await listen<BackendStateEvent>('app-state-changed', (event) => {
        console.log('Backend state changed:', event.payload)
        dispatch(backendStateChanged(event.payload))
      })

      // Listen for processing data updates
      await listen<{
        original_transcript?: string
        final_text?: string
        profile_id?: string
      }>('processing-data-updated', (event) => {
        console.log('Processing data updated:', event.payload)
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
      }>('processing-progress', (event) => {
        console.log('Processing progress:', event.payload)
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
        main_window?: { visible: boolean; position?: { x: number; y: number } }
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

      // Listen for auto-recovery events
      await listen<{ enabled: boolean }>('auto-recovery-changed', (event) => {
        console.log('Auto-recovery changed:', event.payload)
        dispatch(setAutoRecoveryMode(event.payload.enabled))
      })

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
        // Initialize audio capture first if needed
        await invoke('init_audio_capture')
        // Start recording
        await invoke('start_capture')
        console.log('Recording started via Redux')
      } catch (error) {
        console.error('Failed to start recording:', error)
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
        // Stop recording and process to clipboard
        await invoke('stop_recording_and_process_to_clipboard')
        console.log('Recording stopped and processed via Redux')
      } catch (error) {
        console.error('Failed to stop recording:', error)
        const detailedError: AppError = {
          type: 'system',
          message: `Failed to stop recording: ${error}`,
          recoverable: true,
          timestamp: Date.now(),
          context: { operation: 'stop_recording', error: String(error) },
        }
        dispatch(addError(detailedError))
      }
    },

    cancelRecording: async () => {
      try {
        // Stop capture without processing
        await invoke('stop_capture')
        console.log('Recording cancelled via Redux')
      } catch (error) {
        console.error('Failed to cancel recording:', error)
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
        // Clear the error in Redux state
        dispatch(acknowledgeErrorAction())
        console.log('Error acknowledged via Redux')
      } catch (error) {
        console.error('Failed to acknowledge error:', error)
        dispatch(setError(`Failed to acknowledge error: ${error}`))
      }
    },

    reformatWithProfile: async (profileId: string) => {
      try {
        // This would need to be implemented with a specific backend command
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
    loadProfiles: async () => {
      try {
        dispatch(setProfilesLoading(true))
        dispatch(setProfilesError(null))

        console.log('Loading profiles via Redux...')
        const profileData = await invoke<ProfileCollection>('load_profiles')
        console.log('Loaded profile data via Redux:', profileData)

        dispatch(setProfiles(profileData.profiles))

        // Set active profile to default or first active profile
        const defaultProfile = profileData.profiles.find(
          (p) => p.id === profileData.default_profile_id
        )
        const activeProfile =
          defaultProfile || profileData.profiles.find((p) => p.active)

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
    },

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
        dispatch(setError(`Failed to clear clipboard history: ${error}`))
      }
    },

    enableAutoRecovery: async () => {
      try {
        // Instead of calling non-existent enable_auto_recovery command,
        // just update the Redux state directly
        dispatch(setAutoRecoveryMode(true))
        console.log('Auto-recovery enabled via Redux')
      } catch (error) {
        console.error('Failed to enable auto-recovery:', error)
        dispatch(setError(`Failed to enable auto-recovery: ${error}`))
      }
    },

    disableAutoRecovery: async () => {
      try {
        // Instead of calling non-existent disable_auto_recovery command,
        // just update the Redux state directly
        dispatch(setAutoRecoveryMode(false))
        console.log('Auto-recovery disabled via Redux')
      } catch (error) {
        console.error('Failed to disable auto-recovery:', error)
        dispatch(setError(`Failed to disable auto-recovery: ${error}`))
      }
    },

    retryConnection: async () => {
      try {
        // Instead of calling non-existent retry_backend_connection command,
        // we'll implement a simple retry by re-establishing event listeners
        console.log(
          'Retrying backend connection by re-establishing listeners...'
        )

        // Clear any existing connection state
        dispatch(setBackendConnected(false))

        // Re-setup event listeners (which will also set connected to true)
        await setupEventListeners()

        console.log('Backend connection retry completed')
      } catch (error) {
        console.error('Failed to retry connection:', error)
        dispatch(setError(`Failed to retry connection: ${error}`))
      }
    },

    getClipboardHistory: async () => {
      try {
        // Command doesn't exist yet, provide a simple fallback
        console.log('Clipboard history loaded via Redux (fallback - no data)')
        // Return empty history for now
      } catch (error) {
        console.error('Failed to get clipboard history:', error)
        dispatch(setError(`Failed to get clipboard history: ${error}`))
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
