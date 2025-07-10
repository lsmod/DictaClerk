import React, { useEffect } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useStopButtonViewModel } from './stopButton.viewModel'

const RecordStopToggleButton: React.FC = () => {
  const { state, actions, onMount } = useStopButtonViewModel()

  useEffect(onMount, [onMount])

  const getTooltipContent = () => {
    if (state.isProcessing) {
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
        <p>{state.isRecording ? 'Stop recording' : 'Start recording'}</p>
        <p className="text-xs opacity-75">
          {state.isRecording
            ? 'Click or press Space/Enter to stop'
            : 'Click or press Space/Enter to start'}
        </p>
      </>
    )
  }

  const getIconClassName = () => {
    if (state.isProcessing) return 'toggle-icon processing-icon'
    return `toggle-icon ${state.isRecording ? 'stop-icon' : 'record-icon'}`
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`record-stop-toggle ${state.buttonState}`}
          onClick={actions.toggleRecording}
          onKeyDown={actions.handleKeyDown}
          disabled={state.disabled}
          aria-label={state.ariaLabel}
          aria-pressed={state.isRecording}
          role="button"
          type="button"
        >
          <div className={getIconClassName()} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{getTooltipContent()}</TooltipContent>
    </Tooltip>
  )
}

export default RecordStopToggleButton
