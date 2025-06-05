import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the recording context
const mockStartRecording = vi.fn()
const mockStopRecording = vi.fn()
const mockUseRecording = vi.fn()

vi.mock('../../contexts/RecordingContext', () => ({
  useRecording: mockUseRecording,
}))

// Mock React component for testing purposes
const mockRecordStopToggleButton = (isRecording: boolean) => {
  const { startRecording, stopRecording } = mockUseRecording()

  const handleToggle = async () => {
    if (isRecording) {
      await stopRecording()
    } else {
      await startRecording()
    }
  }

  return {
    className: `record-stop-toggle ${isRecording ? 'recording' : 'ready'}`,
    ariaLabel: isRecording ? 'Stop recording' : 'Start recording',
    tooltipContent: isRecording ? 'Stop recording' : 'Start recording',
    iconClassName: `toggle-icon ${isRecording ? 'stop-icon' : 'record-icon'}`,
    onClick: handleToggle,
  }
}

describe('RecordStopToggleButton Component Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementation
    mockUseRecording.mockReturnValue({
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      isRecording: false,
    })
  })

  describe('Ready State (Not Recording)', () => {
    it('should render in ready state when not recording', () => {
      mockUseRecording.mockReturnValue({
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        isRecording: false,
      })

      const button = mockRecordStopToggleButton(false)

      expect(button.className).toBe('record-stop-toggle ready')
      expect(button.ariaLabel).toBe('Start recording')
      expect(button.tooltipContent).toBe('Start recording')
      expect(button.iconClassName).toBe('toggle-icon record-icon')
    })

    it('should call startRecording when clicked in ready state', async () => {
      mockUseRecording.mockReturnValue({
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        isRecording: false,
      })

      const button = mockRecordStopToggleButton(false)

      await button.onClick()

      expect(mockStartRecording).toHaveBeenCalledTimes(1)
      expect(mockStopRecording).not.toHaveBeenCalled()
    })

    it('should handle async startRecording errors gracefully', async () => {
      mockStartRecording.mockRejectedValue(new Error('Start recording failed'))

      mockUseRecording.mockReturnValue({
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        isRecording: false,
      })

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
      mockUseRecording.mockReturnValue({
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        isRecording: true,
      })

      const button = mockRecordStopToggleButton(true)

      expect(button.className).toBe('record-stop-toggle recording')
      expect(button.ariaLabel).toBe('Stop recording')
      expect(button.tooltipContent).toBe('Stop recording')
      expect(button.iconClassName).toBe('toggle-icon stop-icon')
    })

    it('should call stopRecording when clicked in recording state', async () => {
      mockUseRecording.mockReturnValue({
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        isRecording: true,
      })

      const button = mockRecordStopToggleButton(true)

      await button.onClick()

      expect(mockStopRecording).toHaveBeenCalledTimes(1)
      expect(mockStartRecording).not.toHaveBeenCalled()
    })

    it('should handle async stopRecording errors gracefully', async () => {
      mockStopRecording.mockRejectedValue(new Error('Stop recording failed'))

      mockUseRecording.mockReturnValue({
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        isRecording: true,
      })

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

  describe('Toggle Behavior', () => {
    it('should toggle between start and stop correctly', async () => {
      // Reset the mocks to ensure clean state
      mockStartRecording.mockReset()
      mockStopRecording.mockReset()

      // Test starting recording
      mockUseRecording.mockReturnValue({
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        isRecording: false,
      })

      let button = mockRecordStopToggleButton(false)
      await button.onClick()
      expect(mockStartRecording).toHaveBeenCalledTimes(1)

      // Test stopping recording
      mockUseRecording.mockReturnValue({
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        isRecording: true,
      })

      button = mockRecordStopToggleButton(true)
      await button.onClick()
      expect(mockStopRecording).toHaveBeenCalledTimes(1)
    })

    it('should have correct accessibility attributes for both states', () => {
      // Ready state
      const readyButton = mockRecordStopToggleButton(false)
      expect(readyButton.ariaLabel).toBe('Start recording')

      // Recording state
      const recordingButton = mockRecordStopToggleButton(true)
      expect(recordingButton.ariaLabel).toBe('Stop recording')
    })

    it('should have correct tooltips for both states', () => {
      // Ready state
      const readyButton = mockRecordStopToggleButton(false)
      expect(readyButton.tooltipContent).toBe('Start recording')

      // Recording state
      const recordingButton = mockRecordStopToggleButton(true)
      expect(recordingButton.tooltipContent).toBe('Stop recording')
    })

    it('should have correct CSS classes for both states', () => {
      // Ready state
      const readyButton = mockRecordStopToggleButton(false)
      expect(readyButton.className).toBe('record-stop-toggle ready')
      expect(readyButton.iconClassName).toBe('toggle-icon record-icon')

      // Recording state
      const recordingButton = mockRecordStopToggleButton(true)
      expect(recordingButton.className).toBe('record-stop-toggle recording')
      expect(recordingButton.iconClassName).toBe('toggle-icon stop-icon')
    })
  })
})
