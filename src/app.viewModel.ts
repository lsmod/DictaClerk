import { useState, useCallback } from 'react'
import { useSystemTray } from './hooks/useSystemTray'
import { useBackendCommands } from './hooks/useBackendCommands'
import { invoke } from '@tauri-apps/api/core'

export function useAppViewModel() {
  const { initializeTray, updateTrayStatus, hideWindow } = useSystemTray()
  const { loadProfiles } = useBackendCommands()
  const [isSettingsWindow, setIsSettingsWindow] = useState(false)

  const closeSettings = useCallback(() => {
    invoke('close_settings_window').catch(console.error)
  }, [])

  const checkWindowType = useCallback(async () => {
    try {
      // Simple window type detection based on URL or location
      const currentUrl = window.location.href
      const isSettings =
        currentUrl.includes('settings') ||
        window.location.hash.includes('settings')
      setIsSettingsWindow(isSettings)
    } catch (error) {
      console.error('Failed to get window info:', error)
      // Default to main window if detection fails
      setIsSettingsWindow(false)
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

  const initializeBackendAndProfiles = useCallback(async () => {
    // Load profiles on app startup
    try {
      await loadProfiles()
      console.log('Profiles loaded successfully')
    } catch (error) {
      console.error('Failed to load profiles:', error)
    }
  }, [loadProfiles])

  const setupEventListeners = useCallback(() => {
    // Check window type
    checkWindowType()

    // Listen for show-settings event (for settings window)
    window.addEventListener('show-settings', handleShowSettings)

    // Handle tray events (only for main window)
    if (!isSettingsWindow) {
      window.addEventListener('tray-start-recording', handleTrayStartRecording)
      window.addEventListener('tray-stop-recording', handleTrayStopRecording)
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
        window.removeEventListener('tray-show-settings', handleTrayShowSettings)
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [
    checkWindowType,
    handleShowSettings,
    handleTrayStartRecording,
    handleTrayStopRecording,
    handleTrayShowSettings,
    handleBeforeUnload,
    isSettingsWindow,
  ])

  const onMount = useCallback(() => {
    const cleanup = setupEventListeners()

    // Initialize async operations in sequence
    const initializeApp = async () => {
      try {
        await initializeTrayAndShortcuts()
        await initializeBackendAndProfiles()
        console.log('App initialization completed')
      } catch (error) {
        console.error('App initialization failed:', error)
      }
    }

    initializeApp()
    return cleanup
  }, [
    setupEventListeners,
    initializeTrayAndShortcuts,
    initializeBackendAndProfiles,
  ])

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
