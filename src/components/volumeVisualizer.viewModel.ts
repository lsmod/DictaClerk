import { useRef, useEffect } from 'react'
import { useAppSelector } from '../store/hooks'
import { useRmsData } from '../hooks/useRmsData'

interface VolumeVisualizerState {
  isRecording: boolean
  rmsData: {
    value: number
    isActive: boolean
    timestamp: number
  }
  timelineBuffer: number[]
  rmsPercentage: number
  amplifiedRms: number
}

export const useVolumeVisualizerViewModel = () => {
  const { status } = useAppSelector((state) => state.app)
  const isRecording = status === 'recording'
  const rmsData = useRmsData({ throttle: true })

  // Timeline buffer to store RMS history (60 time points)
  const timelineBuffer = useRef<number[]>(new Array(60).fill(0))
  const lastUpdateTime = useRef<number>(0)

  // Debug logging for RMS data
  useEffect(() => {
    console.log('VolumeVisualizer RMS data:', {
      value: rmsData.value,
      isActive: rmsData.isActive,
      timestamp: rmsData.timestamp,
      isRecording,
    })
  }, [rmsData.value, rmsData.isActive, isRecording])

  // Update timeline buffer when RMS data changes
  useEffect(() => {
    const now = Date.now()

    // Update at most every 100ms (10fps) to create smooth timeline effect
    if (now - lastUpdateTime.current >= 100) {
      // Shift all values to the left (past) and add new value on the right (present)
      timelineBuffer.current = [
        ...timelineBuffer.current.slice(1), // Remove oldest (leftmost) value
        rmsData.isActive && rmsData.value > 0.008 ? rmsData.value : 0, // Add newest (rightmost) value
      ]
      lastUpdateTime.current = now
    }
  }, [rmsData.value, rmsData.isActive, rmsData.timestamp])

  // Convert RMS value to percentage for display (with amplification applied)
  const amplifiedRms = Math.min(1.0, rmsData.value * 6.0)
  const rmsPercentage = Math.round(amplifiedRms * 100)

  const state: VolumeVisualizerState = {
    isRecording,
    rmsData,
    timelineBuffer: timelineBuffer.current,
    rmsPercentage,
    amplifiedRms,
  }

  const actions = {
    // No user actions for this component
  }

  const onMount = () => {
    // No initialization needed for this component
  }

  return { state, actions, onMount }
}
