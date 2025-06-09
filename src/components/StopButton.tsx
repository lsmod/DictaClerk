import React from 'react'
import { useRecording } from '../contexts/RecordingContext'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const RecordStopToggleButton: React.FC = () => {
  const { startRecording, stopRecording, isRecording, isProcessing } =
    useRecording()

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
    // Prevent action if already processing
    if (isProcessing) return

    try {
      if (isRecording) {
        await stopRecording()
        announceRecordingState(false)
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
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isProcessing) return // Prevent keyboard action during processing

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }

  const getButtonState = () => {
    if (isProcessing) return 'processing'
    if (isRecording) return 'recording'
    return 'ready'
  }

  const getAriaLabel = () => {
    if (isProcessing) return 'Processing recording...'
    return isRecording ? 'Stop recording' : 'Start recording'
  }

  const getTooltipContent = () => {
    if (isProcessing) {
      return (
        <>
          <p>Processing recording...</p>
          <p className="text-xs opacity-75">
            Transcribing and copying to clipboard
          </p>
        </>
      )
    }

    return (
      <>
        <p>{isRecording ? 'Stop recording' : 'Start recording'}</p>
        <p className="text-xs opacity-75">
          {isRecording
            ? 'Click or press Space/Enter to stop'
            : 'Click or press Space/Enter to start'}
        </p>
      </>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`record-stop-toggle ${getButtonState()}`}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          aria-label={getAriaLabel()}
          aria-pressed={isRecording}
          disabled={isProcessing}
          role="button"
          type="button"
        >
          <div
            className={`toggle-icon ${
              isProcessing
                ? 'processing-icon'
                : isRecording
                  ? 'stop-icon'
                  : 'record-icon'
            }`}
            aria-hidden="true"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>{getTooltipContent()}</TooltipContent>
    </Tooltip>
  )
}

export default RecordStopToggleButton
