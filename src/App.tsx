import { TooltipProvider } from './components/ui/tooltip'
import StopButton from './components/StopButton'
import ProfileButtons from './components/ProfileButtons'
import ElapsedTime from './components/ElapsedTime'
import VolumeVisualizer from './components/VolumeVisualizer'
import SettingsButton from './components/SettingsButton'

function App() {
  return (
    <TooltipProvider>
      <div className="synth-interface">
        <div className="synth-header">
          <SettingsButton />
        </div>

        <div className="main-controls">
          <div className="volume-section">
            <VolumeVisualizer />
            <ElapsedTime />
          </div>
          <StopButton />
        </div>

        <ProfileButtons />
      </div>
    </TooltipProvider>
  )
}

export default App
