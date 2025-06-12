import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { AppDispatch } from './store'
import {
  backendStateChanged,
  setBackendConnected,
  setProcessingData,
  setError,
  BackendStateEvent,
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

      // Listen for errors
      await listen<{ error: string }>('app-error', (event) => {
        console.log('Backend error:', event.payload)
        dispatch(setError(event.payload.error))
      })

      dispatch(setBackendConnected(true))
      console.log('Backend event listeners setup successfully')
    } catch (error) {
      console.error('Failed to setup backend event listeners:', error)
      dispatch(setBackendConnected(false))
    }
  }

  // Initialize event listeners
  setupEventListeners()

  // Return command interface for sending events to backend
  return {
    startRecording: async () => {
      try {
        await invoke('state_machine_event', {
          event: 'StartRecording',
        })
      } catch (error) {
        console.error('Failed to start recording:', error)
        dispatch(setError(`Failed to start recording: ${error}`))
      }
    },

    stopRecording: async () => {
      try {
        await invoke('state_machine_event', {
          event: 'StopRecording',
        })
      } catch (error) {
        console.error('Failed to stop recording:', error)
        dispatch(setError(`Failed to stop recording: ${error}`))
      }
    },

    cancelRecording: async () => {
      try {
        await invoke('state_machine_event', {
          event: 'CancelRecording',
        })
      } catch (error) {
        console.error('Failed to cancel recording:', error)
        dispatch(setError(`Failed to cancel recording: ${error}`))
      }
    },

    openSettings: async () => {
      try {
        await invoke('state_machine_event', {
          event: 'OpenSettingsWindow',
        })
      } catch (error) {
        console.error('Failed to open settings:', error)
        dispatch(setError(`Failed to open settings: ${error}`))
      }
    },

    closeSettings: async () => {
      try {
        await invoke('state_machine_event', {
          event: 'CloseSettingsWindow',
        })
      } catch (error) {
        console.error('Failed to close settings:', error)
        dispatch(setError(`Failed to close settings: ${error}`))
      }
    },

    acknowledgeError: async () => {
      try {
        await invoke('state_machine_event', {
          event: 'AcknowledgeError',
        })
      } catch (error) {
        console.error('Failed to acknowledge error:', error)
        dispatch(setError(`Failed to acknowledge error: ${error}`))
      }
    },

    reformatWithProfile: async (profileId: string) => {
      try {
        await invoke('state_machine_event', {
          event: {
            ReformatWithProfile: { profile_id: profileId },
          },
        })
      } catch (error) {
        console.error('Failed to reformat with profile:', error)
        dispatch(setError(`Failed to reformat with profile: ${error}`))
      }
    },

    showMainWindow: async () => {
      try {
        await invoke('state_machine_event', {
          event: 'ShowMainWindow',
        })
      } catch (error) {
        console.error('Failed to show main window:', error)
        dispatch(setError(`Failed to show main window: ${error}`))
      }
    },

    hideMainWindow: async () => {
      try {
        await invoke('state_machine_event', {
          event: 'HideMainWindow',
        })
      } catch (error) {
        console.error('Failed to hide main window:', error)
        dispatch(setError(`Failed to hide main window: ${error}`))
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
