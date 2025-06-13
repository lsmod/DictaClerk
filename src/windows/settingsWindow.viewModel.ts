import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export function useSettingsWindowViewModel() {
  const closeSettings = useCallback(() => {
    invoke('close_settings_window').catch(console.error)
  }, [])

  // No event listeners in settings window - state comes from Redux
  // Main window handles all backend event listening and updates Redux store
  // Settings window consumes state via Redux selectors

  const onMount = useCallback(() => {
    // Settings window initialization (no event listeners)
    console.log('Settings window mounted - using Redux for state management')

    // Return no cleanup function since we have no event listeners
    return () => {
      // No cleanup needed
    }
  }, [])

  return {
    state: {},
    actions: {
      closeSettings,
    },
    onMount,
  }
}
