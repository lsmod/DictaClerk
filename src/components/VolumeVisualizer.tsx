import React, { useEffect } from 'react'
import VolumeBar from './VolumeBar'
import { useVolumeVisualizerViewModel } from './volumeVisualizer.viewModel'

const VolumeVisualizer: React.FC = () => {
  const { state, onMount } = useVolumeVisualizerViewModel()

  useEffect(onMount, [])

  return (
    <div
      className={`volume-visualizer ${
        state.isRecording ? 'recording' : 'idle'
      }`}
    >
      <div className="volume-display">
        <div className="volume-bars">
          {state.timelineBuffer.map((value, index) => {
            // Calculate delay for timeline effect (oldest values have more delay)
            const delay = (state.timelineBuffer.length - 1 - index) * 50 // 50ms per step

            // Convert value to height percentage (0-50% for center-symmetric bars)
            const height = Math.round(value * 50)

            return (
              <VolumeBar
                key={index}
                height={height}
                delay={delay}
                isRecording={state.isRecording}
                rmsValue={value}
              />
            )
          })}
        </div>

        <div className="volume-info">
          <div className="rms-value">{state.rmsPercentage}%</div>
        </div>
      </div>
    </div>
  )
}

export default VolumeVisualizer
