import React, { useEffect } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Clipboard } from 'lucide-react'
import { useProfileButtonsViewModel } from './profileButtons.viewModel'
import { Profile } from '@/store/slices/appSlice'

const ProfileButtons: React.FC = () => {
  const { state, actions, onMount, canReformat } = useProfileButtonsViewModel()

  useEffect(onMount, [])

  const ProfileButtonContent = ({ profile }: { profile: Profile }) => {
    return actions.isClipboardProfile(profile.id) ? (
      <Clipboard size={16} className="clipboard-icon" />
    ) : (
      <span className="profile-text">
        {actions.getProfileDisplayName(profile.name)}
      </span>
    )
  }

  return (
    <>
      {state.showLoadingState && (
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
      )}

      {state.hasError && (
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
      )}

      {!state.showLoadingState && !state.hasError && (
        <div
          className="profile-buttons"
          role="radiogroup"
          aria-label={
            canReformat
              ? 'Profile selection for reformatting'
              : 'Profile selection'
          }
          data-processing-complete={canReformat}
        >
          {state.visibleProfiles.slice(0, 5).map((profile) => (
            <Tooltip key={profile.id}>
              <TooltipTrigger asChild>
                <button
                  className={`profile-button ${
                    profile.id === state.activeProfileId ? 'active' : ''
                  } ${
                    actions.isClipboardProfile(profile.id) ? 'clipboard' : ''
                  }`}
                  onClick={() => actions.selectProfile(profile.id)}
                  onKeyDown={(e) => actions.handleKeyDown(e, profile.id)}
                  role="radio"
                  aria-checked={profile.id === state.activeProfileId}
                  aria-label={`${profile.name} profile${
                    canReformat ? ' - click to reformat' : ''
                  }`}
                  aria-describedby={`profile-${profile.id}-description`}
                >
                  <ProfileButtonContent profile={profile} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div>
                  <strong>{profile.name}</strong>
                  {profile.description && <p>{profile.description}</p>}
                  {canReformat && (
                    <p className="text-sm text-blue-400 mt-1">
                      {actions.isClipboardProfile(profile.id)
                        ? 'Click to copy original transcript'
                        : 'Click to reformat with this profile'}
                    </p>
                  )}
                </div>
                <div
                  id={`profile-${profile.id}-description`}
                  className="sr-only"
                >
                  {actions.isClipboardProfile(profile.id)
                    ? 'Clipboard profile - copies text directly without AI formatting'
                    : `Custom profile: ${
                        profile.description || 'No description'
                      }`}
                  {canReformat && (
                    <span>
                      {actions.isClipboardProfile(profile.id)
                        ? '. Click to copy original transcript to clipboard.'
                        : '. Click to reformat the transcript with this profile.'}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          {/* Fill remaining slots with placeholder buttons if less than 5 profiles */}
          {Array.from({
            length: Math.max(0, 5 - state.visibleProfiles.length),
          }).map((_, index) => (
            <div
              key={`placeholder-${index}`}
              className="profile-button"
              style={{ opacity: 0.3 }}
              aria-hidden="true"
            >
              {index + 1}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default ProfileButtons
