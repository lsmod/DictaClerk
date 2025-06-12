import { useEffect } from 'react'
import { TooltipProvider } from '../components/ui/tooltip'
import RecordStopToggleButton from '../components/StopButton'
import ProfileButtons from '../components/ProfileButtons'
import ElapsedTime from '../components/ElapsedTime'
import VolumeVisualizer from '../components/VolumeVisualizer'
import SettingsButton from '../components/SettingsButton'
import ErrorDisplay from '../components/ErrorDisplay'
import { useMainWindowViewModel } from './mainWindow.viewModel'
import { Toaster } from '@/components/ui/sonner'

export default function MainWindow() {
  const { onMount } = useMainWindowViewModel()

  useEffect(onMount, [onMount])

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow Escape to focus the record button for accessibility
    if (e.key === 'Escape') {
      const recordButton = document.querySelector(
        '.record-stop-button'
      ) as HTMLElement
      if (recordButton) {
        recordButton.focus()
      }
    }
  }

  return (
    <TooltipProvider>
      <div
        className="synth-interface"
        data-tauri-drag-region
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        aria-label="DictaClerk main application window"
      >
        {/* Live region for screen reader announcements */}
        <div
          id="main-live-region"
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />

        {/* Error Display */}
        <ErrorDisplay />

        {/* Header with Settings */}
        <div className="synth-header">
          <SettingsButton />
        </div>

        {/* Main Controls Section */}
        <div className="main-controls">
          <div className="volume-section">
            <VolumeVisualizer />
            <ElapsedTime />
          </div>
          <RecordStopToggleButton />
        </div>

        {/* Profile Selection */}
        <div className="profile-section">
          <ProfileButtons />
        </div>

        {/* Toast notifications */}
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
