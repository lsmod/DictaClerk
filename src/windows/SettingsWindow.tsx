import { useEffect } from 'react'
import { TooltipProvider } from '../components/ui/tooltip'
import SettingsSheet from '../components/SettingsSheet'
import { useSettingsWindowViewModel } from './settingsWindow.viewModel'
import { Toaster } from '@/components/ui/sonner'

export default function SettingsWindow() {
  const { actions, onMount } = useSettingsWindowViewModel()

  useEffect(onMount, [onMount])

  return (
    <TooltipProvider>
      <div className="settings-sheet">
        <SettingsSheet onClose={actions.closeSettings} />

        {/* Toast notifications for settings and profile operations */}
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
