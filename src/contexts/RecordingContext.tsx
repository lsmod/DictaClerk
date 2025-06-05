import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { invoke } from '@tauri-apps/api/core'

interface RecordingContextType {
  isRecording: boolean
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
    try {
      console.log('Stopping recording backend...')
      const result = await invoke('stop_capture')
      console.log('Recording stopped:', result)
      setIsRecording(false)
      // Don't emit event here to avoid circular triggers
    } catch (error) {
      console.error('Failed to stop recording:', error)
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
