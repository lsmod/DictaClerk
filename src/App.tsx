import { useEffect, useState, useCallback } from 'react'
import { ReduxProvider } from './components/ReduxProvider'
import MainWindow from './windows/MainWindow'
import SettingsWindow from './windows/SettingsWindow'
import { useAppViewModel } from './app.viewModel'
import { getCurrentWindow } from '@tauri-apps/api/window'

function AppContent() {
  const { onMount } = useAppViewModel()
  const [windowLabel, setWindowLabel] = useState<string>('')
  const [isInitialized, setIsInitialized] = useState(false)

  console.log('🏠 [APP] AppContent render:', {
    windowLabel,
    isInitialized,
    hasOnMount: !!onMount,
  })

  // Stable window detection that only runs once
  const detectWindow = useCallback(async () => {
    if (windowLabel) return // Already detected

    try {
      console.log('🔍 [APP] Detecting current window...')
      const currentWindow = getCurrentWindow()
      const label = currentWindow.label
      console.log('✅ [APP] Current window detected:', label)
      setWindowLabel(label)
    } catch (error) {
      console.error('❌ [APP] Failed to get current window:', error)
      // Default to main window if detection fails
      console.log('📋 [APP] Defaulting to main window')
      setWindowLabel('main')
    }
  }, [windowLabel])

  // Detect window only once on mount
  useEffect(() => {
    console.log(
      '🔥 [APP] Window detection useEffect ENTRY - this should always appear!'
    )
    detectWindow()
  }, [detectWindow])

  // Initialize app only once for main window
  useEffect(() => {
    console.log(
      '🔥 [APP] Main window useEffect ENTRY - this should always appear!'
    )
    console.log('🔍 [APP] useEffect conditions:', {
      windowLabel,
      isMainWindow: windowLabel === 'main',
      isInitialized,
      shouldInitialize: windowLabel && windowLabel === 'main' && !isInitialized,
    })

    if (windowLabel && windowLabel === 'main' && !isInitialized) {
      console.log('🚀 [APP] Running onMount for main window...')
      const cleanup = onMount()
      setIsInitialized(true)
      console.log('✅ [APP] Main window initialization completed')

      return cleanup
    }
  }, [windowLabel, isInitialized, onMount])

  // Show loading until we know which window we're in
  if (!windowLabel) {
    console.log('⏳ [APP] Loading - window not detected yet')
    return <div>Loading...</div>
  }

  // Route to appropriate window component based on window label
  if (windowLabel === 'settings') {
    console.log('⚙️ [APP] Rendering SettingsWindow')
    return <SettingsWindow />
  }

  // Default to MainWindow for 'main' window or any other window
  console.log('🏠 [APP] Rendering MainWindow')
  return <MainWindow />
}

export default function App() {
  console.log('🌟 [APP] App component render - ENTRY')

  return (
    <ReduxProvider>
      <AppContent />
    </ReduxProvider>
  )
}
