import React from 'react'
import { useRecording } from '../contexts/RecordingContext'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const RecordStopToggleButton: React.FC = () => {
  const { startRecording, stopRecording, isRecording } = useRecording()

  const announceRecordingState = (recording: boolean) => {
    const liveRegion = document.getElementById('main-live-region')
    if (liveRegion) {
      liveRegion.textContent = recording
        ? 'Recording started'
        : 'Recording stopped'
      setTimeout(() => {
        liveRegion.textContent = ''
      }, 1500)
    }
  }

  const handleToggle = async () => {
    try {
      if (isRecording) {
        await stopRecording()
        announceRecordingState(false)
        // TODO: Optional window hide behavior could be added here
        // TODO: Optional clipboard processing could be added here
      } else {
        await startRecording()
        announceRecordingState(true)
      }
    } catch (error) {
      console.error('Failed to toggle recording:', error)
      // Announce error to screen readers
      const liveRegion = document.getElementById('main-live-region')
      if (liveRegion) {
        liveRegion.textContent = 'Failed to toggle recording'
        setTimeout(() => {
          liveRegion.textContent = ''
        }, 2000)
      }
      // TODO: Could show user-friendly error notification here
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
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
          onKeyDown={handleKeyDown}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          aria-pressed={isRecording}
          role="button"
          type="button"
        >
          <div
            className={`toggle-icon ${
              isRecording ? 'stop-icon' : 'record-icon'
            }`}
            aria-hidden="true"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isRecording ? 'Stop recording' : 'Start recording'}</p>
        <p className="text-xs opacity-75">
          {isRecording
            ? 'Click or press Space/Enter to stop'
            : 'Click or press Space/Enter to start'}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

export default RecordStopToggleButton
