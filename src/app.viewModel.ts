import { useCallback } from 'react'
import { useSystemTray } from './hooks/useSystemTray'
import { useBackendCommands } from './hooks/useBackendCommands'
import { useAppSelector } from './store/hooks'
import { invoke } from '@tauri-apps/api/core'

export function useAppViewModel() {
  const { initializeTray, updateTrayStatus, hideWindow } = useSystemTray()
  const { loadProfiles } = useBackendCommands()

  // Use Redux state instead of URL-based detection
  const windowState = useAppSelector((state) => state.app.windowState)
  const isSettingsWindow = windowState.settingsWindow.visible

  const closeSettings = useCallback(() => {
    invoke('close_settings_window').catch(console.error)
  }, [])

  // Remove URL-based window type detection - use Redux state machine events instead
  // Window selection is now driven by backend state machine through Redux

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
    try {
      await initializeTray()
      console.log('Tray and shortcuts initialized')
    } catch (error) {
      console.error('Failed to initialize tray and shortcuts:', error)
    }
  }, [initializeTray])

  const initializeBackendAndProfiles = useCallback(async () => {
    try {
      await loadProfiles()
      console.log('Backend and profiles initialized')
    } catch (error) {
      console.error('Failed to initialize backend and profiles:', error)
    }
  }, [loadProfiles])

  // Centralized event listener setup - only for main window
  // Settings window no longer sets up event listeners
  const setupEventListeners = useCallback(() => {
    // Handle tray events (centralized in main window)
    window.addEventListener('tray-start-recording', handleTrayStartRecording)
    window.addEventListener('tray-stop-recording', handleTrayStopRecording)
    window.addEventListener('tray-show-settings', handleTrayShowSettings)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener(
        'tray-start-recording',
        handleTrayStartRecording
      )
      window.removeEventListener('tray-stop-recording', handleTrayStopRecording)
      window.removeEventListener('tray-show-settings', handleTrayShowSettings)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [
    handleTrayStartRecording,
    handleTrayStopRecording,
    handleTrayShowSettings,
    handleBeforeUnload,
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
