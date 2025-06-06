import { useEffect } from 'react'
import MainWindow from './windows/MainWindow'
import SettingsWindow from './windows/SettingsWindow'
import { useAppViewModel } from './app.viewModel'

function App() {
  const { state, onMount } = useAppViewModel()

  useEffect(onMount, [onMount])

  return state.isSettingsWindow ? <SettingsWindow /> : <MainWindow />
}

export default App
