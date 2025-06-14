import React, { useEffect } from 'react'
import { useAppStateDemoViewModel } from './appStateDemo.viewModel'

const AppStateDemo: React.FC = () => {
  const { state, actions, onMount } = useAppStateDemoViewModel()

  useEffect(onMount, [])

  return (
    <div className="app-state-demo p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">DictaClerk App State Demo</h1>

      {/* Current State Display */}
      <div className="mb-4 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Current State</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <span
              className={`font-mono ${state.getStatusColor(
                state.appState.status
              )}`}
            >
              {state.getStatusDisplay(state.appState.status)}
            </span>
          </div>

          {state.isRecording && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Recording Time:</span>
              <span className="font-mono text-red-500">
                {state.formatTime(state.appState.recordingTime)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Main Window:</span>
              <span
                className={
                  state.appState.mainWindowVisible
                    ? 'text-green-600'
                    : 'text-gray-400'
                }
              >
                {state.appState.mainWindowVisible ? 'Visible' : 'Hidden'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Modal:</span>
              <span
                className={
                  state.appState.hasModalWindow
                    ? 'text-blue-600'
                    : 'text-gray-400'
                }
              >
                {state.appState.hasModalWindow ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Controls</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={actions.startRecording}
            disabled={!state.canStartRecording}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Start Recording
          </button>

          <button
            onClick={actions.stopRecording}
            disabled={!state.canStopRecording}
            className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Stop Recording
          </button>

          <button
            onClick={actions.cancelRecording}
            disabled={!state.canCancelRecording}
            className="px-4 py-2 bg-orange-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Cancel Processing
          </button>

          <button
            onClick={actions.openSettings}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Open Settings
          </button>

          {state.appState.error && (
            <button
              onClick={actions.acknowledgeError}
              className="px-4 py-2 bg-purple-500 text-white rounded"
            >
              Acknowledge Error
            </button>
          )}
        </div>
      </div>

      {/* Processing Data */}
      {state.showProcessingData && (
        <div className="mb-4 p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Processing Data</h2>
          <div className="space-y-3">
            {state.appState.originalTranscript && (
              <div>
                <h3 className="font-medium text-sm text-gray-600 mb-1">
                  Original Transcript:
                </h3>
                <div className="p-2 bg-gray-50 rounded text-sm">
                  {state.appState.originalTranscript}
                </div>
              </div>
            )}

            {state.appState.finalText && (
              <div>
                <h3 className="font-medium text-sm text-gray-600 mb-1">
                  Final Text:
                </h3>
                <div className="p-2 bg-green-50 rounded text-sm">
                  {state.appState.finalText}
                </div>
                {state.appState.profileId && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => actions.reformatWithProfile('2')}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                    >
                      Reformat with Profile 2
                    </button>
                    <button
                      onClick={() => actions.reformatWithProfile('3')}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                    >
                      Reformat with Profile 3
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw State (JSON) */}
      <div className="p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Raw State (JSON)</h2>
        <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64">
          {JSON.stringify(state.appState, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export default AppStateDemo
