import { useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { useBackendCommands } from '../hooks/useBackendCommands'
import { updateRecordingTime, AppState } from '../store/slices/appSlice'

interface AppStateDemoState {
  appState: AppState
  isRecording: boolean
  formatTime: (ms: number) => string
  getStatusColor: (status: string) => string
  getStatusDisplay: (status: string) => string
  canStartRecording: boolean
  canStopRecording: boolean
  canCancelRecording: boolean
  showProcessingData: boolean
}

interface AppStateDemoActions {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  cancelRecording: () => Promise<void>
  openSettings: () => Promise<void>
  acknowledgeError: () => Promise<void>
  reformatWithProfile: (profileId: string) => Promise<void>
}

export const useAppStateDemoViewModel = () => {
  const dispatch = useAppDispatch()
  const appState = useAppSelector((state) => state.app)
  const backendCommands = useBackendCommands()

  const isRecording = appState.status === 'recording'

  // Update recording time every second when recording
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        dispatch(updateRecordingTime())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isRecording, dispatch])

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string): string => {
    if (status === 'recording') return 'text-red-500'
    if (status.startsWith('processing')) return 'text-blue-500'
    if (status.startsWith('error')) return 'text-red-600'
    if (status === 'processing-complete') return 'text-green-500'
    return 'text-gray-600'
  }

  const getStatusDisplay = (status: string): string => {
    return status
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const canStartRecording =
    appState.status === 'idle' || appState.status === 'processing-complete'
  const canStopRecording = appState.status === 'recording'
  const canCancelRecording = appState.status.startsWith('processing')
  const showProcessingData = Boolean(
    appState.originalTranscript || appState.finalText
  )

  const state: AppStateDemoState = {
    appState,
    isRecording,
    formatTime,
    getStatusColor,
    getStatusDisplay,
    canStartRecording,
    canStopRecording,
    canCancelRecording,
    showProcessingData,
  }

  const actions: AppStateDemoActions = {
    startRecording: backendCommands.startRecording,
    stopRecording: backendCommands.stopRecording,
    cancelRecording: backendCommands.cancelRecording,
    openSettings: backendCommands.openSettings,
    acknowledgeError: backendCommands.acknowledgeError,
    reformatWithProfile: backendCommands.reformatWithProfile,
  }

  const onMount = () => {
    // No initialization needed for this demo component
  }

  return { state, actions, onMount }
}
