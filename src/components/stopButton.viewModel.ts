import { useAppSelector } from '../store/hooks'
import { useBackendCommands } from '../hooks/useBackendCommands'

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
    // Prevent action if already processing
    if (isProcessing) return

    try {
      if (isRecording) {
        await stopRecording()
        announceRecordingState(false)
      } else {
        await startRecording()
        announceRecordingState(true)
      }
    } catch (error) {
      console.error('Failed to toggle recording:', error)
      announceError('Failed to toggle recording')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isProcessing) return // Prevent keyboard action during processing

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
    // No initialization needed for this component
  }

  return { state, actions, onMount }
}
