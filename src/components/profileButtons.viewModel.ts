import { useProfiles } from '@/hooks/useProfiles'
import { Profile } from '@/store/slices/appSlice'

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
      await selectProfileCmd(profileId)
      const profile = visibleProfiles.find((p) => p.id === profileId)
      if (profile) {
        announceProfileChange(profile.name)
      }
    } catch (err) {
      console.error('Failed to select profile:', err)
      announceError('Failed to select profile')
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

  return { state, actions, onMount }
}
