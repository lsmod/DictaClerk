import { useEffect } from 'react'
import { TooltipProvider } from './components/ui/tooltip'
import { RecordingProvider } from './contexts/RecordingContext'
import { ProfileProvider } from './contexts/ProfileContext'
import RecordStopToggleButton from './components/StopButton'
import ProfileButtons from './components/ProfileButtons'
import ElapsedTime from './components/ElapsedTime'
import VolumeVisualizer from './components/VolumeVisualizer'
import SettingsButton from './components/SettingsButton'
import SettingsSheet from './components/SettingsSheet'
import { useAppViewModel } from './app.viewModel'

function App() {
  const { state, actions, onMount } = useAppViewModel()

  useEffect(onMount, [onMount])

  return (
    <ProfileProvider>
      {state.isSettingsWindow ? (
        <TooltipProvider>
          <div className="settings-window">
            <SettingsSheet onClose={actions.closeSettings} />
          </div>
        </TooltipProvider>
      ) : (
        <RecordingProvider>
          <TooltipProvider>
            <div className="synth-interface" data-tauri-drag-region>
              <div className="synth-header">
                <SettingsButton />
              </div>

              <div className="main-controls">
                <div className="volume-section">
                  <VolumeVisualizer />
                  <ElapsedTime />
                </div>
                <RecordStopToggleButton />
              </div>

              <ProfileButtons />
            </div>
          </TooltipProvider>
        </RecordingProvider>
      )}
    </ProfileProvider>
  )
}

export default App
