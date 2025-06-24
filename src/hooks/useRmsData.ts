import { useEffect, useState, useRef, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

interface RmsData {
  /** Current RMS value (0.0 to 1.0) */
  value: number
  /** Timestamp of the last update */
  timestamp: number
  /** Whether we're currently receiving RMS data */
  isActive: boolean
}

interface UseRmsDataOptions {
  /** Whether to throttle updates using requestAnimationFrame (default: true) */
  throttle?: boolean
  /** Initial RMS value when not recording */
  initialValue?: number
}

/**
 * Custom hook to listen to RMS events from the Tauri backend
 * and provide throttled updates for VU meter components.
 */
export const useRmsData = (options: UseRmsDataOptions = {}): RmsData => {
  const { throttle = true, initialValue = 0.0 } = options

  const [rmsData, setRmsData] = useState<RmsData>({
    value: initialValue,
    timestamp: Date.now(),
    isActive: false,
  })

  const frameRequestRef = useRef<number | undefined>(undefined)
  const latestRmsRef = useRef<number>(initialValue)
  const isSubscribedRef = useRef<boolean>(false)
  const isSetupRef = useRef<boolean>(false)

  console.log('🎵 [RMS-HOOK] useRmsData hook called with options:', {
    throttle,
    initialValue,
  })

  // Throttled update function using requestAnimationFrame
  const throttledUpdate = useCallback(() => {
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current)
    }

    frameRequestRef.current = requestAnimationFrame(() => {
      const newValue = latestRmsRef.current
      console.log('🔄 [RMS-HOOK] Throttled update:', {
        newValue,
        timestamp: Date.now(),
      })
      setRmsData((prev) => ({
        ...prev,
        value: newValue,
        timestamp: Date.now(),
      }))
    })
  }, [])

  // Direct update function (no throttling)
  const directUpdate = useCallback((value: number) => {
    console.log('⚡ [RMS-HOOK] Direct update:', {
      value,
      timestamp: Date.now(),
    })
    setRmsData((prev) => ({
      ...prev,
      value,
      timestamp: Date.now(),
    }))
  }, [])

  useEffect(() => {
    console.log('🔥 [RMS-HOOK] useEffect ENTRY - this should always appear!')

    if (isSetupRef.current) {
      console.log('📋 [RMS-HOOK] Setup already in progress, skipping')
      return
    }

    console.log('🔧 [RMS-HOOK] Starting RMS setup effect...')
    isSetupRef.current = true

    let unlistenRms: (() => void) | null = null
    let retryTimeoutId: NodeJS.Timeout | null = null
    let retryCount = 0
    const maxRetries = 10 // Increased retries for first-launch
    let isCleanedUp = false

    const setupRmsListener = async () => {
      if (isCleanedUp) return // Prevent setup after cleanup

      try {
        console.log('🎵 [RMS-HOOK] Setting up RMS listener...', {
          attempt: retryCount + 1,
          maxRetries,
        })

        // Check if audio capture is initialized before subscribing
        try {
          const isRecording = await invoke('is_recording')
          console.log('📊 [RMS-HOOK] Audio capture status check:', {
            isRecording,
          })
        } catch {
          // Audio capture not initialized yet
          if (retryCount < maxRetries) {
            retryCount++
            const retryDelay = Math.min(
              1000 * Math.pow(1.5, retryCount - 1),
              3000
            ) // More aggressive retry
            console.log(
              `🔄 Audio capture not ready, retrying in ${retryDelay}ms... (attempt ${retryCount}/${maxRetries})`
            )
            retryTimeoutId = setTimeout(() => {
              if (!isCleanedUp) setupRmsListener()
            }, retryDelay)
            return
          } else {
            console.error(
              '💥 Max retries reached - audio capture may not be available'
            )
            setRmsData((prev) => ({ ...prev, isActive: false }))
            return
          }
        }

        // Subscribe to RMS updates from backend only if not already subscribed
        if (!isSubscribedRef.current) {
          console.log('📡 [RMS-HOOK] Calling subscribe_rms...')
          await invoke('subscribe_rms')
          console.log('✅ [RMS-HOOK] subscribe_rms successful')
          isSubscribedRef.current = true
          retryCount = 0 // Reset retry count on success
        }

        // Listen for RMS events with better error handling
        console.log('👂 [RMS-HOOK] Setting up RMS event listener...')
        unlistenRms = await listen<number>('rms', (event) => {
          if (isCleanedUp) return // Ignore events after cleanup

          console.log('📊 [RMS-HOOK] Received RMS event:', {
            payload: event.payload,
            timestamp: Date.now(),
            isCleanedUp,
          })
          const rmsValue = event.payload
          latestRmsRef.current = Math.max(0, Math.min(1, rmsValue)) // Clamp to [0, 1]

          console.log('📈 [RMS-HOOK] Processed RMS value:', {
            original: rmsValue,
            clamped: latestRmsRef.current,
          })

          // Update active state
          setRmsData((prev) => {
            console.log('🔄 [RMS-HOOK] Setting RMS data active state')
            return { ...prev, isActive: true }
          })

          // Apply throttling if enabled
          if (throttle) {
            console.log('🎛️ [RMS-HOOK] Using throttled update')
            throttledUpdate()
          } else {
            console.log('⚡ [RMS-HOOK] Using direct update')
            directUpdate(rmsValue)
          }
        })

        console.log('🎉 [RMS-HOOK] RMS event listener set up successfully')
      } catch (error) {
        if (isCleanedUp) return // Ignore errors after cleanup

        console.error('❌ [RMS-HOOK] Failed to set up RMS listener:', error)
        setRmsData((prev) => ({ ...prev, isActive: false }))

        // Retry with exponential backoff if audio capture is not initialized
        if (
          (error === 'Audio capture not initialized' ||
            String(error).includes('not initialized')) &&
          retryCount < maxRetries
        ) {
          retryCount++
          const retryDelay = Math.min(
            1000 * Math.pow(1.5, retryCount - 1),
            3000
          )
          console.log(
            `🔄 Audio capture not ready, retrying in ${retryDelay}ms... (attempt ${retryCount}/${maxRetries})`
          )
          retryTimeoutId = setTimeout(() => {
            if (!isCleanedUp) setupRmsListener()
          }, retryDelay)
        } else if (retryCount >= maxRetries) {
          console.error('💥 Max retries reached for RMS listener setup')
        }
      }
    }

    // Initial setup with shorter delay to reduce first-launch latency
    const initialSetupTimeout = setTimeout(() => {
      console.log(
        '🎵 [RMS-HOOK] Initial setup timeout triggered, starting RMS listener setup...'
      )
      if (!isCleanedUp) setupRmsListener()
    }, 50) // Reduced from 100ms

    // Cleanup function
    return () => {
      console.log('🧹 [RMS-HOOK] Cleaning up RMS hook...')
      isCleanedUp = true

      if (initialSetupTimeout) {
        clearTimeout(initialSetupTimeout)
      }
      if (unlistenRms) {
        unlistenRms()
      }
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current)
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId)
      }
      isSubscribedRef.current = false
      isSetupRef.current = false
    }
  }, [directUpdate, throttle, throttledUpdate]) // Dependencies added to fix linting warning

  // Reset to inactive state when no RMS data received for a while
  useEffect(() => {
    const timeout = setTimeout(() => {
      setRmsData((prev) => {
        if (prev.isActive && Date.now() - prev.timestamp > 2000) {
          return {
            ...prev,
            value: initialValue,
            isActive: false,
          }
        }
        return prev
      })
    }, 2000)

    return () => clearTimeout(timeout)
  }, [rmsData.timestamp, initialValue])

  return rmsData
}

export default useRmsData
