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

  // Throttled update function using requestAnimationFrame
  const throttledUpdate = useCallback(() => {
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current)
    }

    frameRequestRef.current = requestAnimationFrame(() => {
      setRmsData((prev) => ({
        ...prev,
        value: latestRmsRef.current,
        timestamp: Date.now(),
      }))
    })
  }, [])

  // Direct update function (no throttling)
  const directUpdate = useCallback((value: number) => {
    setRmsData((prev) => ({
      ...prev,
      value,
      timestamp: Date.now(),
    }))
  }, [])

  useEffect(() => {
    let unlistenRms: (() => void) | null = null
    let retryTimeoutId: NodeJS.Timeout | null = null

    const setupRmsListener = async () => {
      try {
        console.log('Setting up RMS listener...')

        // Subscribe to RMS updates from backend
        if (!isSubscribedRef.current) {
          console.log('Calling subscribe_rms...')
          await invoke('subscribe_rms')
          console.log('subscribe_rms successful')
          isSubscribedRef.current = true
        }

        // Listen for RMS events
        console.log('Setting up RMS event listener...')
        unlistenRms = await listen<number>('rms', (event) => {
          console.log('Received RMS event:', event.payload)
          const rmsValue = event.payload
          latestRmsRef.current = Math.max(0, Math.min(1, rmsValue)) // Clamp to [0, 1]

          // Update active state
          setRmsData((prev) => ({ ...prev, isActive: true }))

          // Apply throttling if enabled
          if (throttle) {
            throttledUpdate()
          } else {
            directUpdate(rmsValue)
          }
        })

        console.log('RMS event listener set up successfully')
      } catch (error) {
        console.error('Failed to set up RMS listener:', error)
        setRmsData((prev) => ({ ...prev, isActive: false }))

        // If audio capture is not initialized, retry after a delay
        if (error === 'Audio capture not initialized') {
          console.log('Audio capture not ready, retrying in 1 second...')
          retryTimeoutId = setTimeout(() => {
            setupRmsListener()
          }, 1000)
        }
      }
    }

    setupRmsListener()

    // Cleanup function
    return () => {
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
    }
  }, [throttle, throttledUpdate, directUpdate])

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
