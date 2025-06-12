import { useCallback, useEffect } from 'react'
import { useAppSelector } from '../store/hooks'
import { useBackendCommands } from './useBackendCommands'
import {
  selectVisibleProfiles,
  selectEditableProfiles,
  selectIsClipboardProfile,
  selectActiveProfile,
  Profile,
} from '../store/slices/appSlice'

export interface UseProfilesReturn {
  profiles: Profile[]
  activeProfileId: string | null
  activeProfile: Profile | null
  visibleProfiles: Profile[]
  editableProfiles: Profile[]
  isLoading: boolean
  error: string | null
  selectProfile: (profileId: string) => Promise<void>
  loadProfiles: () => Promise<void>
  setActiveProfile: (profileId: string) => void
  isClipboardProfile: (profileId: string) => boolean
  getVisibleProfiles: () => Profile[]
}

export const useProfiles = (): UseProfilesReturn => {
  const { loadProfiles: loadProfilesCmd, selectProfile: selectProfileCmd } =
    useBackendCommands()

  // Redux state selectors
  const profiles = useAppSelector((state) => state.app.profiles)
  const activeProfileId = useAppSelector((state) => state.app.activeProfileId)
  const isLoading = useAppSelector((state) => state.app.profilesLoading)
  const error = useAppSelector((state) => state.app.profilesError)

  // Computed values using selectors
  const activeProfile = useAppSelector(selectActiveProfile)
  const visibleProfiles = useAppSelector(selectVisibleProfiles)
  const editableProfiles = useAppSelector(selectEditableProfiles)

  // Helper functions
  const isClipboardProfile = useCallback((profileId: string): boolean => {
    return selectIsClipboardProfile(profileId)
  }, [])

  const getVisibleProfiles = useCallback((): Profile[] => {
    return visibleProfiles
  }, [visibleProfiles])

  // Load profiles on mount
  useEffect(() => {
    loadProfilesCmd()
  }, [loadProfilesCmd])

  return {
    profiles,
    activeProfileId,
    activeProfile,
    visibleProfiles,
    editableProfiles,
    isLoading,
    error,
    selectProfile: selectProfileCmd,
    loadProfiles: loadProfilesCmd,
    setActiveProfile: (profileId: string) => {
      // For local state changes, we can dispatch directly
      // For backend sync, use selectProfile instead
      selectProfileCmd(profileId)
    },
    isClipboardProfile,
    getVisibleProfiles,
  }
}
