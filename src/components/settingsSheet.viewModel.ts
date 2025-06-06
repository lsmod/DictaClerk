import { useState, useCallback, useRef, useEffect } from 'react'
import { useProfiles, Profile } from '@/contexts/ProfileContext'
import { SettingsConfig } from '@/types/settings'
import { invoke } from '@tauri-apps/api/core'

interface SettingsSheetState {
  view: 'overview' | 'editor'
  editingProfile: Profile | null
  settings: SettingsConfig | null
  originalSettings: SettingsConfig | null
  isLoadingSettings: boolean
  isSaving: boolean
  settingsError: string | null
  saveError: string | null
  saveSuccess: boolean
  isTestingApiKey: boolean
  hasUnsavedChanges: boolean
  profiles: Profile[]
  isLoadingProfiles: boolean
  profilesError: string | null
  visibleProfilesCount: number
}

interface SettingsSheetActions {
  // Navigation actions
  setView: (view: 'overview' | 'editor') => void
  setEditingProfile: (profile: Profile | null) => void
  navigateToEditor: (profile: Profile) => void
  navigateToAddProfile: () => void
  navigateBack: () => void
  closeSheet: () => void

  // Settings actions
  updateGlobalShortcut: (shortcut: string) => void
  updateApiKey: (apiKey: string) => void
  saveSettings: (e?: React.MouseEvent) => void
  testApiKey: () => void

  // Profile actions
  saveProfile: (profile: Profile) => void
  deleteProfile: (profileId: string) => void
  toggleProfileVisibility: (profileId: string, visible: boolean) => void

  // Utility actions
  captureShortcut: () => void
}

