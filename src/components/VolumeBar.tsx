import React from 'react'

interface VolumeBarProps {
  height: number
  delay: number
  isRecording: boolean
}

const VolumeBar: React.FC<VolumeBarProps> = ({
  height,
  delay,
  isRecording,
}) => {
  return (
    <div
      className={`volume-bar ${isRecording ? 'recording' : 'idle'}`}
      style={{
        height: `${height}%`,
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

export default VolumeBar
