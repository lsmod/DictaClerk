import { describe, it, expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { appSlice, AppState, BackendStateEvent } from '../slices/appSlice'
import { AppStateBuilder } from '../testUtils/AppStateBuilder'

// Test store setup
const createTestStore = (initialState?: Partial<AppState>) => {
  return configureStore({
    reducer: {
      app: appSlice.reducer,
    },
    preloadedState: initialState
      ? { app: { ...new AppStateBuilder().build(), ...initialState } }
      : undefined,
  })
}

describe('appSlice', () => {
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = createTestStore()
      const state = store.getState().app

      expect(state.status).toBe('idle')
      expect(state.mainWindowVisible).toBe(true)
      expect(state.hasModalWindow).toBe(false)
      expect(state.recordingStartTime).toBe(null)
      expect(state.recordingTime).toBe(0)
      expect(state.originalTranscript).toBe(null)
      expect(state.finalText).toBe(null)
      expect(state.profileId).toBe(null)
      expect(state.error).toBe(null)
      expect(state.lastBackendSync).toBe(0)
      expect(state.backendConnected).toBe(false)
    })
  })

  describe('backendStateChanged', () => {
    it('should update state from backend idle event', () => {
      const store = createTestStore()
      const backendEvent: BackendStateEvent = {
        previous_state: 'Recording',
        current_state: 'IdleMainWindowVisible',
        event: 'StopRecording',
        timestamp: Date.now(),
        context: {
          is_recording: false,
          is_processing: false,
          main_window_visible: true,
          has_modal_window: false,
        },
      }

      store.dispatch(appSlice.actions.backendStateChanged(backendEvent))
      const state = store.getState().app

      expect(state.status).toBe('idle')
      expect(state.mainWindowVisible).toBe(true)
      expect(state.hasModalWindow).toBe(false)
      expect(state.backendConnected).toBe(true)
      expect(state.lastBackendSync).toBe(backendEvent.timestamp)
    })

    it('should update state from backend recording event', () => {
      const store = createTestStore()
      const backendEvent: BackendStateEvent = {
        previous_state: 'IdleMainWindowVisible',
        current_state: 'Recording',
        event: 'StartRecording',
        timestamp: Date.now(),
        context: {
          is_recording: true,
          is_processing: false,
          main_window_visible: true,
          has_modal_window: false,
        },
      }

      store.dispatch(appSlice.actions.backendStateChanged(backendEvent))
      const state = store.getState().app

      expect(state.status).toBe('recording')
      expect(state.mainWindowVisible).toBe(true)
      expect(state.recordingStartTime).toBeTruthy()
    })

    it('should handle processing states correctly', () => {
      const store = createTestStore()
      const backendEvent: BackendStateEvent = {
        previous_state: 'Recording',
        current_state: 'ProcessingTranscription',
        event: 'StopRecording',
        timestamp: Date.now(),
        context: {
          is_recording: false,
          is_processing: true,
          main_window_visible: true,
          has_modal_window: false,
        },
      }

      store.dispatch(appSlice.actions.backendStateChanged(backendEvent))
      const state = store.getState().app

      expect(state.status).toBe('processing-transcription')
      expect(state.recordingStartTime).toBe(null)
      expect(state.recordingTime).toBe(0)
    })

    it('should handle error states correctly', () => {
      const store = createTestStore()
      const backendEvent: BackendStateEvent = {
        previous_state: 'ProcessingTranscription',
        current_state: 'TranscriptionError',
        event: 'TranscriptionError',
        timestamp: Date.now(),
        context: {
          is_recording: false,
          is_processing: false,
          main_window_visible: true,
          has_modal_window: false,
        },
      }

      store.dispatch(appSlice.actions.backendStateChanged(backendEvent))
      const state = store.getState().app

      expect(state.status).toBe('error-transcription')
      expect(state.mainWindowVisible).toBe(true)
    })

    it('should clear error when transitioning away from error state', () => {
      const initialState = new AppStateBuilder()
        .errorState('transcription')
        .build()

      const store = createTestStore(initialState)

      const backendEvent: BackendStateEvent = {
        previous_state: 'TranscriptionError',
        current_state: 'IdleMainWindowVisible',
        event: 'AcknowledgeError',
        timestamp: Date.now(),
        context: {
          is_recording: false,
          is_processing: false,
          main_window_visible: true,
          has_modal_window: false,
        },
      }

      store.dispatch(appSlice.actions.backendStateChanged(backendEvent))
      const state = store.getState().app

      expect(state.status).toBe('idle')
      expect(state.error).toBe(null)
    })
  })

  describe('updateRecordingTime', () => {
    it('should update recording time when recording', () => {
      const startTime = Date.now() - 5000 // 5 seconds ago
      const initialState = new AppStateBuilder()
        .withRecording(startTime)
        .build()

      const store = createTestStore(initialState)
      store.dispatch(appSlice.actions.updateRecordingTime())

      const state = store.getState().app
      expect(state.recordingTime).toBeGreaterThan(4000) // At least 4 seconds
      expect(state.recordingTime).toBeLessThan(6000) // Less than 6 seconds
    })

    it('should not update recording time when not recording', () => {
      const initialState = new AppStateBuilder().idle().build()

      const store = createTestStore(initialState)
      store.dispatch(appSlice.actions.updateRecordingTime())

      const state = store.getState().app
      expect(state.recordingTime).toBe(0)
    })
  })

  describe('acknowledgeError', () => {
    it('should clear error state and return to idle', () => {
      const initialState = new AppStateBuilder()
        .errorState('gpt-formatting')
        .build()

      const store = createTestStore(initialState)
      store.dispatch(appSlice.actions.acknowledgeError())

      const state = store.getState().app
      expect(state.status).toBe('idle')
      expect(state.error).toBe(null)
    })

    it('should not affect non-error states', () => {
      const initialState = new AppStateBuilder().recording().build()

      const store = createTestStore(initialState)
      store.dispatch(appSlice.actions.acknowledgeError())

      const state = store.getState().app
      expect(state.status).toBe('recording')
    })
  })

  describe('setBackendConnected', () => {
    it('should set backend connected status', () => {
      const store = createTestStore()
      store.dispatch(appSlice.actions.setBackendConnected(true))

      const state = store.getState().app
      expect(state.backendConnected).toBe(true)
    })

    it('should reset state when backend disconnects', () => {
      const initialState = new AppStateBuilder().recording().build()

      const store = createTestStore(initialState)
      store.dispatch(appSlice.actions.setBackendConnected(false))

      const state = store.getState().app
      expect(state.backendConnected).toBe(false)
      expect(state.status).toBe('idle')
      expect(state.recordingStartTime).toBe(null)
      expect(state.recordingTime).toBe(0)
    })
  })

  describe('setProcessingData', () => {
    it('should update processing data fields', () => {
      const store = createTestStore()
      store.dispatch(
        appSlice.actions.setProcessingData({
          originalTranscript: 'Original text',
          finalText: 'Formatted text',
          profileId: 'test-profile',
        })
      )

      const state = store.getState().app
      expect(state.originalTranscript).toBe('Original text')
      expect(state.finalText).toBe('Formatted text')
      expect(state.profileId).toBe('test-profile')
    })

    it('should update only provided fields', () => {
      const initialState = new AppStateBuilder()
        .withTranscript('Existing transcript', 'Existing final')
        .withProfileId('existing-profile')
        .build()

      const store = createTestStore(initialState)
      store.dispatch(
        appSlice.actions.setProcessingData({
          finalText: 'New final text',
        })
      )

      const state = store.getState().app
      expect(state.originalTranscript).toBe('Existing transcript')
      expect(state.finalText).toBe('New final text')
      expect(state.profileId).toBe('existing-profile')
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const store = createTestStore()
      store.dispatch(appSlice.actions.setError('Test error message'))

      const state = store.getState().app
      expect(state.error).toBe('Test error message')
    })
  })
})

