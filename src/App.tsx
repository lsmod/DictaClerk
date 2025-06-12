import { useEffect } from 'react'
import { ReduxProvider } from './components/ReduxProvider'
import MainWindow from './windows/MainWindow'
import SettingsWindow from './windows/SettingsWindow'
import { useAppViewModel } from './app.viewModel'

function AppContent() {
  const { state, onMount } = useAppViewModel()

  useEffect(onMount, [onMount])

  return state.isSettingsWindow ? <SettingsWindow /> : <MainWindow />
}

function App() {
  return (
    <ReduxProvider>
      <AppContent />
    </ReduxProvider>
  )
}

export default App
