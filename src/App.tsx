import { useEffect, useState } from 'react'
import { ReduxProvider } from './components/ReduxProvider'
import MainWindow from './windows/MainWindow'
import SettingsWindow from './windows/SettingsWindow'
import { useAppViewModel } from './app.viewModel'
import { getCurrentWindow } from '@tauri-apps/api/window'

function AppContent() {
  const { onMount } = useAppViewModel()
  const [windowLabel, setWindowLabel] = useState<string>('')

  useEffect(() => {
    // Detect which window we're in
    const detectWindow = async () => {
      try {
        const currentWindow = getCurrentWindow()
        const label = currentWindow.label
        console.log('Current window label:', label)
        setWindowLabel(label)
      } catch (error) {
        console.error('Failed to get current window:', error)
        // Default to main window if detection fails
        setWindowLabel('main')
      }
    }

    detectWindow()
  }, [])

  useEffect(() => {
    // Only run onMount for main window to avoid duplicate event listeners
    if (windowLabel === 'main') {
      onMount()
    }
  }, [onMount, windowLabel])

  // Show loading until we know which window we're in
  if (!windowLabel) {
    return <div>Loading...</div>
  }

  // Route to appropriate window component based on window label
  if (windowLabel === 'settings') {
    return <SettingsWindow />
  }

  // Default to MainWindow for 'main' window or any other window
  return <MainWindow />
}

export default function App() {
  return (
    <ReduxProvider>
      <AppContent />
    </ReduxProvider>
  )
}
