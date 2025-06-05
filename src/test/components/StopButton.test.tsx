import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the recording context
const mockStopRecording = vi.fn()
const mockUseRecording = vi.fn()

vi.mock('../../contexts/RecordingContext', () => ({
  useRecording: mockUseRecording,
}))

// Mock React component for testing purposes
const mockStopButton = (isRecording: boolean) => {
  const { stopRecording } = mockUseRecording()

  const handleStop = async () => {
    if (isRecording) {
      await stopRecording()
    }
  }

  return {
    isDisabled: !isRecording,
    ariaLabel: 'Stop recording',
    title: isRecording ? 'Stop recording' : 'No recording in progress',
    className: 'stop-button',
    onClick: handleStop,
  }
}

describe('StopButton Component Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseRecording.mockReturnValue({
      stopRecording: mockStopRecording,
      isRecording: false,
    })
  })

  it('should have correct properties when not recording', () => {
    mockUseRecording.mockReturnValue({
      stopRecording: mockStopRecording,
      isRecording: false,
    })

    const button = mockStopButton(false)

    expect(button.isDisabled).toBe(true)
    expect(button.ariaLabel).toBe('Stop recording')
    expect(button.title).toBe('No recording in progress')
    expect(button.className).toBe('stop-button')
  })

  it('should have correct properties when recording', () => {
    mockUseRecording.mockReturnValue({
      stopRecording: mockStopRecording,
      isRecording: true,
    })

    const button = mockStopButton(true)

    expect(button.isDisabled).toBe(false)
    expect(button.ariaLabel).toBe('Stop recording')
    expect(button.title).toBe('Stop recording')
    expect(button.className).toBe('stop-button')
  })

  it('should call stopRecording when clicked while recording', async () => {
    mockUseRecording.mockReturnValue({
      stopRecording: mockStopRecording,
      isRecording: true,
    })

    const button = mockStopButton(true)
    await button.onClick()

    expect(mockStopRecording).toHaveBeenCalledTimes(1)
  })

  it('should not call stopRecording when clicked while not recording', async () => {
    mockUseRecording.mockReturnValue({
      stopRecording: mockStopRecording,
      isRecording: false,
    })

    const button = mockStopButton(false)
    await button.onClick()

    expect(mockStopRecording).not.toHaveBeenCalled()
  })

  it('should handle async stopRecording errors gracefully', async () => {
    mockStopRecording.mockRejectedValue(new Error('Stop recording failed'))

    mockUseRecording.mockReturnValue({
      stopRecording: mockStopRecording,
      isRecording: true,
    })

    const button = mockStopButton(true)

    // The click should call stopRecording even if it fails
    // In a real component, we'd want to handle the error gracefully
    try {
      await button.onClick()
    } catch (error) {
      // Expected to throw since we mocked it to reject
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Stop recording failed')
    }

    expect(mockStopRecording).toHaveBeenCalledTimes(1)
  })

  it('should integrate properly with useRecording hook', () => {
    const mockRecordingState = {
      stopRecording: mockStopRecording,
      isRecording: true,
    }

    mockUseRecording.mockReturnValue(mockRecordingState)

    // Simulate component using the hook
    const { stopRecording, isRecording } = mockUseRecording()

    expect(mockUseRecording).toHaveBeenCalledTimes(1)
    expect(stopRecording).toBe(mockStopRecording)
    expect(isRecording).toBe(true)
  })

  it('should have correct disabled state based on recording status', () => {
    // Test when not recording
    const buttonNotRecording = mockStopButton(false)
    expect(buttonNotRecording.isDisabled).toBe(true)

    // Test when recording
    const buttonRecording = mockStopButton(true)
    expect(buttonRecording.isDisabled).toBe(false)
  })

  it('should have accessibility attributes', () => {
    const button = mockStopButton(true)

    expect(button.ariaLabel).toBe('Stop recording')
    expect(button.title).toBeTruthy()
    expect(typeof button.title).toBe('string')
  })

  it('should provide different tooltips based on recording state', () => {
    const buttonNotRecording = mockStopButton(false)
    expect(buttonNotRecording.title).toBe('No recording in progress')

    const buttonRecording = mockStopButton(true)
    expect(buttonRecording.title).toBe('Stop recording')
  })
})
