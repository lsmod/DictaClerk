import { expect } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import { appSlice, AppState } from '../../slices/appSlice'
import { AppStateBuilder } from '../../testUtils/AppStateBuilder'

// Test store configuration
export interface TestStoreConfig {
  initialState?: Partial<AppState>
  enableLogging?: boolean
}

// Create enhanced test store
export const createTestStore = (config: TestStoreConfig = {}) => {
  const { initialState, enableLogging = false } = config

  const store = configureStore({
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

  if (enableLogging) {
    const originalDispatch = store.dispatch
    store.dispatch = (action) => {
      console.log('Dispatching:', action.type, action.payload)
      const result = originalDispatch(action)
      console.log('New state:', store.getState())
      return result
    }
  }

  return store
}

// Test data factories
export const createMockBackendEvent = (overrides: Partial<any> = {}) => ({
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
  ...overrides,
})

export const createMockProfile = (overrides: Partial<any> = {}) => ({
  id: 'test-profile',
  name: 'Test Profile',
  description: 'Test profile description',
  prompt: 'Test prompt',
  active: true,
  visible: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

export const createMockError = (overrides: Partial<any> = {}) => ({
  type: 'transcription' as const,
  message: 'Test error message',
  recoverable: true,
  timestamp: Date.now(),
  context: { test: true },
  ...overrides,
})

// State assertion helpers
export const expectIdleState = (state: AppState) => {
  expect(state.status).toBe('idle')
  expect(state.recordingStartTime).toBe(null)
  expect(state.recordingTime).toBe(0)
  expect(state.error).toBe(null)
}

export const expectRecordingState = (state: AppState) => {
  expect(state.status).toBe('recording')
  expect(state.recordingStartTime).not.toBe(null)
  expect(state.mainWindowVisible).toBe(true)
}

export const expectProcessingState = (state: AppState, stage: string) => {
  expect(state.status).toBe(`processing-${stage}`)
  expect(state.recordingStartTime).toBe(null)
  expect(state.mainWindowVisible).toBe(true)
}

export const expectErrorState = (state: AppState, errorType: string) => {
  expect(state.status).toBe(`error-${errorType}`)
  expect(state.error).not.toBe(null)
  expect(state.mainWindowVisible).toBe(true)
}

// Performance testing utilities
export const measureActionTime = async (
  action: () => void,
  iterations = 100
): Promise<{ average: number; min: number; max: number }> => {
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    action()
    const end = performance.now()
    times.push(end - start)
  }

  return {
    average: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  }
}

// Stress testing helpers
export const stressTestStateTransitions = (
  store: ReturnType<typeof createTestStore>,
  transitions: Array<{ type: string; payload?: any }>,
  iterations = 1000
) => {
  const startTime = performance.now()

  for (let i = 0; i < iterations; i++) {
    transitions.forEach((transition) => {
      store.dispatch(transition)
    })
  }

  const endTime = performance.now()
  const totalActions = iterations * transitions.length

  return {
    totalTime: endTime - startTime,
    averageTimePerAction: (endTime - startTime) / totalActions,
    actionsPerSecond: totalActions / ((endTime - startTime) / 1000),
    memoryUsage: process.memoryUsage?.() || null,
  }
}
