import React from 'react'
import { useRecording } from '../contexts/RecordingContext'

const StopButton: React.FC = () => {
  const { stopRecording, isRecording } = useRecording()

  const handleStop = async () => {
    if (isRecording) {
      try {
        await stopRecording()
        // TODO: Optional window hide behavior could be added here
        // TODO: Optional clipboard processing could be added here
      } catch (error) {
        console.error('Failed to stop recording:', error)
        // TODO: Could show user-friendly error notification here
      }
    }
  }

  return (
    <button
      className="stop-button"
      onClick={handleStop}
      aria-label="Stop recording"
      disabled={!isRecording}
      title={isRecording ? 'Stop recording' : 'No recording in progress'}
    >
      <div className="stop-icon" />
    </button>
  )
}

export default StopButton
