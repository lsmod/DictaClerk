import { useEffect, useRef } from 'react'
import { useAppSelector } from '../store/hooks'
import { toast } from 'sonner'

/**
 * Hook to manage processing and error toasts
 * Provides visual feedback during transcription workflow
 */
export const useProcessingToasts = () => {
  const { status, error, processingProgress } = useAppSelector(
    (state) => state.app
  )
  const processingToastRef = useRef<string | number | null>(null)
  const errorToastRef = useRef<string | number | null>(null)
  const wasProcessingRef = useRef<boolean>(false)

  // Handle processing state toasts
  useEffect(() => {
    const isProcessing = status.startsWith('processing')

    console.log('🍞 [TOAST] Processing state check:', {
      status,
      isProcessing,
      wasProcessing: wasProcessingRef.current,
      hasProcessingToast: !!processingToastRef.current,
    })

    if (isProcessing && !processingToastRef.current) {
      // Show processing toast
      console.log('🍞 [TOAST] Showing processing toast')
      wasProcessingRef.current = true
      processingToastRef.current = toast.loading('Processing recording...', {
        description: 'Transcribing and formatting your audio',
        duration: Infinity, // Keep until processing is done
      })
    } else if (!isProcessing && processingToastRef.current) {
      // Dismiss processing toast when done
      console.log('🍞 [TOAST] Dismissing processing toast, status:', status)
      toast.dismiss(processingToastRef.current)
      processingToastRef.current = null

      // Show success toast if processing completed successfully
      if (status === 'processing-complete') {
        console.log('🍞 [TOAST] ✅ Showing success toast!')
        toast.success('Recording processed successfully!', {
          description: 'Text has been copied to clipboard',
          duration: 4000, // Show a bit longer for better UX
        })
        wasProcessingRef.current = false
      } else if (status === 'idle' && wasProcessingRef.current) {
        console.log('🍞 [TOAST] ℹ️ Processing completed, transitioned to idle')
        // Also show success toast when transitioning to idle after processing
        // This handles cases where we go directly from processing to idle
        toast.success('Recording processed successfully!', {
          description: 'Text has been copied to clipboard',
          duration: 4000,
        })
        wasProcessingRef.current = false
      }
    }

    // Update processing toast with progress if available
    if (isProcessing && processingToastRef.current && processingProgress) {
      const { stage, progress, message } = processingProgress
      const stageNames = {
        transcription: 'Transcribing',
        'gpt-formatting': 'AI Formatting',
        clipboard: 'Copying to clipboard',
      }

      const stageName = stageNames[stage as keyof typeof stageNames] || stage
      const progressPercent = Math.round(progress)

      let description = `${stageName}...`
      if (message) {
        description = `${stageName}: ${message}`
      } else if (progress > 0) {
        description = `${stageName} ${progressPercent}%`
      }

      // Update the existing toast
      toast.loading('Processing recording...', {
        id: processingToastRef.current,
        description,
        duration: Infinity,
      })
    }
  }, [status, processingProgress])

  // Handle error toasts
  useEffect(() => {
    if (error && !errorToastRef.current) {
      // Dismiss any existing processing toast first
      if (processingToastRef.current) {
        toast.dismiss(processingToastRef.current)
        processingToastRef.current = null
      }

      // Show error toast
      errorToastRef.current = toast.error('Processing failed', {
        description: error,
        duration: 8000,
        action: {
          label: 'Dismiss',
          onClick: () => {
            if (errorToastRef.current) {
              toast.dismiss(errorToastRef.current)
              errorToastRef.current = null
            }
          },
        },
      })
    } else if (!error && errorToastRef.current) {
      // Dismiss error toast when error is cleared
      toast.dismiss(errorToastRef.current)
      errorToastRef.current = null
    }
  }, [error])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processingToastRef.current) {
        toast.dismiss(processingToastRef.current)
      }
      if (errorToastRef.current) {
        toast.dismiss(errorToastRef.current)
      }
    }
  }, [])

  return {
    // Expose methods for manual toast management if needed
    showProcessingToast: (message: string, description?: string) => {
      return toast.loading(message, {
        description,
        duration: Infinity,
      })
    },
    showSuccessToast: (message: string, description?: string) => {
      return toast.success(message, {
        description,
        duration: 3000,
      })
    },
    showErrorToast: (message: string, description?: string) => {
      return toast.error(message, {
        description,
        duration: 8000,
      })
    },
    dismissToast: (toastId: string | number) => {
      toast.dismiss(toastId)
    },
  }
}
