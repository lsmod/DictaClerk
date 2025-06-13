import { useEffect } from 'react'
import { TooltipProvider } from '../components/ui/tooltip'
import SettingsSheet from '../components/SettingsSheet'
import { useSettingsWindowViewModel } from './settingsWindow.viewModel'

export default function SettingsWindow() {
  const { actions, onMount } = useSettingsWindowViewModel()

  useEffect(onMount, [onMount])

  return (
    <TooltipProvider>
      <div className="settings-window">
        <SettingsSheet onClose={actions.closeSettings} />
      </div>
    </TooltipProvider>
  )
}
