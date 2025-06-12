import React, { useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { updateRecordingTime } from '../store/slices/appSlice'

const ElapsedTime: React.FC = () => {
  const dispatch = useAppDispatch()
  const { status, recordingTime, processingProgress } = useAppSelector(
    (state) => state.app
  )

  const isRecording = status === 'recording'
  const isProcessing = status.startsWith('processing')

  // Update recording time every second when recording
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        dispatch(updateRecordingTime())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isRecording, dispatch])

  const formatTime = (totalMs: number) => {
    const totalSeconds = Math.floor(totalMs / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }

  const getProcessingDisplay = () => {
    if (!processingProgress) return 'Processing...'

    const { stage, progress, message } = processingProgress
    const stageNames = {
      transcription: 'Transcribing',
      'gpt-formatting': 'AI Formatting',
      clipboard: 'Copying',
    }

    const stageName = stageNames[stage] || stage
    const progressPercent = Math.round(progress)

    if (message) {
      return `${stageName}: ${message}`
    }

    return `${stageName} ${progressPercent}%`
  }

  if (isProcessing) {
    return (
      <div className="elapsed-time processing">
        <span className="processing-indicator">⟳</span>
        <span className="processing-text">{getProcessingDisplay()}</span>
      </div>
    )
  }

  return (
    <div className={`elapsed-time ${isRecording ? 'recording' : 'idle'}`}>
      {isRecording && <span className="recording-indicator">●</span>}
      {formatTime(recordingTime)}
    </div>
  )
}

export default ElapsedTime
