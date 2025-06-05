import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'

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
    const handleStartRecording = () => {
      setIsRecording(true)
    }

    const handleStopRecording = () => {
      setIsRecording(false)
    }

    const handleToggleRecording = () => {
      setIsRecording((prev) => !prev)
    }

    window.addEventListener('start-recording', handleStartRecording)
    window.addEventListener('stop-recording', handleStopRecording)
    window.addEventListener('toggle-recording', handleToggleRecording)

    return () => {
      window.removeEventListener('start-recording', handleStartRecording)
      window.removeEventListener('stop-recording', handleStopRecording)
      window.removeEventListener('toggle-recording', handleToggleRecording)
    }
  }, [])

  const startRecording = () => {
    setIsRecording(true)
    // Emit event for other components or backend
    window.dispatchEvent(new CustomEvent('start-recording'))
  }

  const stopRecording = () => {
    setIsRecording(false)
    // Emit event for other components or backend
    window.dispatchEvent(new CustomEvent('stop-recording'))
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
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
