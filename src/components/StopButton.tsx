import React from 'react'
import { useRecording } from '../contexts/RecordingContext'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const RecordStopToggleButton: React.FC = () => {
  const { startRecording, stopRecording, isRecording } = useRecording()

  const handleToggle = async () => {
    try {
      if (isRecording) {
        await stopRecording()
        // TODO: Optional window hide behavior could be added here
        // TODO: Optional clipboard processing could be added here
      } else {
        await startRecording()
      }
    } catch (error) {
      console.error('Failed to toggle recording:', error)
      // TODO: Could show user-friendly error notification here
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`record-stop-toggle ${
            isRecording ? 'recording' : 'ready'
          }`}
          onClick={handleToggle}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <div
            className={`toggle-icon ${
              isRecording ? 'stop-icon' : 'record-icon'
            }`}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isRecording ? 'Stop recording' : 'Start recording'}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default RecordStopToggleButton
