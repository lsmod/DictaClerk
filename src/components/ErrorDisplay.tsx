import React, { useEffect } from 'react'
import { useErrorDisplayViewModel } from './errorDisplay.viewModel'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCcw, X, Copy } from 'lucide-react'

const ErrorDisplay: React.FC = () => {
  const { state, actions, onMount } = useErrorDisplayViewModel()

  useEffect(onMount, [onMount])

  return (
    <>
      {state.showMultipleErrorsPanel && (
        <div className="error-recovery-panel">
          <div className="error-header">
            <AlertCircle className="error-icon" />
            <h3>Multiple Errors Detected</h3>
          </div>
          <p>
            Several recoverable errors have occurred. Consider enabling
            auto-recovery mode.
          </p>
          <div className="error-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={actions.enableAutoRecovery}
              className="recovery-button"
            >
              <RefreshCcw size={14} />
              Enable Auto-Recovery
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={actions.clearAllErrors}
              className="clear-button"
            >
              <X size={14} />
              Clear All Errors
            </Button>
          </div>
        </div>
      )}

      {state.showCriticalErrorPanel && state.criticalError && (
        <div className="critical-error-panel">
          <div className="error-header">
            <AlertCircle className="critical-error-icon" />
            <h3>Critical Error</h3>
          </div>
          <p>{state.criticalError.message}</p>
          {state.criticalError.context && (
            <details className="error-details">
              <summary>Technical Details</summary>
              <pre>{JSON.stringify(state.criticalError.context, null, 2)}</pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.copyErrorDetails(state.criticalError!)}
                className="copy-details-button"
              >
                <Copy size={14} />
                Copy Details
              </Button>
            </details>
          )}
          <div className="error-actions">
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                actions.acknowledgeSpecificError(
                  state.errors.indexOf(state.criticalError!)
                )
              }
              className="acknowledge-button"
            >
              Acknowledge
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

export default ErrorDisplay
