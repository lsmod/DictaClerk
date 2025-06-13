import { useEffect } from 'react'
import { useAppSelector } from '../store/hooks'
import { useBackendCommands } from '../hooks/useBackendCommands'
import { listen } from '@tauri-apps/api/event'

interface StopButtonState {
  status: string
  isRecording: boolean
  isProcessing: boolean
  buttonState: 'processing' | 'recording' | 'ready'
  ariaLabel: string
  tooltipContent: string
  disabled: boolean
}

interface StopButtonActions {
  toggleRecording: () => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent) => void
}

export const useStopButtonViewModel = () => {
  const { status } = useAppSelector((state) => state.app)
  const { startRecording, stopRecording } = useBackendCommands()

  const isRecording = status === 'recording'
  const isProcessing = status.startsWith('processing')

  // Listen to state machine events for better synchronization
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupStateListener = async () => {
      try {
        unlisten = await listen('app-state-changed', (event) => {
          console.log('Stop button received state change:', event.payload)
          // The state change will trigger re-render via Redux store update
          // This ensures button state is synchronized with backend state machine
        })
      } catch (error) {
        console.error('Failed to set up state change listener:', error)
      }
    }

    setupStateListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [])

  // Debug logging for button state changes
  useEffect(() => {
    console.log('Stop button state update:', {
      reduxStatus: status,
      isRecording,
      isProcessing,
      buttonState: getButtonState(),
    })
  }, [status, isRecording, isProcessing])

  const announceRecordingState = (recording: boolean) => {
    const liveRegion = document.getElementById('main-live-region')
    if (liveRegion) {
      liveRegion.textContent = recording
        ? 'Recording started'
        : 'Recording stopped'
      setTimeout(() => {
        liveRegion.textContent = ''
      }, 1500)
    }
  }

  const announceError = (message: string) => {
    const liveRegion = document.getElementById('main-live-region')
    if (liveRegion) {
      liveRegion.textContent = message
      setTimeout(() => {
        liveRegion.textContent = ''
      }, 2000)
    }
  }

  const handleToggle = async () => {
    console.log('🔘 [STOP-BUTTON] handleToggle called')
    console.log('🔍 [STOP-BUTTON] Current state check:', {
      status,
      isRecording,
      isProcessing,
      disabled: isProcessing,
    })

    // Prevent action if already processing
    if (isProcessing) {
      console.log(
        '🚫 [STOP-BUTTON] Toggle recording blocked - currently processing'
      )
      return
    }

    try {
      console.log('🎛️ [STOP-BUTTON] Proceeding with toggle recording:', {
        currentState: status,
        isRecording,
        action: isRecording ? 'STOP' : 'START',
      })

      if (isRecording) {
        console.log('🛑 [STOP-BUTTON] Calling stopRecording()...')
        console.log('🕒 [STOP-BUTTON] Timestamp:', new Date().toISOString())
        console.time('stop-recording-duration')

        await stopRecording()

        console.timeEnd('stop-recording-duration')
        console.log('✅ [STOP-BUTTON] stopRecording() completed successfully')
        console.log('🔔 [STOP-BUTTON] About to announce recording state change')
        announceRecordingState(false)
      } else {
        console.log('🎙️ [STOP-BUTTON] Calling startRecording()...')
        console.log('🕒 [STOP-BUTTON] Timestamp:', new Date().toISOString())
        console.time('start-recording-duration')

        await startRecording()

        console.timeEnd('start-recording-duration')
        console.log('✅ [STOP-BUTTON] startRecording() completed successfully')
        console.log('🔔 [STOP-BUTTON] About to announce recording state change')
        announceRecordingState(true)
      }

      console.log('🎉 [STOP-BUTTON] Toggle recording completed successfully')
    } catch (error) {
      console.error('❌ [STOP-BUTTON] Failed to toggle recording:', error)
      console.error('❌ [STOP-BUTTON] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        error: String(error),
      })
      announceError('Failed to toggle recording')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isProcessing) {
      console.log('Keyboard action blocked - currently processing')
      return // Prevent keyboard action during processing
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }

  const getButtonState = (): 'processing' | 'recording' | 'ready' => {
    if (isProcessing) return 'processing'
    if (isRecording) return 'recording'
    return 'ready'
  }

  const getAriaLabel = (): string => {
    if (isProcessing) return 'Processing recording...'
    return isRecording ? 'Stop recording' : 'Start recording'
  }

  const getTooltipContent = (): string => {
    if (isProcessing) return 'Processing...'
    return isRecording ? 'Stop recording' : 'Start recording'
  }

  const state: StopButtonState = {
    status,
    isRecording,
    isProcessing,
    buttonState: getButtonState(),
    ariaLabel: getAriaLabel(),
    tooltipContent: getTooltipContent(),
    disabled: isProcessing,
  }

  const actions: StopButtonActions = {
    toggleRecording: handleToggle,
    handleKeyDown,
  }

  const onMount = () => {
    console.log('Stop button mounted with initial state:', {
      status,
      isRecording,
      isProcessing,
      buttonState: getButtonState(),
    })
  }

  return { state, actions, onMount }
}
