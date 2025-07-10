import { useRef, useEffect, useState } from 'react'
import { useAppSelector } from '../store/hooks'
import { useRmsData } from '../hooks/useRmsData'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

interface VolumeVisualizerState {
  isRecording: boolean
  rmsData: {
    value: number
    isActive: boolean
    timestamp: number
  }
  timelineBuffer: number[]
  rmsPercentage: number
  amplifiedRms: number
  isBackendRecording: boolean
}

export const useVolumeVisualizerViewModel = () => {
  const { status } = useAppSelector((state) => state.app)
  const isRecording = status === 'recording'
  const rmsData = useRmsData({ throttle: true })

  console.log('📊 [VOL-VIZ] Volume visualizer hook called with:', {
    status,
    isRecording,
    rmsValue: rmsData.value,
    rmsIsActive: rmsData.isActive,
  })

  // Track backend recording state separately for more accuracy
  const [isBackendRecording, setIsBackendRecording] = useState(false)

  // Timeline buffer to store RMS history (60 time points)
  const timelineBuffer = useRef<number[]>(new Array(60).fill(0))
  const lastUpdateTime = useRef<number>(0)
  const isSetupRef = useRef<boolean>(false)

  // Check backend recording state periodically to ensure synchronization
  useEffect(() => {
    if (isSetupRef.current) return // Already set up

    console.log('🔄 [VOL-VIZ] Setting up backend state checker...')
    isSetupRef.current = true

    let intervalId: NodeJS.Timeout | undefined

    const checkBackendRecordingState = async () => {
      try {
        const backendIsRecording = await invoke<boolean>('is_app_recording')
        if (backendIsRecording !== isBackendRecording) {
          console.log('🔄 [VOL-VIZ] Backend recording state changed:', {
            frontend: isRecording,
            backend: backendIsRecording,
            previousBackendState: isBackendRecording,
          })
          setIsBackendRecording(backendIsRecording)
        } else {
          // Only log periodically to reduce noise
          if (Math.random() < 0.1) {
            // 10% chance to log
            console.log('📊 [VOL-VIZ] Backend state check (no change):', {
              frontend: isRecording,
              backend: backendIsRecording,
            })
          }
        }
      } catch (error) {
        console.error(
          '❌ [VOL-VIZ] Failed to check backend recording state:',
          error
        )
      }
    }

    // Check immediately on mount
    console.log('🚀 [VOL-VIZ] Starting immediate backend state check...')
    checkBackendRecordingState()

    // Then check every 1000ms for state synchronization (reduced frequency)
    const startInterval = () => {
      console.log(
        '⏰ [VOL-VIZ] Starting periodic backend state check (1000ms interval)'
      )
      intervalId = setInterval(checkBackendRecordingState, 1000)
    }
    startInterval()

    return () => {
      console.log('🧹 [VOL-VIZ] Cleaning up backend state checker')
      if (intervalId) {
        clearInterval(intervalId)
      }
      isSetupRef.current = false
    }
  }, [isBackendRecording, isRecording]) // Dependencies added to fix linting warning

  // Listen to state machine events for better synchronization
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupStateListener = async () => {
      try {
        unlisten = await listen('app-state-changed', (event) => {
          console.log(
            '📊 Volume visualizer received state change:',
            event.payload
          )
          // The state change will trigger re-render via Redux store update
          // This ensures we're synchronized with the backend state machine
        })
      } catch (error) {
        console.error('❌ Failed to set up state change listener:', error)
      }
    }

    setupStateListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [])

  // Enhanced debug logging for RMS data and recording state
  useEffect(() => {
    console.log('📊 [VOL-VIZ] State update detected:', {
      reduxStatus: status,
      isRecording,
      isBackendRecording,
      rmsValue: rmsData.value,
      rmsIsActive: rmsData.isActive,
      rmsTimestamp: rmsData.timestamp,
      shouldShowActivity:
        (isRecording || isBackendRecording) && rmsData.isActive,
      timeSinceLastRms: Date.now() - rmsData.timestamp,
    })
  }, [
    status,
    isRecording,
    isBackendRecording,
    rmsData.value,
    rmsData.isActive,
    rmsData.timestamp,
  ])

  // Update timeline buffer when RMS data changes
  useEffect(() => {
    const now = Date.now()

    // Update at most every 100ms (10fps) to create smooth timeline effect
    if (now - lastUpdateTime.current >= 100) {
      // Show activity when either frontend or backend says we're recording AND we have RMS data
      const shouldShowActivity =
        (isRecording || isBackendRecording) &&
        rmsData.isActive &&
        rmsData.value > 0.005

      console.log('📈 [VOL-VIZ] Timeline buffer update:', {
        now,
        timeSinceLastUpdate: now - lastUpdateTime.current,
        isRecording,
        isBackendRecording,
        rmsValue: rmsData.value,
        rmsIsActive: rmsData.isActive,
        shouldShowActivity,
        threshold: 0.005,
        meetsThreshold: rmsData.value > 0.005,
      })

      // Shift all values to the left (past) and add new value on the right (present)
      const newBuffer = [
        ...timelineBuffer.current.slice(1), // Remove oldest (leftmost) value
        shouldShowActivity ? rmsData.value : 0, // Add newest (rightmost) value
      ]

      console.log('📊 [VOL-VIZ] Buffer update details:', {
        oldBufferLength: timelineBuffer.current.length,
        newBufferLength: newBuffer.length,
        addedValue: shouldShowActivity ? rmsData.value : 0,
        lastFewValues: newBuffer.slice(-5),
        nonZeroCount: newBuffer.filter((v) => v > 0).length,
      })

      timelineBuffer.current = newBuffer
      lastUpdateTime.current = now
    }
  }, [
    isRecording,
    isBackendRecording,
    rmsData.value,
    rmsData.isActive,
    rmsData.timestamp,
  ])

  // Convert RMS value to percentage for display (with amplification applied)
  // Show amplified RMS when actually recording (either frontend or backend state) and receiving data
  const shouldBeActive = (isRecording || isBackendRecording) && rmsData.isActive
  const amplifiedRms = shouldBeActive ? Math.min(1.0, rmsData.value * 6.0) : 0.0
  const rmsPercentage = Math.round(amplifiedRms * 100)

  console.log('🎛️ [VOL-VIZ] RMS calculations:', {
    shouldBeActive,
    rawRms: rmsData.value,
    amplifiedRms,
    rmsPercentage,
    amplificationFactor: 6.0,
  })

  const state: VolumeVisualizerState = {
    isRecording,
    isBackendRecording,
    rmsData: {
      ...rmsData,
      // Ensure RMS data is considered active when we're actually recording (frontend OR backend)
      isActive: shouldBeActive,
    },
    timelineBuffer: timelineBuffer.current,
    rmsPercentage,
    amplifiedRms,
  }

  const actions = {
    // No user actions for this component
  }

  const onMount = () => {
    console.log('📊 VolumeVisualizer mounted with initial state:', {
      status,
      isRecording,
      rmsDataActive: rmsData.isActive,
    })
  }

  return { state, actions, onMount }
}
