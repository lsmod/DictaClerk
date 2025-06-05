import React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useProfiles } from '@/contexts/ProfileContext'

const ProfileButtons: React.FC = () => {
  const { visibleProfiles, activeProfileId, selectProfile, isLoading, error } =
    useProfiles()

  if (isLoading) {
    return (
      <div className="profile-buttons">
        {[1, 2, 3, 4, 5].map((num) => (
          <div key={num} className="profile-button" style={{ opacity: 0.5 }}>
            {num}
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    console.error('ProfileButtons error:', error)
    // Fallback to numbered buttons if there's an error
    return (
      <div className="profile-buttons">
        {[1, 2, 3, 4, 5].map((num) => (
          <div key={num} className="profile-button" style={{ opacity: 0.3 }}>
            {num}
          </div>
        ))}
      </div>
    )
  }

  const handleProfileClick = async (profileId: string) => {
    try {
      await selectProfile(profileId)
    } catch (err) {
      console.error('Failed to select profile:', err)
    }
  }

  const getProfileDisplayName = (profileName: string): string => {
    // Get first two letters of the profile name, or first letter + number
    if (profileName.length >= 2) {
      return profileName.substring(0, 2).toUpperCase()
    }
    return profileName.substring(0, 1).toUpperCase()
  }

  return (
    <div className="profile-buttons">
      {visibleProfiles.map((profile) => (
        <Tooltip key={profile.id}>
          <TooltipTrigger asChild>
            <button
              className={`profile-button ${
                activeProfileId === profile.id ? 'active' : ''
              }`}
              onClick={() => handleProfileClick(profile.id)}
              title={`${profile.name}${
                profile.shortcut ? ` (${profile.shortcut})` : ''
              }`}
            >
              {getProfileDisplayName(profile.name)}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{profile.name}</p>
            {profile.description && (
              <p className="text-xs opacity-75">{profile.description}</p>
            )}
            {profile.shortcut && (
              <p className="text-xs opacity-50">{profile.shortcut}</p>
            )}
          </TooltipContent>
        </Tooltip>
      ))}

      {/* Fill remaining slots with disabled buttons if less than 5 profiles */}
      {visibleProfiles.length < 5 &&
        Array.from({ length: 5 - visibleProfiles.length }, (_, index) => (
          <div
            key={`empty-${index}`}
            className="profile-button"
            style={{ opacity: 0.2, cursor: 'not-allowed' }}
          >
            {visibleProfiles.length + index + 1}
          </div>
        ))}
    </div>
  )
}

export default ProfileButtons
