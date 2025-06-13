import { useCallback } from 'react'
import { useSystemTray } from './hooks/useSystemTray'
import { useBackendCommands } from './hooks/useBackendCommands'
import { invoke } from '@tauri-apps/api/core'

export function useAppViewModel() {
  console.log('🔧 [APP-VIEWMODEL] useAppViewModel hook called')

  const { initializeTray, updateTrayStatus, hideWindow } = useSystemTray()
  const { loadProfiles } = useBackendCommands()

  const closeSettings = useCallback(() => {
    invoke('close_settings_window').catch(console.error)
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

  // NEW: Initialize all backend services for first-launch recording
  const initializeBackendServices = useCallback(async () => {
    try {
      console.log('🚀 [APP-INIT] Starting backend service initialization...')
      console.time('backend-services-init')

      // Initialize state machine first
      console.log('📡 [APP-INIT] Step 1: Initializing state machine...')
      await invoke('init_state_machine')
      console.log('✅ [APP-INIT] State machine initialized successfully')

      // Initialize audio capture early to fix first-launch issue
      console.log('🎙️ [APP-INIT] Step 2: Initializing audio capture...')
      await invoke('init_audio_capture')
      console.log('✅ [APP-INIT] Audio capture initialized successfully')

      // Verify audio capture is working
      console.log('🔍 [APP-INIT] Step 2.1: Verifying audio capture...')
      const isRecording = await invoke('is_recording')
      console.log('📊 [APP-INIT] Audio capture verification:', { isRecording })

      // Skip shortcut manager - it's already initialized elsewhere
      console.log(
        '⌨️ [APP-INIT] Step 3: Skipping shortcut manager (already initialized)...'
      )

      // Initialize system tray
      console.log('🗂️ [APP-INIT] Step 4: Initializing system tray...')
      await invoke('init_system_tray', {
        showStartupNotification: false, // Don't show notification on first launch
        isFirstLaunch: true,
      })
      console.log('✅ [APP-INIT] System tray initialized successfully')

      console.timeEnd('backend-services-init')
      console.log('🎉 [APP-INIT] All backend services initialized successfully')

      // Final verification step
      console.log('🔍 [APP-INIT] Final verification: Checking all services...')
      const finalState = await invoke('get_current_state')
      console.log('📋 [APP-INIT] Final app state:', finalState)
    } catch (error) {
      console.error(
        '❌ [APP-INIT] Failed to initialize backend services:',
        error
      )
      console.error('❌ [APP-INIT] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        error: String(error),
      })
      throw error
    }
  }, [])

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
    console.log('🚀 [APP-MOUNT] onMount called - starting app initialization')
    console.log('🔍 [APP-MOUNT] Current window:', window.location.href)

    const cleanup = setupEventListeners()
    console.log('✅ [APP-MOUNT] Event listeners setup completed')

    // Initialize async operations in PROPER sequence for first-launch recording
    const initializeApp = async () => {
      try {
        console.log('🔄 [APP-MOUNT] Starting async app initialization...')

        // STEP 1: Initialize core backend services FIRST
        console.log(
          '📡 [APP-MOUNT] Step 1: Calling initializeBackendServices...'
        )
        await initializeBackendServices()
        console.log('✅ [APP-MOUNT] Step 1: Backend services initialized')

        // STEP 2: Initialize tray and shortcuts (now using already-initialized services)
        console.log(
          '🗂️ [APP-MOUNT] Step 2: Calling initializeTrayAndShortcuts...'
        )
        await initializeTrayAndShortcuts()
        console.log('✅ [APP-MOUNT] Step 2: Tray and shortcuts initialized')

        // STEP 3: Initialize profiles last
        console.log(
          '👤 [APP-MOUNT] Step 3: Calling initializeBackendAndProfiles...'
        )
        await initializeBackendAndProfiles()
        console.log('✅ [APP-MOUNT] Step 3: Backend and profiles initialized')

        console.log('🎉 [APP-MOUNT] App initialization completed successfully')
      } catch (error) {
        console.error('💥 [APP-MOUNT] App initialization failed:', error)
        console.error('💥 [APP-MOUNT] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          error: String(error),
        })
        // Continue even if some services failed to initialize
      }
    }

    console.log('🚀 [APP-MOUNT] Calling initializeApp...')
    initializeApp()
    console.log(
      '📋 [APP-MOUNT] onMount setup completed, returning cleanup function'
    )
    return cleanup
  }, [
    setupEventListeners,
    initializeBackendServices,
    initializeTrayAndShortcuts,
    initializeBackendAndProfiles,
  ])

  return {
    actions: {
      closeSettings,
    },
    onMount,
  }
}
