import React from 'react'
import { ReduxProvider } from '../components/ReduxProvider'
import { AppStateDemo } from '../components/AppStateDemo'

/**
 * Example of how to integrate Redux state management into your app
 *
 * 1. Wrap your app with ReduxProvider
 * 2. Use useAppSelector and useAppDispatch hooks in components
 * 3. Use useBackendCommands hook for backend interactions
 */
export const ReduxIntegrationExample: React.FC = () => {
  return (
    <ReduxProvider>
      <div className="min-h-screen bg-gray-50">
        <AppStateDemo />
      </div>
    </ReduxProvider>
  )
}

/**
 * Example of a component using Redux state management
 */
import { useAppSelector } from '../store/hooks'
import { useBackendCommands } from '../hooks/useBackendCommands'

export const RecordingButton: React.FC = () => {
  const { status, recordingTime } = useAppSelector((state) => state.app)
  const { startRecording, stopRecording } = useBackendCommands()

  const isRecording = status === 'recording'
  const isProcessing = status.startsWith('processing')

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`px-6 py-3 rounded-full font-semibold transition-colors ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300'
        }`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>

      {isRecording && (
        <div className="text-red-500 font-mono">
          {Math.floor(recordingTime / 1000)}s
        </div>
      )}

      {isProcessing && <div className="text-blue-500">Processing...</div>}
    </div>
  )
}

/**
 * Example of error handling component
 */
export const ErrorHandler: React.FC = () => {
  const { error, status } = useAppSelector((state) => state.app)
  const { acknowledgeError } = useBackendCommands()

  if (!error || !status.startsWith('error-')) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 max-w-md p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs">!</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {status.replace('error-', '').replace('-', ' ')} Error
          </h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button
            onClick={acknowledgeError}
            className="mt-2 text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
