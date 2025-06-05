import React from 'react'
import { Settings } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { invoke } from '@tauri-apps/api/core'

const SettingsButton: React.FC = () => {
  const handleClick = async () => {
    try {
      console.log('Settings button clicked, opening detached window')
      await invoke('open_settings_window')
    } catch (error) {
      console.error('Failed to open settings window:', error)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="settings-button" onClick={handleClick}>
          <Settings size={16} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Settings</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default SettingsButton
