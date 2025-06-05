import { useEffect, useState } from 'react'
import { useSystemTray } from './hooks/useSystemTray'
import { TooltipProvider } from './components/ui/tooltip'
import { RecordingProvider } from './contexts/RecordingContext'
import { ProfileProvider } from './contexts/ProfileContext'
import RecordStopToggleButton from './components/StopButton'
import ProfileButtons from './components/ProfileButtons'
import ElapsedTime from './components/ElapsedTime'
import VolumeVisualizer from './components/VolumeVisualizer'
import SettingsButton from './components/SettingsButton'
import SettingsSheet from './components/SettingsSheet'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

function App() {
  const { initializeTray, updateTrayStatus, hideWindow } = useSystemTray()
  const [isSettingsWindow, setIsSettingsWindow] = useState(false)

  // Check if this is the settings window
  useEffect(() => {
    const checkWindowType = async () => {
      try {
        const currentWindow = getCurrentWebviewWindow()
        const windowLabel = currentWindow.label
        setIsSettingsWindow(windowLabel === 'settings')
      } catch (error) {
        console.error('Failed to get window info:', error)
      }
    }

    checkWindowType()
  }, [])

  // Listen for show-settings event (for settings window)
  useEffect(() => {
    const handleShowSettings = () => {
      setIsSettingsWindow(true)
    }

    window.addEventListener('show-settings', handleShowSettings)

    return () => {
      window.removeEventListener('show-settings', handleShowSettings)
    }
  }, [])

  // Initialize system tray on app startup (only for main window)
  useEffect(() => {
    if (isSettingsWindow) return

    const initTray = async () => {
      try {
        // Check if this is first launch (you might want to store this in settings)
        const isFirstLaunch =
          localStorage.getItem('dicta-clerk-first-launch') === null

        await initializeTray({
          showStartupNotification: !isFirstLaunch,
          globalShortcut: 'CmdOrCtrl+Shift+F9',
          isFirstLaunch,
        })

        // Initialize shortcut manager after tray is set up
        try {
          await invoke('auto_init_shortcut_mgr')
          console.log('Shortcut manager initialized')

          // Debug: Check shortcut status
          try {
            const status = await invoke('get_shortcut_status')
            console.log('Shortcut status:', status)
          } catch (statusError) {
            console.error('Failed to get shortcut status:', statusError)
          }
        } catch (error) {
          console.error('Failed to initialize shortcut manager:', error)
        }

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
  }, [initializeTray, isSettingsWindow])

  // Handle tray events (only for main window)
  useEffect(() => {
    if (isSettingsWindow) return

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

    const handleTrayToggleRecord = async () => {
      console.log('Toggling recording from tray')
      try {
        // Call the backend toggle_record_with_tray command directly
        const result = await invoke('toggle_record_with_tray')
        console.log('Toggle record result:', result)

        // Update UI based on the result
        if (
          typeof result === 'string' &&
          result.includes('Recording started')
        ) {
          updateTrayStatus('Recording')
        } else if (
          typeof result === 'string' &&
          result.includes('Recording stopped')
        ) {
          updateTrayStatus('Ready')
        }
      } catch (error) {
        console.error('Failed to toggle recording:', error)
      }
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
  }, [updateTrayStatus, isSettingsWindow])

  // Handle window close event (minimize to tray) - only for main window
  useEffect(() => {
    if (isSettingsWindow) return

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
  }, [hideWindow, isSettingsWindow])

  // Render settings window content
  if (isSettingsWindow) {
    return (
      <ProfileProvider>
        <TooltipProvider>
          <div className="settings-window">
            <SettingsSheet
              onClose={() => {
                // Close the settings window
                invoke('close_settings_window').catch(console.error)
              }}
            />
          </div>
        </TooltipProvider>
      </ProfileProvider>
    )
  }

  // Render main window content
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

export default App
