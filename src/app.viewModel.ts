import { useState, useCallback } from 'react'
import { useSystemTray } from './hooks/useSystemTray'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

export function useAppViewModel() {
  const { initializeTray, updateTrayStatus, hideWindow } = useSystemTray()
  const [isSettingsWindow, setIsSettingsWindow] = useState(false)

  const closeSettings = useCallback(() => {
    invoke('close_settings_window').catch(console.error)
  }, [])

  const checkWindowType = useCallback(async () => {
    try {
      const currentWindow = getCurrentWebviewWindow()
      const windowLabel = currentWindow.label
      setIsSettingsWindow(windowLabel === 'settings')
    } catch (error) {
      console.error('Failed to get window info:', error)
    }
  }, [])

  const handleShowSettings = useCallback(() => {
    setIsSettingsWindow(true)
  }, [])

  const handleTrayStartRecording = useCallback(() => {
    console.log('Starting recording from tray')
    updateTrayStatus('Recording')
    window.dispatchEvent(new CustomEvent('start-recording'))
  }, [updateTrayStatus])

  const handleTrayStopRecording = useCallback(() => {
    console.log('Stopping recording from tray')
    updateTrayStatus('Ready')
    window.dispatchEvent(new CustomEvent('stop-recording'))
  }, [updateTrayStatus])

  const handleTrayToggleRecord = useCallback(async () => {
    console.log('Toggling recording from tray')
    try {
      const result = await invoke('toggle_record_with_tray')
      console.log('Toggle record result:', result)

      if (typeof result === 'string' && result.includes('Recording started')) {
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
  }, [updateTrayStatus])

  const handleTrayShowSettings = useCallback(() => {
    console.log('Showing settings from tray')
    window.dispatchEvent(new CustomEvent('show-settings'))
  }, [])

  const handleBeforeUnload = useCallback(
    async (e: BeforeUnloadEvent) => {
      e.preventDefault()
      try {
        await hideWindow()
      } catch (error) {
        console.error('Failed to hide window:', error)
      }
    },
    [hideWindow]
  )

  const initializeTrayAndShortcuts = useCallback(async () => {
    if (isSettingsWindow) return

    try {
      const isFirstLaunch =
        localStorage.getItem('dicta-clerk-first-launch') === null

      await initializeTray({
        showStartupNotification: !isFirstLaunch,
        globalShortcut: 'CmdOrCtrl+Shift+F9',
        isFirstLaunch,
      })

      try {
        await invoke('auto_init_shortcut_mgr')
        console.log('Shortcut manager initialized')

        try {
          const status = await invoke('get_shortcut_status')
          console.log('Shortcut status:', status)
        } catch (statusError) {
          console.error('Failed to get shortcut status:', statusError)
        }
      } catch (error) {
        console.error('Failed to initialize shortcut manager:', error)
      }

      if (isFirstLaunch) {
        localStorage.setItem('dicta-clerk-first-launch', 'false')
      }

      console.log('System tray initialized')
    } catch (error) {
      console.error('Failed to initialize system tray:', error)
    }
  }, [initializeTray, isSettingsWindow])

  const setupEventListeners = useCallback(() => {
    // Check window type
    checkWindowType()

    // Listen for show-settings event (for settings window)
    window.addEventListener('show-settings', handleShowSettings)

    // Handle tray events (only for main window)
    if (!isSettingsWindow) {
      window.addEventListener('tray-start-recording', handleTrayStartRecording)
      window.addEventListener('tray-stop-recording', handleTrayStopRecording)
      window.addEventListener('tray-toggle-record', handleTrayToggleRecord)
      window.addEventListener('tray-show-settings', handleTrayShowSettings)
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    return () => {
      window.removeEventListener('show-settings', handleShowSettings)
      if (!isSettingsWindow) {
        window.removeEventListener(
          'tray-start-recording',
          handleTrayStartRecording
        )
        window.removeEventListener(
          'tray-stop-recording',
          handleTrayStopRecording
        )
        window.removeEventListener('tray-toggle-record', handleTrayToggleRecord)
        window.removeEventListener('tray-show-settings', handleTrayShowSettings)
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [
    checkWindowType,
    handleShowSettings,
    handleTrayStartRecording,
    handleTrayStopRecording,
    handleTrayToggleRecord,
    handleTrayShowSettings,
    handleBeforeUnload,
    isSettingsWindow,
  ])

  const onMount = useCallback(() => {
    const cleanup = setupEventListeners()
    initializeTrayAndShortcuts()
    return cleanup
  }, [setupEventListeners, initializeTrayAndShortcuts])

  return {
    state: {
      isSettingsWindow,
    },
    actions: {
      closeSettings,
    },
    onMount,
  }
}
