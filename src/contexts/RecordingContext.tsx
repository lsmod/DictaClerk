import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from '@/components/ui/sonner'

interface RecordingContextType {
  isRecording: boolean
  isProcessing: boolean
  startRecording: () => void
  stopRecording: () => void
  toggleRecording: () => void
  recordingTime: number
}

const RecordingContext = createContext<RecordingContextType | undefined>(
  undefined
)

export const useRecording = () => {
  const context = useContext(RecordingContext)
  if (context === undefined) {
    throw new Error('useRecording must be used within a RecordingProvider')
  }
  return context
}

interface RecordingProviderProps {
  children: ReactNode
}

export const RecordingProvider: React.FC<RecordingProviderProps> = ({
  children,
}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  // Initialize audio capture on mount
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        await invoke('init_audio_capture')
        console.log('Audio capture initialized successfully')

        // Check initial recording state
        const initialRecordingState = await invoke('is_recording')
        console.log('Initial recording state:', initialRecordingState)
        setIsRecording(initialRecordingState as boolean)
      } catch (error) {
        console.error('Failed to initialize audio capture:', error)
      }
    }

    initializeAudio()
  }, [])

  // Poll recording state to keep in sync with backend
  useEffect(() => {
    const pollRecordingState = async () => {
      try {
        const backendState = await invoke('is_recording')
        if (backendState !== isRecording) {
          console.log('Syncing recording state:', backendState)
          setIsRecording(backendState as boolean)
        }
      } catch {
        // Ignore errors during polling
      }
    }

    const interval = setInterval(pollRecordingState, 1000) // Check every second
    return () => clearInterval(interval)
  }, [isRecording])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } else {
      setRecordingTime(0)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isRecording])

  // Listen for recording events from tray or backend
  useEffect(() => {
    const handleStartRecording = async () => {
      await startRecordingBackend()
    }

    const handleStopRecording = async () => {
      await stopRecordingBackend()
    }

    const handleToggleRecording = async () => {
      if (isRecording) {
        await stopRecordingBackend()
      } else {
        await startRecordingBackend()
      }
    }

    window.addEventListener('start-recording', handleStartRecording)
    window.addEventListener('stop-recording', handleStopRecording)
    window.addEventListener('toggle-recording', handleToggleRecording)

    return () => {
      window.removeEventListener('start-recording', handleStartRecording)
      window.removeEventListener('stop-recording', handleStopRecording)
      window.removeEventListener('toggle-recording', handleToggleRecording)
    }
  }, [isRecording])

  const startRecordingBackend = async () => {
    try {
      console.log('Starting recording backend...')
      const result = await invoke('start_capture')
      console.log('Recording started:', result)
      setIsRecording(true)
      // Don't emit event here to avoid circular triggers
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const stopRecordingBackend = async () => {
    console.log('Stopping recording and processing to clipboard...')
    setIsProcessing(true)

    // Show processing toast
    const processingToastId = toast('Processing recording...', {
      description: 'Transcribing audio and copying to clipboard',
      duration: Infinity, // Keep it until we're done
    })

    try {
      const result = await invoke('stop_recording_and_process_to_clipboard')
      console.log('Recording processed:', result)

      setIsRecording(false)
      setIsProcessing(false)

      // Dismiss processing toast
      toast.dismiss(processingToastId)

      // Show success toast
      toast.success('Text copied to clipboard!', {
        description: 'Recording transcribed and ready to paste',
        duration: 3000,
      })
    } catch (error) {
      console.error('Failed to process recording:', error)
      console.error('Error type:', typeof error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      setIsProcessing(false)

      // Dismiss processing toast before showing error
      toast.dismiss(processingToastId)

      // Extract detailed error message
      let errorMessage = 'Unknown error occurred'
      if (typeof error === 'string') {
        errorMessage = error
      } else if (error instanceof Error) {
        errorMessage = error.message
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message)
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error)
      }

      // Show error toast with detailed message
      toast.error('Failed to process recording', {
        description: errorMessage,
        duration: 8000, // Longer duration for error messages
      })

      // Only attempt fallback if the error suggests recording wasn't stopped
      // Check if the error is NOT about transcription, profiles, or clipboard
      const isTranscriptionError = errorMessage
        .toLowerCase()
        .includes('transcription')
      const isProfileError = errorMessage.toLowerCase().includes('profile')
      const isClipboardError = errorMessage.toLowerCase().includes('clipboard')
      const isWhisperError = errorMessage.toLowerCase().includes('whisper')
      const isRecordingStillActive =
        errorMessage.toLowerCase().includes('not currently recording') === false

      if (
        !isTranscriptionError &&
        !isProfileError &&
        !isClipboardError &&
        !isWhisperError &&
        isRecordingStillActive
      ) {
        // Only try fallback if it seems like recording might still be active
        try {
          console.log(
            'Attempting fallback stop because recording might still be active...'
          )
          const result = await invoke('stop_capture')
          console.log('Recording stopped (fallback):', result)
          setIsRecording(false)
        } catch (fallbackError) {
          console.error('Fallback stop also failed:', fallbackError)
          // Show additional error if fallback also fails
          toast.error('Critical error: Could not stop recording', {
            description: 'Please restart the application',
            duration: 10000,
          })
        }
      } else {
        // Recording was likely stopped successfully, but later steps failed
        console.log(
          'Recording was stopped successfully, but later processing failed. No fallback needed.'
        )
        setIsRecording(false) // Ensure recording state is correct
      }
    }
  }

  const startRecording = async () => {
    await startRecordingBackend()
  }

  const stopRecording = async () => {
    await stopRecordingBackend()
  }

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording()
    } else {
      await startRecording()
    }
  }

  const value: RecordingContextType = {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    toggleRecording,
    recordingTime,
  }

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  )
}
