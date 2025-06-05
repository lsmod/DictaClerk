import React from 'react'
import VolumeBar from './VolumeBar'
import { useRecording } from '../contexts/RecordingContext'

const VolumeVisualizer: React.FC = () => {
  const { isRecording } = useRecording()

  // Génération de 100 barres avec des hauteurs et délais aléatoires
  const bars = Array.from({ length: 100 }, (_, index) => ({
    id: index,
    height: Math.random() * 80 + 20, // Entre 20% et 100%
    delay: Math.random() * 2000, // Délai aléatoire jusqu'à 2s
  }))

  return (
    <div className={`volume-visualizer ${isRecording ? 'recording' : 'idle'}`}>
      {bars.map((bar) => (
        <VolumeBar
          key={bar.id}
          height={bar.height}
          delay={bar.delay}
          isRecording={isRecording}
        />
      ))}
    </div>
  )
}

export default VolumeVisualizer
