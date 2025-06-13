import { useProfiles } from '@/hooks/useProfiles'
import { Profile } from '@/store/slices/appSlice'
import { useAppSelector } from '@/store/hooks'
import { useBackendCommands } from '@/hooks/useBackendCommands'

interface ProfileButtonsState {
  visibleProfiles: Profile[]
  activeProfileId: string | null
  isLoading: boolean
  error: string | null
  hasError: boolean
  showLoadingState: boolean
}

interface ProfileButtonsActions {
  selectProfile: (profileId: string) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent, profileId: string) => void
  announceProfileChange: (profileName: string) => void
  announceError: (message: string) => void
  getProfileDisplayName: (profileName: string) => string
  isClipboardProfile: (profileId: string) => boolean
}

export const useProfileButtonsViewModel = () => {
  const {
    visibleProfiles,
    activeProfileId,
    selectProfile: selectProfileCmd,
    isLoading,
    error,
    isClipboardProfile,
  } = useProfiles()

  const { reformatWithProfile } = useBackendCommands()
  const { status, originalTranscript } = useAppSelector((state) => state.app)

  // Check if we can reformat: either processing is complete OR we're idle with transcript data
  const canReformat =
    status === 'processing-complete' ||
    (status === 'idle' &&
      originalTranscript &&
      originalTranscript.trim().length > 0)

  const announceProfileChange = (profileName: string) => {
    const liveRegion = document.getElementById('main-live-region')
    if (liveRegion) {
      liveRegion.textContent = `Selected profile: ${profileName}`
      setTimeout(() => {
        liveRegion.textContent = ''
      }, 1000)
    }
  }

  const announceError = (message: string) => {
    const liveRegion = document.getElementById('main-live-region')
    if (liveRegion) {
      liveRegion.textContent = message
      setTimeout(() => {
        liveRegion.textContent = ''
      }, 2000)
    }
  }

  const handleProfileClick = async (profileId: string) => {
    try {
      // If we can reformat (processing complete or idle with transcript), reformat with the selected profile
      if (canReformat) {
        if (isClipboardProfile(profileId)) {
          // For clipboard profile, copy the original transcript directly
          console.log(
            'Copying original transcript to clipboard (clipboard profile selected)'
          )
          // The backend will handle copying the original transcript
          await reformatWithProfile(profileId)
        } else {
          // For other profiles, reformat the original transcript
          console.log('Reformatting with profile:', profileId)
          await reformatWithProfile(profileId)
        }
      } else {
        // Normal profile selection during idle state without transcript data
        await selectProfileCmd(profileId)
      }

      const profile = visibleProfiles.find((p) => p.id === profileId)
      if (profile) {
        if (canReformat) {
          announceProfileChange(`Reformatting with ${profile.name}`)
        } else {
          announceProfileChange(`Selected profile: ${profile.name}`)
        }
      }
    } catch (err) {
      console.error('Failed to select/reformat with profile:', err)
      if (canReformat) {
        announceError('Failed to reformat with profile')
      } else {
        announceError('Failed to select profile')
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

  const state: ProfileButtonsState = {
    visibleProfiles,
    activeProfileId,
    isLoading,
    error,
    hasError: Boolean(error),
    showLoadingState: isLoading,
  }

  const actions: ProfileButtonsActions = {
    selectProfile: handleProfileClick,
    handleKeyDown,
    announceProfileChange,
    announceError,
    getProfileDisplayName,
    isClipboardProfile,
  }

  const onMount = () => {
    // No initialization needed for this component
  }

  return { state, actions, onMount, canReformat }
}
