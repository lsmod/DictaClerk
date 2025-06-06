import { useEffect } from 'react'
import { TooltipProvider } from '../components/ui/tooltip'
import { RecordingProvider } from '../contexts/RecordingContext'
import { ProfileProvider } from '../contexts/ProfileContext'
import RecordStopToggleButton from '../components/StopButton'
import ProfileButtons from '../components/ProfileButtons'
import ElapsedTime from '../components/ElapsedTime'
import VolumeVisualizer from '../components/VolumeVisualizer'
import SettingsButton from '../components/SettingsButton'
import { useMainWindowViewModel } from './mainWindow.viewModel'

export default function MainWindow() {
  const { onMount } = useMainWindowViewModel()

  useEffect(onMount, [onMount])

  return (
    <ProfileProvider>
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
    </ProfileProvider>
  )
}