describe('AppStateBuilder', () => {
  describe('fluent interface', () => {
    it('should build idle state correctly', () => {
      const state = new AppStateBuilder().idle().build()

      expect(state.status).toBe('idle')
      expect(state.mainWindowVisible).toBe(true)
      expect(state.hasModalWindow).toBe(false)
      expect(state.backendConnected).toBe(true)
    })

    it('should build recording state correctly', () => {
      const state = new AppStateBuilder().recording().build()

      expect(state.status).toBe('recording')
      expect(state.recordingStartTime).toBeTruthy()
      expect(state.recordingTime).toBeGreaterThan(0)
      expect(state.mainWindowVisible).toBe(true)
    })

    it('should build processing complete state correctly', () => {
      const state = new AppStateBuilder()
        .processingComplete('Test transcript', 'Formatted text')
        .build()

      expect(state.status).toBe('processing-complete')
      expect(state.originalTranscript).toBe('Test transcript')
      expect(state.finalText).toBe('Formatted text')
      expect(state.profileId).toBe('test-profile')
    })

    it('should build error state correctly', () => {
      const state = new AppStateBuilder().errorState('clipboard').build()

      expect(state.status).toBe('error-clipboard')
      expect(state.error).toBe('Test clipboard error')
      expect(state.mainWindowVisible).toBe(true)
    })

    it('should build disconnected state correctly', () => {
      const state = new AppStateBuilder().disconnected().build()

      expect(state.backendConnected).toBe(false)
      expect(state.lastBackendSync).toBeLessThan(Date.now() - 25000) // More than 25 seconds ago
    })

    it('should chain methods correctly', () => {
      const state = new AppStateBuilder()
        .withStatus('processing-gpt-formatting')
        .withTranscript('Original', 'Final')
        .withProfileId('custom-profile')
        .withWindowState(false, true)
        .withBackendSync(12345, true)
        .build()

      expect(state.status).toBe('processing-gpt-formatting')
      expect(state.originalTranscript).toBe('Original')
      expect(state.finalText).toBe('Final')
      expect(state.profileId).toBe('custom-profile')
      expect(state.mainWindowVisible).toBe(false)
      expect(state.hasModalWindow).toBe(true)
      expect(state.lastBackendSync).toBe(12345)
      expect(state.backendConnected).toBe(true)
    })

    it('should return immutable copies', () => {
      const builder = new AppStateBuilder()
      const state1 = builder.withStatus('recording').build()
      const state2 = builder.withStatus('idle').build()

      expect(state1.status).toBe('recording')
      expect(state2.status).toBe('idle')
      expect(state1).not.toBe(state2)
    })
  })
})
