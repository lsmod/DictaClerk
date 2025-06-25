import { describe, it, expect } from 'vitest'
import { appSlice, BackendStateEvent } from '../slices/appSlice'
import { createTestStore } from './utils/testStore'

describe('Redux State Management Integration', () => {
  describe('Complex State Transitions', () => {
    it('should handle complete recording workflow with state persistence', () => {
      const store = createTestStore()
      const baseTime = Date.now()

      // 1. Start recording
      const recordingEvent: BackendStateEvent = {
        previous_state: 'IdleMainWindowVisible',
        current_state: 'Recording',
        event: 'StartRecording',
        timestamp: baseTime,
        context: {
          is_recording: true,
          is_processing: false,
          main_window_visible: true,
          has_modal_window: false,
        },
      }

      store.dispatch(appSlice.actions.backendStateChanged(recordingEvent))

      let state = store.getState().app
      expect(state.status).toBe('recording')
      expect(state.recordingStartTime).toBeTruthy()
      expect(state.backendConnected).toBe(true)

      // 2. Process transcription
      store.dispatch(
        appSlice.actions.backendStateChanged({
          previous_state: 'Recording',
          current_state: 'ProcessingTranscription',
          event: 'StopRecording',
          timestamp: baseTime + 1000,
          context: {
            is_recording: false,
            is_processing: true,
            main_window_visible: true,
            has_modal_window: false,
          },
        })
      )

      state = store.getState().app
      expect(state.status).toBe('processing-transcription')
      expect(state.recordingStartTime).toBe(null)
      expect(state.recordingTime).toBe(0)

      // 3. Set processing data
      store.dispatch(
        appSlice.actions.setProcessingData({
          originalTranscript: 'Hello world test',
          finalText: null,
          profileId: 'test-profile',
        })
      )

      // 4. Process GPT formatting
      store.dispatch(
        appSlice.actions.backendStateChanged({
          previous_state: 'ProcessingTranscription',
          current_state: 'ProcessingGPTFormatting',
          event: 'TranscriptionComplete',
          timestamp: baseTime + 2000,
          context: {
            is_recording: false,
            is_processing: true,
            main_window_visible: true,
            has_modal_window: false,
          },
        })
      )

      state = store.getState().app
      expect(state.status).toBe('processing-gpt-formatting')
      expect(state.originalTranscript).toBe('Hello world test')
      expect(state.profileId).toBe('test-profile')

      // 5. Complete processing
      store.dispatch(
        appSlice.actions.setProcessingData({
          originalTranscript: 'Hello world test',
          finalText: 'Hello world, test.',
          profileId: 'test-profile',
        })
      )

      store.dispatch(
        appSlice.actions.backendStateChanged({
          previous_state: 'ProcessingGPTFormatting',
          current_state: 'ProcessingComplete',
          event: 'GPTFormattingComplete',
          timestamp: baseTime + 3000,
          context: {
            is_recording: false,
            is_processing: false,
            main_window_visible: true,
            has_modal_window: false,
          },
        })
      )

      state = store.getState().app
      expect(state.status).toBe('processing-complete')
      expect(state.originalTranscript).toBe('Hello world test')
      expect(state.finalText).toBe('Hello world, test.')
      expect(state.profileId).toBe('test-profile')

      // 6. Return to idle
      store.dispatch(
        appSlice.actions.backendStateChanged({
          previous_state: 'ProcessingComplete',
          current_state: 'IdleMainWindowVisible',
          event: 'Complete',
          timestamp: baseTime + 4000,
          context: {
            is_recording: false,
            is_processing: false,
            main_window_visible: true,
            has_modal_window: false,
          },
        })
      )

      state = store.getState().app
      expect(state.status).toBe('idle')
      expect(state.backendConnected).toBe(true)
    })

    it('should handle error recovery workflow with proper state cleanup', () => {
      const store = createTestStore()

      // Start with recording state
      store.dispatch(
        appSlice.actions.backendStateChanged({
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
        })
      )

      // Set some processing data
      store.dispatch(
        appSlice.actions.setProcessingData({
          originalTranscript: 'Test transcript',
          finalText: null,
          profileId: 'test-profile',
        })
      )

      // Encounter error
      store.dispatch(
        appSlice.actions.backendStateChanged({
          previous_state: 'Recording',
          current_state: 'TranscriptionError',
          event: 'TranscriptionError',
          timestamp: Date.now(),
          context: {
            is_recording: false,
            is_processing: false,
            main_window_visible: true,
            has_modal_window: false,
          },
        })
      )

      store.dispatch(appSlice.actions.setError('Transcription failed'))

      let state = store.getState().app
      expect(state.status).toBe('error-transcription')
      expect(state.error).toBe('Transcription failed')
      expect(state.originalTranscript).toBe('Test transcript')

      // Acknowledge error - should clean up all state
      store.dispatch(appSlice.actions.acknowledgeError())

      state = store.getState().app
      expect(state.status).toBe('idle')
      expect(state.error).toBe(null)
      expect(state.originalTranscript).toBe(null)
      expect(state.finalText).toBe(null)
      expect(state.profileId).toBe(null)
      expect(state.processingProgress).toBe(null)
    })
  })

  describe('Profile Management Integration', () => {
    it('should integrate profile loading with state management', () => {
      const store = createTestStore()

      // Start loading
      store.dispatch(appSlice.actions.setProfilesLoading(true))

      let state = store.getState().app
      expect(state.profilesLoading).toBe(true)
      expect(state.profilesError).toBe(null)

      // Load profiles
      const profiles = [
        {
          id: '1',
          name: 'Clipboard',
          active: true,
          visible: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Custom Profile',
          active: true,
          visible: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ]

      store.dispatch(appSlice.actions.setProfiles(profiles))
      store.dispatch(appSlice.actions.setActiveProfile('1'))
      store.dispatch(appSlice.actions.setProfilesLoading(false))

      state = store.getState().app
      expect(state.profiles).toHaveLength(2)
      expect(state.activeProfileId).toBe('1')
      expect(state.profilesLoading).toBe(false)
      expect(state.profilesError).toBe(null)
    })

    it('should handle profile selection with state updates', () => {
      const store = createTestStore()

      // Set up initial profiles
      const profiles = [
        {
          id: '1',
          name: 'Clipboard',
          active: true,
          visible: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Custom Profile',
          active: true,
          visible: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ]

      store.dispatch(appSlice.actions.setProfiles(profiles))
      store.dispatch(appSlice.actions.setActiveProfile('1'))

      // Select different profile
      store.dispatch(appSlice.actions.profileSelected({ profile_id: '2' }))

      const state = store.getState().app
      expect(state.activeProfileId).toBe('2')
    })
  })

  describe('Enhanced Error Handling Integration', () => {
    it('should integrate enhanced error handling with state management', () => {
      const store = createTestStore()

      const detailedError = {
        type: 'transcription' as const,
        message: 'Audio processing failed',
        recoverable: true,
        timestamp: Date.now(),
        context: { audio_duration: 30, file_size: 1024 },
      }

      // Add detailed error
      store.dispatch(appSlice.actions.addError(detailedError))

      let state = store.getState().app
      expect(state.errors).toHaveLength(1)
      expect(state.lastError).toEqual(detailedError)

      // Add another error
      const secondError = {
        type: 'gpt-formatting' as const,
        message: 'GPT API error',
        recoverable: false,
        timestamp: Date.now() + 1000,
        context: { api_response: 'timeout' },
      }

      store.dispatch(appSlice.actions.addError(secondError))

      state = store.getState().app
      expect(state.errors).toHaveLength(2)
      expect(state.lastError).toEqual(secondError)

      // Remove first error
      store.dispatch(appSlice.actions.removeError(0))

      state = store.getState().app
      expect(state.errors).toHaveLength(1)
      expect(state.errors[0]).toEqual(secondError)

      // Clear all errors
      store.dispatch(appSlice.actions.clearErrors())

      state = store.getState().app
      expect(state.errors).toHaveLength(0)
      expect(state.lastError).toBe(null)
      expect(state.error).toBe(null)
    })
  })

  describe('Clipboard Integration', () => {
    it('should integrate clipboard updates with state management', () => {
      const store = createTestStore()

      // Update clipboard
      store.dispatch(
        appSlice.actions.updateClipboard({
          text: 'Hello world',
          profileId: 'test-profile',
        })
      )

      let state = store.getState().app
      expect(state.clipboard.lastCopiedText).toBe('Hello world')
      expect(state.clipboard.lastCopiedAt).toBeTruthy()
      expect(state.clipboard.copyHistory).toHaveLength(1)
      expect(state.clipboard.copyHistory[0].text).toBe('Hello world')
      expect(state.clipboard.copyHistory[0].profileId).toBe('test-profile')

      // Add more entries
      for (let i = 1; i <= 12; i++) {
        store.dispatch(
          appSlice.actions.updateClipboard({
            text: `Text ${i}`,
            profileId: `profile-${i}`,
          })
        )
      }

      state = store.getState().app
      // Should only keep last 10 entries
      expect(state.clipboard.copyHistory).toHaveLength(10)
      expect(state.clipboard.copyHistory[0].text).toBe('Text 12')
      expect(state.clipboard.copyHistory[9].text).toBe('Text 3')

      // Clear history
      store.dispatch(appSlice.actions.clearClipboardHistory())

      state = store.getState().app
      expect(state.clipboard.copyHistory).toHaveLength(0)
    })
  })

  describe('State Consistency Under Stress', () => {
    it('should maintain consistency under rapid state changes', () => {
      const store = createTestStore()
      const iterations = 1000

      // Rapid state transitions
      for (let i = 0; i < iterations; i++) {
        const isRecording = i % 2 === 0
        store.dispatch(
          appSlice.actions.backendStateChanged({
            previous_state: isRecording ? 'IdleMainWindowVisible' : 'Recording',
            current_state: isRecording ? 'Recording' : 'IdleMainWindowVisible',
            event: isRecording ? 'StartRecording' : 'StopRecording',
            timestamp: Date.now() + i,
            context: {
              is_recording: isRecording,
              is_processing: false,
              main_window_visible: true,
              has_modal_window: false,
            },
          })
        )
      }

      const state = store.getState().app
      expect(state.status).toBe('idle') // Should be idle after even number of iterations
      expect(state.backendConnected).toBe(true)
      expect(state.lastBackendSync).toBeGreaterThan(Date.now())
    })

    it('should handle concurrent profile and state updates', () => {
      const store = createTestStore()

      // Set up profiles
      const profiles = []
      for (let i = 1; i <= 100; i++) {
        profiles.push({
          id: `profile-${i}`,
          name: `Profile ${i}`,
          active: i <= 50,
          visible: i <= 50,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        })
      }

      store.dispatch(appSlice.actions.setProfiles(profiles))

      // Rapid profile selections
      for (let i = 1; i <= 50; i++) {
        store.dispatch(appSlice.actions.setActiveProfile(`profile-${i}`))
      }

      const state = store.getState().app
      expect(state.profiles).toHaveLength(100)
      expect(state.activeProfileId).toBe('profile-50')
    })
  })
})
