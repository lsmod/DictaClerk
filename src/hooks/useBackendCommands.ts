import { useEffect, useRef, useMemo } from 'react'
import { useAppDispatch } from '../store/hooks'
import { setupBackendSync, BackendCommands } from '../store/backendSync'

export const useBackendCommands = (): BackendCommands => {
  const dispatch = useAppDispatch()
  const commandsRef = useRef<BackendCommands | null>(null)
  const isInitializingRef = useRef<boolean>(false)

  console.log('🔗 [BACKEND-COMMANDS] useBackendCommands hook called')

  useEffect(() => {
    console.log(
      '🔥 [BACKEND-COMMANDS] useEffect ENTRY - this should always appear!'
    )
    console.log('🔧 [BACKEND-COMMANDS] useEffect triggered, current state:', {
      hasCommands: !!commandsRef.current,
      isInitializing: isInitializingRef.current,
      dispatch: !!dispatch,
    })

    if (!commandsRef.current && !isInitializingRef.current) {
      console.log('🚀 [BACKEND-COMMANDS] Starting backend sync setup...')
      isInitializingRef.current = true

      try {
        commandsRef.current = setupBackendSync(dispatch)
        console.log(
          '✅ [BACKEND-COMMANDS] Backend sync setup completed successfully:',
          {
            hasStartRecording: !!commandsRef.current.startRecording,
            hasStopRecording: !!commandsRef.current.stopRecording,
          }
        )
      } catch (error) {
        console.error(
          '❌ [BACKEND-COMMANDS] Failed to setup backend sync:',
          error
        )
      } finally {
        isInitializingRef.current = false
      }
    } else if (commandsRef.current) {
      console.log(
        '📋 [BACKEND-COMMANDS] Commands already exist, skipping setup'
      )
    } else if (isInitializingRef.current) {
      console.log('⏳ [BACKEND-COMMANDS] Already initializing, skipping')
    }
  }, [dispatch])

  // Memoize the fallback commands to prevent re-creation
  const fallbackCommands = useMemo<BackendCommands>(
    () => ({
      startRecording: async () => {
        console.warn(
          '⚠️ [BACKEND-COMMANDS] Fallback startRecording called - commands not initialized!'
        )
      },
      stopRecording: async () => {
        console.warn(
          '⚠️ [BACKEND-COMMANDS] Fallback stopRecording called - commands not initialized!'
        )
      },
      cancelRecording: async () => {},
      openSettings: async () => {},
      closeSettings: async () => {},
      acknowledgeError: async () => {},
      reformatWithProfile: async () => {},
      showMainWindow: async () => {},
      hideMainWindow: async () => {},
      loadProfiles: async () => {},
      selectProfile: async () => {},
      saveProfiles: async () => {},
      clearClipboardHistory: async () => {},
      enableAutoRecovery: async () => {},
      disableAutoRecovery: async () => {},
      retryConnection: async () => {},
      getClipboardHistory: async () => {},
    }),
    []
  )

  const isUsingFallback = !commandsRef.current
  console.log('🔍 [BACKEND-COMMANDS] Returning commands:', {
    isUsingFallback,
    hasCommands: !!commandsRef.current,
  })

  return commandsRef.current || fallbackCommands
}
