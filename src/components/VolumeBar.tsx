import React from 'react'

interface VolumeBarProps {
  height: number // This is now the amplitude from center (0-50%)
  delay: number
  isRecording: boolean
  rmsValue?: number
}

const VolumeBar: React.FC<VolumeBarProps> = ({
  height,
  delay,
  isRecording,
  rmsValue = 0,
}) => {
  // Calculate amplitude from center based on RMS data when recording
  const amplitude =
    isRecording && rmsValue > 0
      ? Math.max(height, rmsValue * 50) // Use RMS-based amplitude from center (max 50%)
      : height

  return (
    <div
      className="volume-bar-container"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top half of the bar (grows upward from center) */}
      <div
        className={`volume-bar-half volume-bar-top ${
          isRecording ? 'recording' : 'idle'
        }`}
        style={{
          height: `${amplitude}%`,
        }}
        aria-hidden="true"
      />
      {/* Bottom half of the bar (grows downward from center) */}
      <div
        className={`volume-bar-half volume-bar-bottom ${
          isRecording ? 'recording' : 'idle'
        }`}
        style={{
          height: `${amplitude}%`,
        }}
        aria-hidden="true"
      />
    </div>
  )
}

export default VolumeBar
