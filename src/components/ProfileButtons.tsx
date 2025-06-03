import React, { useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const ProfileButtons: React.FC = () => {
  const [activeProfile, setActiveProfile] = useState<number>(1)

  return (
    <div className="profile-buttons">
      {[1, 2, 3, 4, 5].map((num) => (
        <Tooltip key={num}>
          <TooltipTrigger asChild>
            <button
              className={`profile-button ${
                activeProfile === num ? 'active' : ''
              }`}
              onClick={() => setActiveProfile(num)}
            >
              {num}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Profile {num}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

export default ProfileButtons
