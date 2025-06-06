import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export function useSettingsWindowViewModel() {
  const closeSettings = useCallback(() => {
    invoke('close_settings_window').catch(console.error)
  }, [])

  const handleShowSettings = useCallback(() => {
    // Settings window specific logic can be added here
    console.log('Settings window mounted')
  }, [])

  const setupEventListeners = useCallback(() => {
    window.addEventListener('show-settings', handleShowSettings)

    return () => {
      window.removeEventListener('show-settings', handleShowSettings)
    }
  }, [handleShowSettings])

  const onMount = useCallback(() => {
    const cleanup = setupEventListeners()
    return cleanup
  }, [setupEventListeners])

  return {
    state: {},
    actions: {
      closeSettings,
    },
    onMount,
  }
}
