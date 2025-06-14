import React, { useEffect } from 'react'
import VolumeBar from './VolumeBar'
import { useVolumeVisualizerViewModel } from './volumeVisualizer.viewModel'

const VolumeVisualizer: React.FC = () => {
  const { state, onMount } = useVolumeVisualizerViewModel()

  useEffect(onMount, [onMount])

  // Generate timeline bars - each represents a point in time
  const bars = state.timelineBuffer.map((historicalRms, index) => {
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
        state.rmsData.isActive && state.rmsData.value > 0.008
          ? 'recording'
          : 'idle'
      }`} // Border reflects recording state
      role="progressbar"
      aria-valuenow={state.rmsPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Audio timeline"
      aria-live="polite"
      aria-atomic="false"
      tabIndex={0}
    >
      {/* Screen reader accessible text */}
      <span className="sr-only">
        Audio timeline: {state.rmsPercentage}%
        {state.rmsData.isActive && state.rmsData.value > 0.008
          ? ' - Recording'
          : ' - Idle'}
      </span>

      {bars.map((bar) => (
        <VolumeBar
          key={bar.id}
          height={bar.height}
          delay={bar.delay}
          isRecording={true} // Always show as recording color for consistent timeline appearance
          rmsValue={state.timelineBuffer[bar.timeIndex]}
        />
      ))}
    </div>
  )
}

export default VolumeVisualizer
