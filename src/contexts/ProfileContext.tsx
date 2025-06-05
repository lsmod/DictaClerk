import React, { createContext, useContext, useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export interface Profile {
  id: string
  name: string
  description?: string
  prompt?: string
  example_input?: string
  example_output?: string
  active: boolean
  visible?: boolean
  shortcut?: string
  created_at: string
  updated_at: string
}

interface ProfileCollection {
  profiles: Profile[]
  default_profile_id: string
}

interface ProfileContextType {
  profiles: Profile[]
  activeProfileId: string | null
  visibleProfiles: Profile[]
  isLoading: boolean
  error: string | null
  selectProfile: (profileId: string) => Promise<void>
  loadProfiles: () => Promise<void>
  setActiveProfile: (profileId: string) => void
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export const useProfiles = () => {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfiles must be used within a ProfileProvider')
  }
  return context
}

interface ProfileProviderProps {
  children: React.ReactNode
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({
  children,
}) => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const visibleProfiles = profiles
    .filter((profile) => profile.visible === true)
    .slice(0, 5) // Limit to 5 visible profiles

  const loadProfiles = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('Loading profiles...')

      // Load profiles from the JSON file
      const profileData = await invoke<ProfileCollection>('load_profiles')
      console.log('Loaded profile data:', profileData)

      setProfiles(profileData.profiles)

      // Set active profile to default or first active profile
      const defaultProfile = profileData.profiles.find(
        (p) => p.id === profileData.default_profile_id
      )
      console.log('Default profile:', defaultProfile)

      const activeProfile =
        defaultProfile || profileData.profiles.find((p) => p.active)
      console.log('Active profile:', activeProfile)

      if (activeProfile) {
        setActiveProfileId(activeProfile.id)
        console.log('Set active profile ID:', activeProfile.id)
      } else {
        console.warn('No active profile found')
      }

      // Debug visible profiles
      const visible = profileData.profiles.filter(
        (profile) => profile.visible === true
      )
      console.log('Visible profiles:', visible)
    } catch (err) {
      console.error('Failed to load profiles:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profiles')
    } finally {
      setIsLoading(false)
    }
  }

  const selectProfile = async (profileId: string) => {
    try {
      // Emit selectProfile IPC to backend
      await invoke('select_profile', { profileId })
      setActiveProfileId(profileId)
    } catch (err) {
      console.error('Failed to select profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to select profile')
    }
  }

  const setActiveProfile = (profileId: string) => {
    setActiveProfileId(profileId)
  }

  // Listen for profile selection events from shortcuts
  useEffect(() => {
    const unlisten = listen<{ profile_id: string }>(
      'selectProfile',
      (event) => {
        const profileId = event.payload.profile_id
        setActiveProfileId(profileId)
      }
    )

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // Load profiles on mount
  useEffect(() => {
    loadProfiles()
  }, [])

  const value: ProfileContextType = {
    profiles,
    activeProfileId,
    visibleProfiles,
    isLoading,
    error,
    selectProfile,
    loadProfiles,
    setActiveProfile,
  }

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  )
}
