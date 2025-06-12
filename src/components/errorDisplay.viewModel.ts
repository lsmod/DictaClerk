import { useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { useBackendCommands } from '../hooks/useBackendCommands'
import {
  acknowledgeError,
  removeError,
  clearErrors,
  selectRecoverableErrors,
  AppError,
} from '../store/slices/appSlice'
import { toast } from '@/components/ui/sonner'

interface ErrorDisplayState {
  recoverableErrors: AppError[]
  error: string | null
  lastError: AppError | null
  errors: AppError[]
  autoRecoveryMode: boolean
  backendConnected: boolean
  showMultipleErrorsPanel: boolean
  showCriticalErrorPanel: boolean
  criticalError: AppError | null
}

interface ErrorDisplayActions {
  acknowledgeError: () => void
  removeErrorByIndex: (index: number) => void
  clearAllErrors: () => void
  enableAutoRecovery: () => void
  retryConnection: () => void
  copyErrorDetails: (error: AppError) => void
  acknowledgeSpecificError: (errorIndex: number) => void
}

export const useErrorDisplayViewModel = () => {
  const dispatch = useAppDispatch()
  const { retryConnection, enableAutoRecovery } = useBackendCommands()

  // Use enhanced selectors
  const recoverableErrors = useAppSelector(selectRecoverableErrors)
  const { error, lastError, errors, autoRecoveryMode, backendConnected } =
    useAppSelector((state) => state.app)

  // Compute derived state
  const criticalErrors = errors.filter(
    (e) => !e.recoverable && e.type !== 'system'
  )
  const showMultipleErrorsPanel = recoverableErrors.length > 2
  const showCriticalErrorPanel = criticalErrors.length > 0
  const criticalError = criticalErrors.length > 0 ? criticalErrors[0] : null

  // Handle legacy error display with toasts
  useEffect(() => {
    if (error) {
      const errorToast = toast.error('Error', {
        description: error,
        duration: 8000,
        action: {
          label: 'Dismiss',
          onClick: () => {
            dispatch(acknowledgeError())
          },
        },
      })

      return () => {
        toast.dismiss(errorToast)
      }
    }
  }, [error, dispatch])

  // Handle advanced error display with detailed toasts
  useEffect(() => {
    if (lastError && lastError.timestamp > Date.now() - 1000) {
      // Only show recent errors
      const getErrorTitle = (type: string) => {
        switch (type) {
          case 'transcription':
            return 'Transcription Error'
          case 'gpt-formatting':
            return 'AI Formatting Error'
          case 'clipboard':
            return 'Clipboard Error'
          case 'profile-validation':
            return 'Profile Error'
          case 'system':
            return 'System Error'
          default:
            return 'Error'
        }
      }

      const getErrorActions = (error: typeof lastError) => {
        const actions = []

        if (error.recoverable) {
          actions.push({
            label: 'Retry',
            onClick: () => {
              if (error.type === 'system' && !backendConnected) {
                retryConnection()
              }
              dispatch(removeError(errors.findIndex((e) => e === error)))
            },
          })
        }

        if (error.context && typeof error.context === 'object') {
          actions.push({
            label: 'Copy Details',
            onClick: () => {
              navigator.clipboard.writeText(
                JSON.stringify(error.context, null, 2)
              )
              toast.success('Error details copied to clipboard')
            },
          })
        }

        return actions
      }

      const errorToast = toast.error(getErrorTitle(lastError.type), {
        description: lastError.message,
        duration: lastError.recoverable ? 10000 : 5000,
        action: getErrorActions(lastError)[0], // Primary action
      })

      return () => {
        toast.dismiss(errorToast)
      }
    }
  }, [lastError, errors, dispatch, retryConnection, backendConnected])

  // Auto-recovery notification
  useEffect(() => {
    if (autoRecoveryMode) {
      const recoveryToast = toast.info('Auto-Recovery Mode', {
        description:
          'Multiple connection failures detected. Auto-recovery is active.',
        duration: Infinity,
        action: {
          label: 'Disable',
          onClick: () => {
            enableAutoRecovery() // This will toggle it off
          },
        },
      })

      return () => {
        toast.dismiss(recoveryToast)
      }
    }
  }, [autoRecoveryMode, enableAutoRecovery])

  // Connection status notification
  useEffect(() => {
    if (!backendConnected) {
      const connectionToast = toast.error('Backend Disconnected', {
        description: 'Lost connection to backend. Some features may not work.',
        duration: Infinity,
        action: {
          label: 'Retry',
          onClick: () => {
            retryConnection()
          },
        },
      })

      return () => {
        toast.dismiss(connectionToast)
      }
    }
  }, [backendConnected, retryConnection])

  const state: ErrorDisplayState = {
    recoverableErrors,
    error,
    lastError,
    errors,
    autoRecoveryMode,
    backendConnected,
    showMultipleErrorsPanel,
    showCriticalErrorPanel,
    criticalError,
  }

  const actions: ErrorDisplayActions = {
    acknowledgeError: () => {
      dispatch(acknowledgeError())
    },

    removeErrorByIndex: (index: number) => {
      dispatch(removeError(index))
    },

    clearAllErrors: () => {
      dispatch(clearErrors())
    },

    enableAutoRecovery: () => {
      enableAutoRecovery()
    },

    retryConnection: () => {
      retryConnection()
    },

    copyErrorDetails: (error: AppError) => {
      if (error.context && typeof error.context === 'object') {
        navigator.clipboard.writeText(JSON.stringify(error.context, null, 2))
        toast.success('Error details copied to clipboard')
      }
    },

    acknowledgeSpecificError: (errorIndex: number) => {
      dispatch(removeError(errorIndex))
    },
  }

  const onMount = () => {
    // No initialization needed for this component
  }

  return { state, actions, onMount }
}
