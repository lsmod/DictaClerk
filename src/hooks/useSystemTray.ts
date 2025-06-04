import { useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

interface SystemTrayConfig {
  showStartupNotification?: boolean
  globalShortcut?: string
  isFirstLaunch?: boolean
}

interface SystemTrayHook {
  initializeTray: (config?: SystemTrayConfig) => Promise<void>
  showWindow: () => Promise<void>
  hideWindow: () => Promise<void>
  toggleWindow: () => Promise<void>
  updateTrayStatus: (status: string) => Promise<void>
  isWindowHidden: () => Promise<boolean>
}

export const useSystemTray = (): SystemTrayHook => {
  // Initialize system tray
  const initializeTray = useCallback(async (config: SystemTrayConfig = {}) => {
    try {
      await invoke('init_system_tray', {
        showStartupNotification: config.showStartupNotification ?? true,
        globalShortcut: config.globalShortcut ?? 'CmdOrCtrl+Shift+R',
        isFirstLaunch: config.isFirstLaunch ?? false,
      })
      console.log('System tray initialized successfully')
    } catch (error) {
      console.error('Failed to initialize system tray:', error)
      throw error
    }
  }, [])

  // Show main window
  const showWindow = useCallback(async () => {
    try {
      await invoke('show_main_window')
    } catch (error) {
      console.error('Failed to show window:', error)
      throw error
    }
  }, [])

  // Hide main window
  const hideWindow = useCallback(async () => {
    try {
      await invoke('hide_main_window')
    } catch (error) {
      console.error('Failed to hide window:', error)
      throw error
    }
  }, [])

  // Toggle window visibility
  const toggleWindow = useCallback(async () => {
    try {
      await invoke('toggle_main_window')
    } catch (error) {
      console.error('Failed to toggle window:', error)
      throw error
    }
  }, [])

  // Update tray status
  const updateTrayStatus = useCallback(async (status: string) => {
    try {
      await invoke('update_tray_status', { status })
    } catch (error) {
      console.error('Failed to update tray status:', error)
      throw error
    }
  }, [])

  // Check if window is hidden
  const isWindowHidden = useCallback(async (): Promise<boolean> => {
    try {
      return await invoke('is_window_hidden')
    } catch (error) {
      console.error('Failed to check window visibility:', error)
      return false
    }
  }, [])

  // Set up event listeners for tray integration
  useEffect(() => {
    let unlistenStartRecording: (() => void) | null = null
    let unlistenStopRecording: (() => void) | null = null
    let unlistenShowSettings: (() => void) | null = null
    let unlistenToggleRecord: (() => void) | null = null

    const setupEventListeners = async () => {
      try {
        // Listen for start recording from tray
        unlistenStartRecording = await listen(
          'start_recording_from_tray',
          () => {
            console.log('Start recording triggered from tray')
            // Emit custom event for the app to handle
            window.dispatchEvent(new CustomEvent('tray-start-recording'))
          }
        )

        // Listen for stop recording on hide
        unlistenStopRecording = await listen('stop_recording_on_hide', () => {
          console.log('Stop recording triggered on window hide')
          // Emit custom event for the app to handle
          window.dispatchEvent(new CustomEvent('tray-stop-recording'))
        })

        // Listen for show settings (first launch)
        unlistenShowSettings = await listen('show_settings', () => {
          console.log('Show settings triggered from tray')
          // Emit custom event for the app to handle
          window.dispatchEvent(new CustomEvent('tray-show-settings'))
        })

        // Listen for toggle record with tray integration
        unlistenToggleRecord = await listen('toggleRecordWithTray', () => {
          console.log('Toggle record with tray integration triggered')
          // Emit custom event for the app to handle
          window.dispatchEvent(new CustomEvent('tray-toggle-record'))
        })

        console.log('System tray event listeners set up successfully')
      } catch (error) {
        console.error('Failed to set up tray event listeners:', error)
      }
    }

    setupEventListeners()

    // Cleanup function
    return () => {
      if (unlistenStartRecording) unlistenStartRecording()
      if (unlistenStopRecording) unlistenStopRecording()
      if (unlistenShowSettings) unlistenShowSettings()
      if (unlistenToggleRecord) unlistenToggleRecord()
    }
  }, [])

  return {
    initializeTray,
    showWindow,
    hideWindow,
    toggleWindow,
    updateTrayStatus,
    isWindowHidden,
  }
}
