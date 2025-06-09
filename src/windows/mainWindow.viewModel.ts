import { useCallback } from 'react'
import { useSystemTray } from '../hooks/useSystemTray'
import { invoke } from '@tauri-apps/api/core'

export function useMainWindowViewModel() {
  const { initializeTray, updateTrayStatus, hideWindow } = useSystemTray()

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

      // Initialize Whisper and GPT clients if API key is available
      try {
        const settings = await invoke('load_settings')
        console.log('Loaded settings for client initialization')

        if (settings && typeof settings === 'object' && 'whisper' in settings) {
          const whisperSettings = settings.whisper as { api_key?: string }
          if (
            whisperSettings.api_key &&
            whisperSettings.api_key.trim() !== ''
          ) {
            // Initialize Whisper client
            await invoke('init_whisper_client', {
              apiKey: whisperSettings.api_key,
            })
            console.log('Whisper client initialized successfully')

            // Initialize GPT client with the same API key
            try {
              await invoke('init_gpt_client', {
                apiKey: whisperSettings.api_key,
              })
              console.log('GPT client initialized successfully')
            } catch (gptError) {
              console.warn(
                'GPT client initialization failed (non-critical):',
                gptError
              )
            }
          } else {
            console.log('No API key found in settings, clients not initialized')
          }
        }
      } catch (error) {
        console.error('Failed to initialize clients:', error)
      }

      // Initialize clipboard service
      try {
        await invoke('init_clipboard_service')
        console.log('Clipboard service initialized successfully')
      } catch (error) {
        console.error('Failed to initialize clipboard service:', error)
      }

      if (isFirstLaunch) {
        localStorage.setItem('dicta-clerk-first-launch', 'false')
      }

      console.log('System tray initialized')
    } catch (error) {
      console.error('Failed to initialize system tray:', error)
    }
  }, [initializeTray])

  const setupEventListeners = useCallback(() => {
    window.addEventListener('tray-start-recording', handleTrayStartRecording)
    window.addEventListener('tray-stop-recording', handleTrayStopRecording)
    window.addEventListener('tray-toggle-record', handleTrayToggleRecord)
    window.addEventListener('tray-show-settings', handleTrayShowSettings)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener(
        'tray-start-recording',
        handleTrayStartRecording
      )
      window.removeEventListener('tray-stop-recording', handleTrayStopRecording)
      window.removeEventListener('tray-toggle-record', handleTrayToggleRecord)
      window.removeEventListener('tray-show-settings', handleTrayShowSettings)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [
    handleTrayStartRecording,
    handleTrayStopRecording,
    handleTrayToggleRecord,
    handleTrayShowSettings,
    handleBeforeUnload,
  ])

  const onMount = useCallback(() => {
    const cleanup = setupEventListeners()
    initializeTrayAndShortcuts()
    return cleanup
  }, [setupEventListeners, initializeTrayAndShortcuts])

  return {
    state: {},
    actions: {},
    onMount,
  }
}
