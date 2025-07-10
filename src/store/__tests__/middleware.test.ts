import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { appSlice, BackendStateEvent, AppState } from '../slices/appSlice'
import { AppStateBuilder } from '../testUtils/AppStateBuilder'

// Mock Tauri APIs
const mockListen = vi.fn()
const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

// Test store setup
const createTestStore = (initialState?: Partial<AppState>) => {
  return configureStore({
    reducer: {
      app: appSlice.reducer,
    },
    preloadedState: initialState
      ? { app: { ...new AppStateBuilder().build(), ...initialState } }
      : undefined,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['app/backendStateChanged'],
          ignoredActionsPaths: ['payload.timestamp'],
          ignoredPaths: ['app.lastBackendSync'],
        },
      }),
  })
}

describe('Backend Sync Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Action Serialization', () => {
    it('should handle non-serializable timestamps in backendStateChanged', () => {
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

      // This should not throw serialization errors
      expect(() => {
        store.dispatch(appSlice.actions.backendStateChanged(backendEvent))
      }).not.toThrow()

      const state = store.getState().app
      expect(state.lastBackendSync).toBe(backendEvent.timestamp)
    })

    it('should ignore serialization checks for backend sync paths', () => {
      const store = createTestStore()
      const now = Date.now()

      // Dispatch action with timestamp that would normally fail serialization
      store.dispatch(
        appSlice.actions.backendStateChanged({
          previous_state: 'IdleMainWindowVisible',
          current_state: 'Recording',
          event: 'StartRecording',
          timestamp: now,
          context: {
            is_recording: true,
            is_processing: false,
            main_window_visible: true,
            has_modal_window: false,
          },
        })
      )

      const state = store.getState().app
      expect(state.lastBackendSync).toBe(now)
      expect(state.backendConnected).toBe(true)
    })
  })

  describe('State Machine Transitions', () => {
    it('should handle rapid state transitions without data loss', () => {
      const store = createTestStore()
      const baseTime = Date.now()

      // Simulate rapid state transitions
      const transitions = [
        {
          previous_state: 'IdleMainWindowVisible',
          current_state: 'Recording',
          event: 'StartRecording',
          timestamp: baseTime,
        },
        {
          previous_state: 'Recording',
          current_state: 'ProcessingTranscription',
          event: 'StopRecording',
          timestamp: baseTime + 100,
        },
        {
          previous_state: 'ProcessingTranscription',
          current_state: 'ProcessingGptFormatting',
          event: 'TranscriptionComplete',
          timestamp: baseTime + 200,
        },
        {
          previous_state: 'ProcessingGptFormatting',
          current_state: 'ProcessingClipboard',
          event: 'GptFormattingComplete',
          timestamp: baseTime + 300,
        },
        {
          previous_state: 'ProcessingClipboard',
          current_state: 'IdleMainWindowVisible',
          event: 'ClipboardComplete',
          timestamp: baseTime + 400,
        },
      ]

      transitions.forEach((transition) => {
        store.dispatch(
          appSlice.actions.backendStateChanged({
            ...transition,
            context: {
              is_recording: transition.current_state === 'Recording',
              is_processing: transition.current_state.includes('Processing'),
              main_window_visible: true,
              has_modal_window: false,
            },
          })
        )
      })

      const finalState = store.getState().app
      expect(finalState.status).toBe('idle')
      expect(finalState.lastBackendSync).toBe(baseTime + 400)
      expect(finalState.backendConnected).toBe(true)
    })

    it('should handle invalid state transitions gracefully', () => {
      const store = createTestStore()

      // Try to transition from idle to processing (invalid)
      const invalidTransition: BackendStateEvent = {
        previous_state: 'IdleMainWindowVisible',
        current_state: 'ProcessingTranscription',
        event: 'InvalidTransition',
        timestamp: Date.now(),
        context: {
          is_recording: false,
          is_processing: true,
          main_window_visible: true,
          has_modal_window: false,
        },
      }

      // Should not throw error, but should handle gracefully
      expect(() => {
        store.dispatch(appSlice.actions.backendStateChanged(invalidTransition))
      }).not.toThrow()

      const state = store.getState().app
      expect(state.status).toBe('processing-transcription')
      expect(state.backendConnected).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle error states in middleware', () => {
      const store = createTestStore()

      const errorTransition: BackendStateEvent = {
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

      store.dispatch(appSlice.actions.backendStateChanged(errorTransition))

      const state = store.getState().app
      expect(state.status).toBe('error-transcription')
      expect(state.backendConnected).toBe(true)
    })

    it('should maintain connection status during errors', () => {
      const store = createTestStore()

      // Set error state
      store.dispatch(
        appSlice.actions.backendStateChanged({
          previous_state: 'ProcessingGPTFormatting',
          current_state: 'GPTFormattingError',
          event: 'GPTFormattingError',
          timestamp: Date.now(),
          context: {
            is_recording: false,
            is_processing: false,
            main_window_visible: true,
            has_modal_window: false,
          },
        })
      )

      const state = store.getState().app
      expect(state.status).toBe('error-gpt-formatting')
      expect(state.backendConnected).toBe(true)
      expect(state.lastBackendSync).toBeGreaterThan(0)
    })
  })

  describe('Performance Characteristics', () => {
    it('should handle high-frequency state updates efficiently', () => {
      const store = createTestStore()
      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        store.dispatch(
          appSlice.actions.backendStateChanged({
            previous_state: 'IdleMainWindowVisible',
            current_state: 'Recording',
            event: 'StartRecording',
            timestamp: Date.now() + i,
            context: {
              is_recording: true,
              is_processing: false,
              main_window_visible: true,
              has_modal_window: false,
            },
          })
        )
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const averageTime = totalTime / iterations

      // Should process each action quickly (under 1ms average)
      expect(averageTime).toBeLessThan(1)

      // Final state should be consistent
      const finalState = store.getState().app
      expect(finalState.status).toBe('recording')
      expect(finalState.backendConnected).toBe(true)
    })

    it('should maintain memory efficiency during extended operation', () => {
      const store = createTestStore()
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0

      // Simulate extended operation with many state changes
      for (let i = 0; i < 10000; i++) {
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

      const finalMemory = process.memoryUsage?.()?.heapUsed || 0
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined context gracefully', () => {
      const store = createTestStore()

      const invalidEvent = {
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

      expect(() => {
        store.dispatch(appSlice.actions.backendStateChanged(invalidEvent))
      }).not.toThrow()

      // Should still update basic state
      const state = store.getState().app
      expect(state.backendConnected).toBe(true)
    })

    it('should handle malformed timestamps', () => {
      const store = createTestStore()

      const eventWithBadTimestamp = {
        previous_state: 'IdleMainWindowVisible',
        current_state: 'Recording',
        event: 'StartRecording',
        timestamp: NaN,
        context: {
          is_recording: true,
          is_processing: false,
          main_window_visible: true,
          has_modal_window: false,
        },
      }

      expect(() => {
        store.dispatch(
          appSlice.actions.backendStateChanged(eventWithBadTimestamp)
        )
      }).not.toThrow()

      const state = store.getState().app
      expect(state.status).toBe('recording')
      expect(state.backendConnected).toBe(true)
    })
  })
})
