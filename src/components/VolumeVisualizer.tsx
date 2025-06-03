import React from 'react'
import VolumeBar from './VolumeBar'

const VolumeVisualizer: React.FC = () => {
  // Génération de 100 barres avec des hauteurs et délais aléatoires
  const bars = Array.from({ length: 100 }, (_, index) => ({
    id: index,
    height: Math.random() * 80 + 20, // Entre 20% et 100%
    delay: Math.random() * 2000, // Délai aléatoire jusqu'à 2s
  }))

  return (
    <div className="volume-visualizer">
      {bars.map((bar) => (
        <VolumeBar key={bar.id} height={bar.height} delay={bar.delay} />
      ))}
    </div>
  )
}

export default VolumeVisualizer
