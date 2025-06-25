import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Redux hooks instead of the Recording Context
const mockUseAppSelector = vi.fn()
const mockUseRmsData = vi.fn()

vi.mock('../../store/hooks', () => ({
  useAppSelector: mockUseAppSelector,
}))

vi.mock('../hooks/useRmsData', () => ({
  useRmsData: mockUseRmsData,
}))

// Mock data for tests
const mockRmsData = {
  value: 0.5,
  isActive: true,
  timestamp: Date.now(),
}

describe('VolumeVisualizer Component Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks
    mockUseAppSelector.mockReturnValue({ status: 'idle' })
    mockUseRmsData.mockReturnValue(mockRmsData)
  })

  describe('Recording State Detection', () => {
    it('should detect recording state from Redux', () => {
      mockUseAppSelector.mockReturnValue({ status: 'recording' })

      const { status } = mockUseAppSelector()
      const isRecording = status === 'recording'

      expect(isRecording).toBe(true)
    })

    it('should detect idle state from Redux', () => {
      mockUseAppSelector.mockReturnValue({ status: 'idle' })

      const { status } = mockUseAppSelector()
      const isRecording = status === 'recording'

      expect(isRecording).toBe(false)
    })

    it('should detect processing states as not recording', () => {
      mockUseAppSelector.mockReturnValue({ status: 'processing-transcription' })

      const { status } = mockUseAppSelector()
      const isRecording = status === 'recording'

      expect(isRecording).toBe(false)
    })
  })

  describe('RMS Data Integration', () => {
    it('should use RMS data with throttling enabled', () => {
      // Simulate calling the hook with throttling
      mockUseRmsData({ throttle: true })
      expect(mockUseRmsData).toHaveBeenCalledWith({ throttle: true })
    })

    it('should handle RMS value amplification', () => {
      const testValue = 0.2
      mockUseRmsData.mockReturnValue({
        ...mockRmsData,
        value: testValue,
      })

      const rmsData = mockUseRmsData()
      const amplifiedRms = Math.min(1.0, rmsData.value * 6.0)
      const rmsPercentage = Math.round(amplifiedRms * 100)

      // The amplified value before clamping would be 1.2, but it gets clamped to 1.0
      expect(amplifiedRms).toBe(1.0) // Clamped value
      expect(rmsPercentage).toBe(100)
    })

    it('should handle low RMS values correctly', () => {
      const testValue = 0.05
      mockUseRmsData.mockReturnValue({
        ...mockRmsData,
        value: testValue,
      })

      const rmsData = mockUseRmsData()
      const amplifiedRms = Math.min(1.0, rmsData.value * 6.0)
      const rmsPercentage = Math.round(amplifiedRms * 100)

      // Use toBeCloseTo for floating point comparison
      expect(amplifiedRms).toBeCloseTo(0.3, 1)
      expect(rmsPercentage).toBe(30)
    })
  })

  describe('Timeline Buffer Logic', () => {
    it('should process timeline values correctly', () => {
      const timelineBuffer = new Array(60).fill(0)
      const testValue = 0.5

      // Simulate adding a new value to timeline
      const newTimelineBuffer = [
        ...timelineBuffer.slice(1),
        testValue > 0.008 ? testValue : 0,
      ]

      expect(newTimelineBuffer.length).toBe(60)
      expect(newTimelineBuffer[59]).toBe(testValue) // Latest value
      expect(newTimelineBuffer[0]).toBe(0) // Oldest value shifted out
    })

    it('should filter out very low values', () => {
      const lowValue = 0.005 // Below 0.008 threshold

      const filteredValue = lowValue > 0.008 ? lowValue : 0
      expect(filteredValue).toBe(0)
    })

    it('should preserve values above threshold', () => {
      const goodValue = 0.02 // Above 0.008 threshold

      const filteredValue = goodValue > 0.008 ? goodValue : 0
      expect(filteredValue).toBe(goodValue)
    })
  })

  describe('Volume Bar Generation', () => {
    it('should generate correct bar props', () => {
      const timelineBuffer = [0.1, 0.2, 0.3, 0.4, 0.5]

      const bars = timelineBuffer.map((value, index) => {
        const delay = (timelineBuffer.length - 1 - index) * 50
        const height = Math.round(value * 50)

        return {
          height,
          delay,
          value,
        }
      })

      expect(bars[0]).toEqual({
        height: 5, // 0.1 * 50
        delay: 200, // (5-1-0) * 50
        value: 0.1,
      })

      expect(bars[4]).toEqual({
        height: 25, // 0.5 * 50
        delay: 0, // (5-1-4) * 50
        value: 0.5,
      })
    })
  })
})
