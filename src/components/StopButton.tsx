import React, { useEffect } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useStopButtonViewModel } from './stopButton.viewModel'

const RecordStopToggleButton: React.FC = () => {
  const { state, actions, onMount } = useStopButtonViewModel()

  useEffect(onMount, [])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`record-stop-toggle ${state.buttonState}`}
          onClick={actions.toggleRecording}
          onKeyDown={actions.handleKeyDown}
          disabled={state.disabled}
          aria-label={state.ariaLabel}
          type="button"
        >
          <div
            className={`toggle-icon ${
              state.isRecording ? 'stop-icon' : 'record-icon'
            }`}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{state.tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default RecordStopToggleButton
