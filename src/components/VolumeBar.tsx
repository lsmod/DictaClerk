import React from 'react'

interface VolumeBarProps {
  height: number
  delay: number
}

const VolumeBar: React.FC<VolumeBarProps> = ({ height, delay }) => {
  return (
    <div
      className="volume-bar"
      style={{
        height: `${height}%`,
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

export default VolumeBar
