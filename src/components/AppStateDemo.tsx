import React, { useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { useBackendCommands } from '../hooks/useBackendCommands'
import { updateRecordingTime } from '../store/slices/appSlice'

export const AppStateDemo: React.FC = () => {
  const dispatch = useAppDispatch()
  const appState = useAppSelector((state) => state.app)
  const backendCommands = useBackendCommands()

  // Update recording time every second when recording
  useEffect(() => {
    if (appState.status === 'recording') {
      const interval = setInterval(() => {
        dispatch(updateRecordingTime())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [appState.status, dispatch])

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string): string => {
    if (status === 'recording') return 'text-red-500'
    if (status.startsWith('processing')) return 'text-blue-500'
    if (status.startsWith('error')) return 'text-red-600'
    if (status === 'processing-complete') return 'text-green-500'
    return 'text-gray-600'
  }

  const getStatusDisplay = (status: string): string => {
    return status
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Redux State Management Demo</h1>

      {/* Connection Status */}
      <div className="mb-4 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Backend Connection</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              appState.backendConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span>
            {appState.backendConnected ? 'Connected' : 'Disconnected'}
          </span>
          {appState.lastBackendSync > 0 && (
            <span className="text-sm text-gray-500 ml-2">
              Last sync:{' '}
              {new Date(appState.lastBackendSync).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Current State */}
      <div className="mb-4 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Current State</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <span className={`font-mono ${getStatusColor(appState.status)}`}>
              {getStatusDisplay(appState.status)}
            </span>
          </div>

          {appState.status === 'recording' && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Recording Time:</span>
              <span className="font-mono text-red-500">
                {formatTime(appState.recordingTime)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Main Window:</span>
              <span
                className={
                  appState.mainWindowVisible
                    ? 'text-green-600'
                    : 'text-gray-400'
                }
              >
                {appState.mainWindowVisible ? 'Visible' : 'Hidden'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Modal:</span>
              <span
                className={
                  appState.hasModalWindow ? 'text-blue-600' : 'text-gray-400'
                }
              >
                {appState.hasModalWindow ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Data */}
      {(appState.originalTranscript || appState.finalText) && (
        <div className="mb-4 p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Processing Data</h2>
          <div className="space-y-2">
            {appState.originalTranscript && (
              <div>
                <span className="font-medium">Original Transcript:</span>
                <p className="text-sm bg-gray-100 p-2 rounded mt-1">
                  {appState.originalTranscript}
                </p>
              </div>
            )}
            {appState.finalText && (
              <div>
                <span className="font-medium">Final Text:</span>
                <p className="text-sm bg-blue-50 p-2 rounded mt-1">
                  {appState.finalText}
                </p>
              </div>
            )}
            {appState.profileId && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Profile:</span>
                <span className="font-mono text-blue-600">
                  {appState.profileId}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {appState.error && (
        <div className="mb-4 p-4 border border-red-300 bg-red-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2 text-red-700">Error</h2>
          <p className="text-red-600">{appState.error}</p>
          <button
            onClick={backendCommands.acknowledgeError}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Acknowledge Error
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="mb-4 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Controls</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={backendCommands.startRecording}
            disabled={
              appState.status === 'recording' ||
              appState.status.startsWith('processing')
            }
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Start Recording
          </button>

          <button
            onClick={backendCommands.stopRecording}
            disabled={appState.status !== 'recording'}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Stop Recording
          </button>

          <button
            onClick={backendCommands.cancelRecording}
            disabled={appState.status !== 'recording'}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Cancel Recording
          </button>

          <button
            onClick={backendCommands.openSettings}
            disabled={appState.hasModalWindow}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Open Settings
          </button>

          <button
            onClick={backendCommands.closeSettings}
            disabled={appState.status !== 'settings-open'}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Close Settings
          </button>

          <button
            onClick={() => backendCommands.reformatWithProfile('new-profile')}
            disabled={appState.status !== 'processing-complete'}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Reformat Text
          </button>
        </div>
      </div>

      {/* Window Controls */}
      <div className="p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Window Controls</h2>
        <div className="flex gap-2">
          <button
            onClick={backendCommands.showMainWindow}
            disabled={appState.mainWindowVisible}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Show Main Window
          </button>

          <button
            onClick={backendCommands.hideMainWindow}
            disabled={
              !appState.mainWindowVisible || appState.status === 'recording'
            }
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Hide Main Window
          </button>
        </div>
      </div>
    </div>
  )
}
