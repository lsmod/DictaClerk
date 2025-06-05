import React from 'react'
import { useRecording } from '../contexts/RecordingContext'

const ElapsedTime: React.FC = () => {
  const { recordingTime, isRecording } = useRecording()

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }

  return (
    <div className={`elapsed-time ${isRecording ? 'recording' : 'idle'}`}>
      {isRecording && <span className="recording-indicator">●</span>}
      {formatTime(recordingTime)}
    </div>
  )
}

export default ElapsedTime
