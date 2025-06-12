import { useEffect, useRef } from 'react'
import { useAppDispatch } from '../store/hooks'
import { setupBackendSync, BackendCommands } from '../store/backendSync'

export const useBackendCommands = (): BackendCommands => {
  const dispatch = useAppDispatch()
  const commandsRef = useRef<BackendCommands | null>(null)

  useEffect(() => {
    if (!commandsRef.current) {
      commandsRef.current = setupBackendSync(dispatch)
    }
  }, [dispatch])

  // Return a stable reference to commands
  return (
    commandsRef.current || {
      startRecording: async () => {},
      stopRecording: async () => {},
      cancelRecording: async () => {},
      openSettings: async () => {},
      closeSettings: async () => {},
      acknowledgeError: async () => {},
      reformatWithProfile: async () => {},
      showMainWindow: async () => {},
      hideMainWindow: async () => {},

      // Profile management commands
      loadProfiles: async () => {},
      selectProfile: async () => {},
      saveProfiles: async () => {},

      // Advanced features
      clearClipboardHistory: async () => {},
      enableAutoRecovery: async () => {},
      disableAutoRecovery: async () => {},
      retryConnection: async () => {},
      getClipboardHistory: async () => {},
    }
  )
}
