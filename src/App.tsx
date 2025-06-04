import { useEffect } from 'react'
import { useSystemTray } from './hooks/useSystemTray'
import { TooltipProvider } from './components/ui/tooltip'
import StopButton from './components/StopButton'
import ProfileButtons from './components/ProfileButtons'
import ElapsedTime from './components/ElapsedTime'
import VolumeVisualizer from './components/VolumeVisualizer'
import SettingsButton from './components/SettingsButton'

function App() {
  const { initializeTray, updateTrayStatus, hideWindow } = useSystemTray()

  // Initialize system tray on app startup
  useEffect(() => {
    const initTray = async () => {
      try {
        // Check if this is first launch (you might want to store this in settings)
        const isFirstLaunch =
          localStorage.getItem('dicta-clerk-first-launch') === null

        await initializeTray({
          showStartupNotification: !isFirstLaunch,
          globalShortcut: 'CmdOrCtrl+Shift+R',
          isFirstLaunch,
        })

        // Mark as not first launch anymore
        if (isFirstLaunch) {
          localStorage.setItem('dicta-clerk-first-launch', 'false')
        }

        console.log('System tray initialized')
      } catch (error) {
        console.error('Failed to initialize system tray:', error)
      }
    }

    initTray()
  }, [initializeTray])

  // Handle tray events
  useEffect(() => {
    const handleTrayStartRecording = () => {
      console.log('Starting recording from tray')
      updateTrayStatus('Recording')
      // Emit event to start recording in the existing components
      window.dispatchEvent(new CustomEvent('start-recording'))
    }

    const handleTrayStopRecording = () => {
      console.log('Stopping recording from tray')
      updateTrayStatus('Ready')
      // Emit event to stop recording in the existing components
      window.dispatchEvent(new CustomEvent('stop-recording'))
    }

    const handleTrayToggleRecord = () => {
      console.log('Toggling recording from tray')
      // Emit event to toggle recording in the existing components
      window.dispatchEvent(new CustomEvent('toggle-recording'))
    }

    const handleTrayShowSettings = () => {
      console.log('Showing settings from tray')
      // Emit event to show settings in the existing components
      window.dispatchEvent(new CustomEvent('show-settings'))
    }

    // Add event listeners
    window.addEventListener('tray-start-recording', handleTrayStartRecording)
    window.addEventListener('tray-stop-recording', handleTrayStopRecording)
    window.addEventListener('tray-toggle-record', handleTrayToggleRecord)
    window.addEventListener('tray-show-settings', handleTrayShowSettings)

    // Cleanup
    return () => {
      window.removeEventListener(
        'tray-start-recording',
        handleTrayStartRecording
      )
      window.removeEventListener('tray-stop-recording', handleTrayStopRecording)
      window.removeEventListener('tray-toggle-record', handleTrayToggleRecord)
      window.removeEventListener('tray-show-settings', handleTrayShowSettings)
    }
  }, [updateTrayStatus])

  // Handle window close event (minimize to tray)
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      e.preventDefault()
      try {
        await hideWindow()
      } catch (error) {
        console.error('Failed to hide window:', error)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hideWindow])

  return (
    <TooltipProvider>
      <div className="synth-interface">
        <div className="synth-header">
          <SettingsButton />
        </div>

        <div className="main-controls">
          <div className="volume-section">
            <VolumeVisualizer />
            <ElapsedTime />
          </div>
          <StopButton />
        </div>

        <ProfileButtons />
      </div>
    </TooltipProvider>
  )
}

export default App
