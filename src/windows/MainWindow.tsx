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

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow Escape to focus the main interface
    if (e.key === 'Escape') {
      const mainInterface = document.querySelector('.synth-interface')
      if (mainInterface instanceof HTMLElement) {
        mainInterface.focus()
      }
    }

    // Space or Enter on main interface triggers record toggle
    if ((e.key === ' ' || e.key === 'Enter') && e.target === e.currentTarget) {
      e.preventDefault()
      const recordButton = document.querySelector('.record-stop-toggle')
      if (recordButton instanceof HTMLElement) {
        recordButton.click()
      }
    }
  }

  return (
    <ProfileProvider>
      <RecordingProvider>
        <TooltipProvider>
          {/* ARIA live region for announcements */}
          <div
            id="main-live-region"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          />

          <main
            className="synth-interface"
            data-tauri-drag-region
            role="application"
            aria-label="DictaClerk - Voice Recording Interface"
            aria-describedby="main-description"
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            {/* Hidden description for screen readers */}
            <div id="main-description" className="sr-only">
              Voice recording application. Use Space or Enter to start/stop
              recording. Navigate with Tab to access settings and profile
              buttons. Press Escape to return focus to main interface.
            </div>

            <header className="synth-header" role="banner">
              <nav aria-label="Application settings">
                <SettingsButton />
              </nav>
            </header>

            <section
              className="main-controls"
              role="main"
              aria-label="Recording controls"
            >
              <div className="volume-section">
                <VolumeVisualizer />
                <ElapsedTime />
              </div>
              <RecordStopToggleButton />
            </section>

            <section
              className="profile-section"
              role="navigation"
              aria-label="Profile selection"
            >
              <ProfileButtons />
            </section>
          </main>
        </TooltipProvider>
      </RecordingProvider>
    </ProfileProvider>
  )
}
