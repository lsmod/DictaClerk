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

  const announceProfileChange = (profileName: string) => {
    const liveRegion = document.getElementById('main-live-region')
    if (liveRegion) {
      liveRegion.textContent = `Selected profile: ${profileName}`
      setTimeout(() => {
        liveRegion.textContent = ''
      }, 1000)
    }
  }

  if (isLoading) {
    return (
      <div
        className="profile-buttons"
        role="group"
        aria-label="Profile buttons loading"
        aria-busy="true"
      >
        {[1, 2, 3, 4, 5].map((num) => (
          <div
            key={num}
            className="profile-button"
            style={{ opacity: 0.5 }}
            aria-hidden="true"
          >
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
      <div
        className="profile-buttons"
        role="group"
        aria-label="Profile buttons (error state)"
      >
        {[1, 2, 3, 4, 5].map((num) => (
          <div
            key={num}
            className="profile-button"
            style={{ opacity: 0.3 }}
            aria-hidden="true"
          >
            {num}
          </div>
        ))}
      </div>
    )
  }

  const handleProfileClick = async (profileId: string) => {
    try {
      await selectProfile(profileId)
      const profile = visibleProfiles.find((p) => p.id === profileId)
      if (profile) {
        announceProfileChange(profile.name)
      }
    } catch (err) {
      console.error('Failed to select profile:', err)
      const liveRegion = document.getElementById('main-live-region')
      if (liveRegion) {
        liveRegion.textContent = 'Failed to select profile'
        setTimeout(() => {
          liveRegion.textContent = ''
        }, 2000)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, profileId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleProfileClick(profileId)
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
    <div
      className="profile-buttons"
      role="radiogroup"
      aria-label={`Profile selection (${visibleProfiles.length} of 5 profiles)`}
    >
      {visibleProfiles.map((profile, index) => (
        <Tooltip key={profile.id}>
          <TooltipTrigger asChild>
            <button
              className={`profile-button ${
                activeProfileId === profile.id ? 'active' : ''
              }`}
              onClick={() => handleProfileClick(profile.id)}
              onKeyDown={(e) => handleKeyDown(e, profile.id)}
              role="radio"
              aria-checked={activeProfileId === profile.id}
              aria-label={`Profile ${index + 1}: ${profile.name}${
                profile.shortcut ? `, shortcut ${profile.shortcut}` : ''
              }`}
              aria-describedby={`profile-${profile.id}-tooltip`}
              title={`${profile.name}${
                profile.shortcut ? ` (${profile.shortcut})` : ''
              }`}
            >
              {getProfileDisplayName(profile.name)}
            </button>
          </TooltipTrigger>
          <TooltipContent id={`profile-${profile.id}-tooltip`}>
            <p>{profile.name}</p>
            {profile.description && (
              <p className="text-xs opacity-75">{profile.description}</p>
            )}
            {profile.shortcut && (
              <p className="text-xs opacity-50">Shortcut: {profile.shortcut}</p>
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
            aria-hidden="true"
            role="presentation"
          >
            {visibleProfiles.length + index + 1}
          </div>
        ))}
    </div>
  )
}

export default ProfileButtons