export function useSettingsSheetViewModel(onClose: () => void) {
  const [view, setView] = useState<'overview' | 'editor'>('overview')
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<SettingsConfig | null>(null)
  const [originalSettings, setOriginalSettings] =
    useState<SettingsConfig | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isTestingApiKey, setIsTestingApiKey] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Ref to track if we're currently saving to prevent unnecessary dirty state updates
  const isSavingRef = useRef(false)

  const {
    profiles,
    isLoading: isLoadingProfiles,
    error: profilesError,
    loadProfiles,
  } = useProfiles()

  const visibleProfilesCount = profiles.filter((p) => p.visible).length

  // Check if settings have changed (dirty state)
  const checkForChanges = useCallback(
    (
      currentSettings: SettingsConfig | null,
      original: SettingsConfig | null
    ) => {
      if (!currentSettings || !original || isSavingRef.current) return false
      return JSON.stringify(currentSettings) !== JSON.stringify(original)
    },
    []
  )

  // Update dirty state when settings change
  useEffect(() => {
    const hasChanges = checkForChanges(settings, originalSettings)
    setHasUnsavedChanges(hasChanges)
  }, [settings, originalSettings, checkForChanges])

  const loadSettingsData = async () => {
    try {
      setIsLoadingSettings(true)
      setSettingsError(null)
      console.log('Loading settings...')

      const settingsData = await invoke<SettingsConfig>('load_settings')
      console.log('Loaded settings:', settingsData)
      setSettings(settingsData)
      setOriginalSettings(JSON.parse(JSON.stringify(settingsData))) // Deep copy
    } catch (error) {
      console.error('Failed to load settings:', error)
      setSettingsError(
        error instanceof Error ? error.message : 'Failed to load settings'
      )

      // Create default settings if loading fails
      const defaultSettings = {
        whisper: {
          api_key: '',
          endpoint: 'https://api.openai.com/v1/audio/transcriptions',
          model: 'whisper-1',
          timeout_seconds: 30,
          max_retries: 3,
        },
        audio: {
          input_device: null,
          sample_rate: 44100,
          buffer_size: 1024,
        },
        encoding: {
          bitrate: 32000,
          size_limit_mb: 23,
        },
        ui: {
          theme: 'auto',
          auto_start_recording: false,
        },
        global_shortcut: 'CmdOrCtrl+Shift+F9',
      }
      setSettings(defaultSettings)
      setOriginalSettings(JSON.parse(JSON.stringify(defaultSettings)))
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleCloseSheet = useCallback(() => {
    if (hasUnsavedChanges) {
      const shouldDiscard = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      )
      if (!shouldDiscard) return
    }
    onClose()
  }, [hasUnsavedChanges, onClose])

  // Handle beforeunload and keyboard events
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Don't show modal if we're currently saving or if there are no unsaved changes
      if (isSavingRef.current || !hasUnsavedChanges) {
        return
      }

      e.preventDefault()
      e.returnValue =
        'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'editor') {
          setView('overview')
          setEditingProfile(null)
        } else {
          handleCloseSheet()
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasUnsavedChanges, view, handleCloseSheet])

  const state: SettingsSheetState = {
    view,
    editingProfile,
    settings,
    originalSettings,
    isLoadingSettings,
    isSaving,
    settingsError,
    saveError,
    saveSuccess,
    isTestingApiKey,
    hasUnsavedChanges,
    profiles,
    isLoadingProfiles,
    profilesError,
    visibleProfilesCount,
  }

  const actions: SettingsSheetActions = {
    // Navigation actions
    setView,
    setEditingProfile,
    navigateToEditor: (profile: Profile) => {
      setEditingProfile(profile)
      setView('editor')
    },
    navigateToAddProfile: () => {
      const newProfile: Profile = {
        id: Date.now().toString(),
        name: '',
        description: '',
        prompt: '',
        example_input: '',
        example_output: '',
        active: false,
        visible: false,
        shortcut: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setEditingProfile(newProfile)
      setView('editor')
    },
    navigateBack: () => {
      setView('overview')
      setEditingProfile(null)
    },
    closeSheet: handleCloseSheet,

    // Settings actions
    updateGlobalShortcut: (shortcut: string) => {
      setSettings((prev) =>
        prev ? { ...prev, global_shortcut: shortcut } : null
      )
    },
    updateApiKey: (apiKey: string) => {
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              whisper: { ...prev.whisper, api_key: apiKey },
            }
          : null
      )
    },
    saveSettings: async (e?: React.MouseEvent) => {
      // Prevent any default button behavior
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }

      if (!settings) return

      try {
        isSavingRef.current = true
        setIsSaving(true)
        setSaveError(null)
        setSaveSuccess(false)

        console.log('Saving settings:', settings)

        // Check if global shortcut changed
        const shortcutChanged =
          originalSettings &&
          settings.global_shortcut !== originalSettings.global_shortcut

        // Save settings to backend
        const result = await invoke<string>('save_settings', { settings })
        console.log('Save result:', result)

        // If global shortcut changed, update it immediately
        if (shortcutChanged) {
          try {
            console.log(
              'Updating global shortcut to:',
              settings.global_shortcut
            )
            await invoke<string>('update_global_shortcut', {
              newShortcut: settings.global_shortcut,
            })
            console.log('Global shortcut updated successfully')
          } catch (shortcutError) {
            console.error('Failed to update global shortcut:', shortcutError)
            setSaveError(
              shortcutError instanceof Error
                ? `Settings saved but failed to update global shortcut: ${shortcutError.message}`
                : 'Settings saved but failed to update global shortcut'
            )
          }
        }

        // Update original settings to current settings (reset dirty state)
        setOriginalSettings(JSON.parse(JSON.stringify(settings)))

        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000) // Clear success message after 3 seconds
      } catch (error) {
        console.error('Failed to save settings:', error)
        setSaveError(
          error instanceof Error ? error.message : 'Failed to save settings'
        )
      } finally {
        isSavingRef.current = false
        setIsSaving(false)
      }
    },
    testApiKey: async () => {
      if (!settings?.whisper.api_key) {
        setSaveError('Please enter an API key first')
        return
      }

      try {
        setIsTestingApiKey(true)
        setSaveError(null)

        // Test API key by making a simple request
        // TODO: Implement actual API key testing via IPC command
        console.log(
          'Testing API key:',
          settings.whisper.api_key.substring(0, 10) + '...'
        )

        // For now, just simulate a test
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } catch (error) {
        console.error('API key test failed:', error)
        setSaveError('API key test failed')
      } finally {
        setIsTestingApiKey(false)
      }
    },

    // Profile actions
    saveProfile: async (profile: Profile) => {
      try {
        // Find existing profile or add new one
        const existingProfileIndex = profiles.findIndex(
          (p) => p.id === profile.id
        )
        let updatedProfiles: Profile[]

        if (existingProfileIndex >= 0) {
          // Update existing profile
          updatedProfiles = [...profiles]
          updatedProfiles[existingProfileIndex] = {
            ...profile,
            updated_at: new Date().toISOString(),
          }
        } else {
          // Add new profile
          updatedProfiles = [
            ...profiles,
            {
              ...profile,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]
        }

        // Save to backend
        const profileCollection = {
          profiles: updatedProfiles,
          default_profile_id:
            profiles.find((p) => p.active)?.id || updatedProfiles[0]?.id || '',
        }

        await invoke('save_profiles', { profiles: profileCollection })

        // Reload profiles to sync with backend
        await loadProfiles()

        setView('overview')
        setEditingProfile(null)
      } catch (error) {
        console.error('Failed to save profile:', error)
        setSaveError(
          error instanceof Error ? error.message : 'Failed to save profile'
        )
      }
    },
    deleteProfile: async (profileId: string) => {
      try {
        const updatedProfiles = profiles.filter((p) => p.id !== profileId)

        const profileCollection = {
          profiles: updatedProfiles,
          default_profile_id:
            profiles.find((p) => p.active && p.id !== profileId)?.id ||
            updatedProfiles[0]?.id ||
            '',
        }

        await invoke('save_profiles', { profiles: profileCollection })

        // Reload profiles to sync with backend
        await loadProfiles()

        setView('overview')
        setEditingProfile(null)
      } catch (error) {
        console.error('Failed to delete profile:', error)
        setSaveError(
          error instanceof Error ? error.message : 'Failed to delete profile'
        )
      }
    },
    toggleProfileVisibility: async (profileId: string, visible: boolean) => {
      const visibleCount = profiles.filter((p) => p.visible).length

      // Check if we're trying to make visible but already at limit
      if (visible && visibleCount >= 5) return

      try {
        const updatedProfiles = profiles.map((p) =>
          p.id === profileId
            ? { ...p, visible, updated_at: new Date().toISOString() }
            : p
        )

        const profileCollection = {
          profiles: updatedProfiles,
          default_profile_id:
            profiles.find((p) => p.active)?.id || updatedProfiles[0]?.id || '',
        }

        await invoke('save_profiles', { profiles: profileCollection })

        // Reload profiles to sync with backend
        await loadProfiles()
      } catch (error) {
        console.error('Failed to toggle profile visibility:', error)
        setSaveError(
          error instanceof Error ? error.message : 'Failed to update profile'
        )
      }
    },

    // Utility actions
    captureShortcut: () => {
      // TODO: Implement shortcut capture functionality
      console.log('Capture shortcut clicked')
    },
  }

  const onMount = useCallback(() => {
    loadSettingsData()
  }, [])

  return { state, actions, onMount }
}
