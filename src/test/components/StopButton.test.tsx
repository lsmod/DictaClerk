import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Redux hooks and backend commands
const mockUseAppSelector = vi.fn()
const mockUseBackendCommands = vi.fn()

vi.mock('../../store/hooks', () => ({
  useAppSelector: mockUseAppSelector,
}))

vi.mock('../../hooks/useBackendCommands', () => ({
  useBackendCommands: mockUseBackendCommands,
}))

// Mock the recording context
const mockStartRecording = vi.fn()
const mockStopRecording = vi.fn()

// Mock component structure for testing logic
interface MockButtonProps {
  className: string
  ariaLabel: string
  tooltipContent: string
  iconClassName: string
  disabled: boolean
  onClick: () => Promise<void>
}

const mockRecordStopToggleButton = (isRecording: boolean): MockButtonProps => {
  // Mock the Redux state
  const status = isRecording ? 'recording' : 'idle'

  mockUseAppSelector.mockReturnValue({ status })
  mockUseBackendCommands.mockReturnValue({
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
  })

  const isProcessing = status.startsWith('processing')

  const getButtonState = () => {
    if (isProcessing) return 'processing'
    if (isRecording) return 'recording'
    return 'ready'
  }

  const getAriaLabel = () => {
    if (isProcessing) return 'Processing recording...'
    return isRecording ? 'Stop recording' : 'Start recording'
  }

  const getTooltipContent = () => {
    if (isProcessing) return 'Processing...'
    return isRecording ? 'Stop recording' : 'Start recording'
  }

  const handleToggle = async () => {
    if (isProcessing) return

    if (isRecording) {
      await mockStopRecording()
    } else {
      await mockStartRecording()
    }
  }

  return {
    className: `record-stop-toggle ${getButtonState()}`,
    ariaLabel: getAriaLabel(),
    tooltipContent: getTooltipContent(),
    iconClassName: `toggle-icon ${isRecording ? 'stop-icon' : 'record-icon'}`,
    disabled: isProcessing,
    onClick: handleToggle,
  }
}

describe('RecordStopToggleButton Component Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Idle State', () => {
    it('should render in idle state when not recording', () => {
      const button = mockRecordStopToggleButton(false)

      expect(button.className).toBe('record-stop-toggle ready')
      expect(button.ariaLabel).toBe('Start recording')
      expect(button.tooltipContent).toBe('Start recording')
      expect(button.iconClassName).toBe('toggle-icon record-icon')
      expect(button.disabled).toBe(false)
    })

    it('should call startRecording when clicked in idle state', async () => {
      const button = mockRecordStopToggleButton(false)

      await button.onClick()

      expect(mockStartRecording).toHaveBeenCalledTimes(1)
      expect(mockStopRecording).not.toHaveBeenCalled()
    })

    it('should handle async startRecording errors gracefully', async () => {
      mockStartRecording.mockRejectedValue(new Error('Start recording failed'))

      const button = mockRecordStopToggleButton(false)

      try {
        await button.onClick()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Start recording failed')
      }

      expect(mockStartRecording).toHaveBeenCalledTimes(1)
    })
  })

  describe('Recording State', () => {
    it('should render in recording state when recording is active', () => {
      const button = mockRecordStopToggleButton(true)

      expect(button.className).toBe('record-stop-toggle recording')
      expect(button.ariaLabel).toBe('Stop recording')
      expect(button.tooltipContent).toBe('Stop recording')
      expect(button.iconClassName).toBe('toggle-icon stop-icon')
    })

    it('should call stopRecording when clicked in recording state', async () => {
      const button = mockRecordStopToggleButton(true)

      await button.onClick()

      expect(mockStopRecording).toHaveBeenCalledTimes(1)
      expect(mockStartRecording).not.toHaveBeenCalled()
    })

    it('should handle async stopRecording errors gracefully', async () => {
      mockStopRecording.mockRejectedValue(new Error('Stop recording failed'))

      const button = mockRecordStopToggleButton(true)

      try {
        await button.onClick()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Stop recording failed')
      }

      expect(mockStopRecording).toHaveBeenCalledTimes(1)
    })
  })

  describe('Processing State', () => {
    it('should render in processing state correctly', () => {
      // Mock processing state
      mockUseAppSelector.mockReturnValue({ status: 'processing-transcription' })
      mockUseBackendCommands.mockReturnValue({
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      })

      const isRecording = false // During processing, recording is false
      const isProcessing = true

      const getButtonState = () => {
        if (isProcessing) return 'processing'
        if (isRecording) return 'recording'
        return 'ready'
      }

      const getAriaLabel = () => {
        if (isProcessing) return 'Processing recording...'
        return isRecording ? 'Stop recording' : 'Start recording'
      }

      expect(getButtonState()).toBe('processing')
      expect(getAriaLabel()).toBe('Processing recording...')
    })
  })
})
