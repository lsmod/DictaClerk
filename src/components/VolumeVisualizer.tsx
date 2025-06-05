import React, { useRef, useEffect } from 'react'
import VolumeBar from './VolumeBar'
import { useRecording } from '../contexts/RecordingContext'
import { useRmsData } from '../hooks/useRmsData'

const VolumeVisualizer: React.FC = () => {
  const { isRecording } = useRecording()
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

  // Generate timeline bars - each represents a point in time
  const bars = timelineBuffer.current.map((historicalRms, index) => {
    let height: number

    if (historicalRms > 0.008) {
      // Use historical RMS data with amplification for this time point
      const amplified = Math.min(1.0, historicalRms * 6.0)
      const logScaled = Math.pow(amplified, 0.4)

      // Calculate wave amplitude (0-40% from center, so total height is 0-80%)
      height = logScaled * 40 // 0-40% amplitude from center
    } else {
      // Silent period - very small centered bars
      height = 2 // Very small bars for silence
    }

    return {
      id: index,
      height,
      delay: 0, // No animation delay for timeline - each bar is independent
      timeIndex: index, // Index in timeline (0 = oldest/left, 59 = newest/right)
      hasAudio: historicalRms > 0, // Track if this time point had any audio (even very quiet)
    }
  })

  return (
    <div
      className={`volume-visualizer ${
        rmsData.isActive && rmsData.value > 0.008 ? 'recording' : 'idle'
      }`} // Border reflects recording state
      role="progressbar"
      aria-valuenow={rmsPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Audio timeline"
      aria-live="polite"
      aria-atomic="false"
      tabIndex={0}
    >
      {/* Screen reader accessible text */}
      <span className="sr-only">
        Audio timeline: {rmsPercentage}%
        {rmsData.isActive && rmsData.value > 0.008 ? ' - Recording' : ' - Idle'}
      </span>

      {bars.map((bar) => (
        <VolumeBar
          key={bar.id}
          height={bar.height}
          delay={bar.delay}
          isRecording={true} // Always show as recording color for consistent timeline appearance
          rmsValue={timelineBuffer.current[bar.timeIndex]}
        />
      ))}
    </div>
  )
}

export default VolumeVisualizer
