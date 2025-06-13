import { useState, useCallback, useRef, useEffect } from 'react'
import { useProfiles } from '@/hooks/useProfiles'
import { Profile, ProfileCollection } from '@/store/slices/appSlice'
import { SettingsConfig } from '@/types/settings'
import { invoke } from '@tauri-apps/api/core'
import { toast } from '@/components/ui/sonner'

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
  apiKeyTestSuccess: boolean
  hasUnsavedChanges: boolean
  profiles: Profile[]
  isLoadingProfiles: boolean
  profilesError: string | null
  visibleProfilesCount: number
  shortcutValidation: {
    isValidating: boolean
    isValid: boolean
    error: string | null
  }
  isCapturingShortcut: boolean
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
  reorderProfiles: (activeId: string, overId: string) => void

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
  const [apiKeyTestSuccess, setApiKeyTestSuccess] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [shortcutValidation, setShortcutValidation] = useState<{
    isValidating: boolean
    isValid: boolean
    error: string | null
  }>({
    isValidating: false,
    isValid: true,
    error: null,
  })
  const [isCapturingShortcut, setIsCapturingShortcut] = useState(false)

  // Ref to track if we're currently saving to prevent unnecessary dirty state updates
  const isSavingRef = useRef(false)

  // Ref for validation debouncing
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Use Redux-based profiles hook
  const {
    profiles,
    isLoading: isLoadingProfiles,
    error: profilesError,
    loadProfiles,
  } = useProfiles()

  const visibleProfilesCount = profiles.filter((p) => p.visible).length

  // Shortcut validation function
  const validateShortcutRealTime = useCallback(async (shortcut: string) => {
    if (!shortcut.trim()) {
      return { isValid: true, error: null }
    }

    try {
      setShortcutValidation((prev) => ({ ...prev, isValidating: true }))

      const isValid = await invoke<boolean>('validate_shortcut_conflict', {
        shortcut,
      })

      return {
        isValid,
        error: isValid ? null : 'Shortcut conflict detected',
      }
    } catch (error) {
      console.error('Validation failed:', error)
      return {
        isValid: false,
        error: 'Validation failed',
      }
    }
  }, [])

  // Helper function to build shortcut string from keyboard event
  const buildShortcutString = useCallback((e: KeyboardEvent): string => {
    const parts: string[] = []

    // Add modifiers
    if (e.ctrlKey || e.metaKey) parts.push(e.metaKey ? 'Cmd' : 'Ctrl')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')

    // Add the main key (avoid modifier keys themselves)
    if (!['Control', 'Alt', 'Shift', 'Meta', 'Command'].includes(e.key)) {
      // Convert special keys to proper format
      let key = e.key
      if (key === ' ') key = 'Space'
      else if (key.length === 1) key = key.toUpperCase()

      parts.push(key)
    }

    return parts.join('+')
  }, [])

  // Helper function to check if a shortcut is complete (has non-modifier key)
  const isCompleteShortcut = useCallback((shortcut: string): boolean => {
    if (!shortcut) return false

    // A complete shortcut should have at least one non-modifier key
    // Check if the shortcut contains keys other than Ctrl, Alt, Shift, Cmd
    const parts = shortcut.split('+')
    const modifierKeys = ['Ctrl', 'Alt', 'Shift', 'Cmd']
    const hasNonModifier = parts.some((part) => !modifierKeys.includes(part))

    return hasNonModifier
  }, [])

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

  // Cleanup validation timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
    }
  }, [])

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
    apiKeyTestSuccess,
    hasUnsavedChanges,
    profiles,
    isLoadingProfiles,
    profilesError,
    visibleProfilesCount,
    shortcutValidation,
    isCapturingShortcut,
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
        id: '',
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

      // Focus first profile input after navigation
      setTimeout(() => {
        const firstInput = document.querySelector('.profile-editor input')
        if (firstInput instanceof HTMLElement) {
          firstInput.focus()
        }
      }, 100)
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

      // Clear previous validation timeout
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }

      // Debounce validation
      validationTimeoutRef.current = setTimeout(async () => {
        const result = await validateShortcutRealTime(shortcut)
        setShortcutValidation({
          isValidating: false,
          isValid: result.isValid,
          error: result.error,
        })
      }, 500) // 500ms debounce
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
      // Clear API key test success when key is changed
      setApiKeyTestSuccess(false)
      setSaveError(null)
    },
    saveSettings: async (e?: React.MouseEvent) => {
      // Prevent any default button behavior
      e?.preventDefault()
      e?.stopPropagation()

      if (isSavingRef.current || !settings) {
        return
      }

      isSavingRef.current = true
      setIsSaving(true)
      setSaveError(null)
      setSaveSuccess(false)

      try {
        console.log('Saving settings...', settings)

        // Check if global shortcut has changed
        const shortcutChanged =
          originalSettings &&
          settings.global_shortcut !== originalSettings.global_shortcut

        // Save settings first
        await invoke('save_settings', { settings })
        console.log('Settings saved successfully')

        // Update global shortcut if it changed
        if (shortcutChanged) {
          try {
            // Normalize shortcut format for consistency (Ctrl -> CmdOrCtrl on non-Mac)
            const normalizedShortcut = settings.global_shortcut.startsWith(
              'Ctrl+'
            )
              ? settings.global_shortcut.replace('Ctrl+', 'CmdOrCtrl+')
              : settings.global_shortcut

            await invoke('update_global_shortcut', {
              newShortcut: normalizedShortcut,
            })
            console.log('Global shortcut updated to:', normalizedShortcut)
          } catch (shortcutError) {
            console.error('Failed to update global shortcut:', shortcutError)
            // Don't fail the save operation, but show a warning
            setSaveError(
              `Settings saved but failed to update global shortcut: ${shortcutError}`
            )
          }
        }

        // Reinitialize Whisper client if API key is provided
        if (
          settings.whisper.api_key &&
          settings.whisper.api_key.trim() !== ''
        ) {
          try {
            await invoke('init_whisper_client', {
              apiKey: settings.whisper.api_key,
            })
            console.log('Whisper client reinitialized with new API key')

            // Also reinitialize GPT client with the same API key
            try {
              await invoke('init_gpt_client', {
                apiKey: settings.whisper.api_key,
              })
              console.log('GPT client reinitialized with new API key')
            } catch (gptError) {
              console.warn(
                'GPT client reinitialization failed (non-critical):',
                gptError
              )
            }
          } catch (whisperError) {
            console.error(
              'Failed to reinitialize Whisper client:',
              whisperError
            )
            // Don't fail the save operation for this, just log it
          }
        }

        // Save profiles using Redux profiles state
        const profileCollection: ProfileCollection = {
          profiles,
          default_profile_id:
            profiles.find((p) => p.active)?.id || profiles[0]?.id || '',
        }
        await invoke('save_profiles', { profiles: profileCollection })
        console.log('Profiles saved successfully')

        // Update original settings to reflect the saved state
        setOriginalSettings(JSON.parse(JSON.stringify(settings))) // Deep copy
        setHasUnsavedChanges(false)
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
        setSaveSuccess(false)
        setApiKeyTestSuccess(false)

        console.log(
          'Testing API key:',
          settings.whisper.api_key.substring(0, 10) + '...'
        )

        // Test the API key with actual OpenAI API call
        const result = await invoke<string>('test_api_key', {
          apiKey: settings.whisper.api_key,
        })
        console.log('API key test successful:', result)

        // Show success message indicating the API key is valid
        setApiKeyTestSuccess(true)
        setTimeout(() => setApiKeyTestSuccess(false), 5000) // Clear success message after 5 seconds
      } catch (error) {
        console.error('API key test failed:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'API key test failed'

        setSaveError(errorMessage)
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
        let isNewProfile = false

        if (existingProfileIndex >= 0 && profile.id) {
          // Update existing profile
          updatedProfiles = [...profiles]
          updatedProfiles[existingProfileIndex] = {
            ...profile,
            updated_at: new Date().toISOString(),
          }
        } else {
          // Add new profile - generate ID if not present
          isNewProfile = true
          const newProfile = {
            ...profile,
            id: profile.id || Date.now().toString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          updatedProfiles = [...profiles, newProfile]
        }

        // Save to backend
        const profileCollection: ProfileCollection = {
          profiles: updatedProfiles,
          default_profile_id:
            profiles.find((p) => p.active)?.id || updatedProfiles[0]?.id || '',
        }

        await invoke('save_profiles', { profiles: profileCollection })

        // Reload profiles to sync with backend
        await loadProfiles()

        setView('overview')
        setEditingProfile(null)

        // Show success toast
        toast.success(
          isNewProfile
            ? 'Profile created successfully!'
            : 'Profile updated successfully!',
          {
            description: `Profile "${profile.name}" has been saved.`,
            duration: 3000,
          }
        )
      } catch (error) {
        console.error('Failed to save profile:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to save profile'
        setSaveError(errorMessage)

        // Also show error toast
        toast.error('Failed to save profile', {
          description: errorMessage,
          duration: 5000,
        })
      }
    },
    deleteProfile: async (profileId: string) => {
      // Prevent deletion of clipboard profile
      if (profileId === '1') {
        const errorMessage = 'Cannot delete the clipboard profile'
        setSaveError(errorMessage)
        toast.error('Cannot delete profile', {
          description: errorMessage,
          duration: 5000,
        })
        return
      }

      try {
        const profileToDelete = profiles.find((p) => p.id === profileId)
        const updatedProfiles = profiles.filter((p) => p.id !== profileId)

        const profileCollection: ProfileCollection = {
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

        // Show success toast
        toast.success('Profile deleted successfully!', {
          description: `Profile "${
            profileToDelete?.name || 'Unknown'
          }" has been removed.`,
          duration: 3000,
        })
      } catch (error) {
        console.error('Failed to delete profile:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete profile'
        setSaveError(errorMessage)

        // Also show error toast
        toast.error('Failed to delete profile', {
          description: errorMessage,
          duration: 5000,
        })
      }
    },
    toggleProfileVisibility: async (profileId: string, visible: boolean) => {
      // Prevent hiding clipboard profile
      if (profileId === '1' && !visible) {
        setSaveError('Clipboard profile must always be visible')
        return
      }

      // Count visible profiles excluding clipboard profile for the 4-profile limit
      const visibleUserProfiles = profiles.filter(
        (p) => p.visible && p.id !== '1'
      )
      const visibleCount = visibleUserProfiles.length

      try {
        let updatedProfiles = [...profiles]

        if (visible && visibleCount >= 4 && profileId !== '1') {
          // If trying to make visible but already at 4 user profiles limit, hide the oldest visible user profile first
          if (visibleUserProfiles.length > 0) {
            // Find the user profile that was updated longest ago (oldest)
            const oldestVisible = visibleUserProfiles.reduce(
              (oldest, current) => {
                return new Date(current.updated_at) <
                  new Date(oldest.updated_at)
                  ? current
                  : oldest
              }
            )

            // Hide the oldest visible user profile
            updatedProfiles = updatedProfiles.map((p) =>
              p.id === oldestVisible.id
                ? { ...p, visible: false, updated_at: new Date().toISOString() }
                : p
            )
          }
        }

        // Now update the target profile
        updatedProfiles = updatedProfiles.map((p) =>
          p.id === profileId
            ? { ...p, visible, updated_at: new Date().toISOString() }
            : p
        )

        const profileCollection: ProfileCollection = {
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
    reorderProfiles: async (activeId: string, overId: string) => {
      // Prevent reordering clipboard profile
      if (activeId === '1' || overId === '1') {
        setSaveError('Cannot reorder the clipboard profile')
        return
      }

      try {
        // Only reorder non-clipboard profiles
        const userProfiles = profiles.filter((p) => p.id !== '1')
        const clipboardProfile = profiles.find((p) => p.id === '1')

        // Find the indices of the profiles being reordered within user profiles
        const activeIndex = userProfiles.findIndex((p) => p.id === activeId)
        const overIndex = userProfiles.findIndex((p) => p.id === overId)

        if (activeIndex === -1 || overIndex === -1) return

        // Create a new array with the reordered user profiles
        const reorderedUserProfiles = [...userProfiles]
        const [movedProfile] = reorderedUserProfiles.splice(activeIndex, 1)
        reorderedUserProfiles.splice(overIndex, 0, movedProfile)

        // Combine clipboard profile with reordered user profiles
        const updatedProfiles = clipboardProfile
          ? [clipboardProfile, ...reorderedUserProfiles]
          : reorderedUserProfiles

        // Update timestamps for the moved profiles
        const profilesWithTimestamp = updatedProfiles.map((profile) => ({
          ...profile,
          updated_at: new Date().toISOString(),
        }))

        const profileCollection: ProfileCollection = {
          profiles: profilesWithTimestamp,
          default_profile_id:
            profiles.find((p) => p.active)?.id ||
            profilesWithTimestamp[0]?.id ||
            '',
        }

        await invoke('save_profiles', { profiles: profileCollection })

        // Reload profiles to sync with backend
        await loadProfiles()

        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      } catch (error) {
        console.error('Failed to reorder profiles:', error)
        setSaveError(
          error instanceof Error ? error.message : 'Failed to reorder profiles'
        )
      }
    },

    // Utility actions
    captureShortcut: () => {
      if (isCapturingShortcut) {
        // If already capturing, cancel capture
        setIsCapturingShortcut(false)
        return
      }

      setIsCapturingShortcut(true)
      setSaveError(null) // Clear any existing errors

      const handleKeyDown = (e: KeyboardEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const shortcut = buildShortcutString(e)

        // Only accept complete shortcuts with non-modifier keys
        if (shortcut && isCompleteShortcut(shortcut)) {
          // Update the shortcut (this will trigger validation)
          setSettings((prev) =>
            prev ? { ...prev, global_shortcut: shortcut } : null
          )

          // Stop capturing
          setIsCapturingShortcut(false)
          document.removeEventListener('keydown', handleKeyDown)
          document.removeEventListener('click', handleClickOutside)

          // Trigger validation immediately
          validateShortcutRealTime(shortcut).then((result) => {
            setShortcutValidation({
              isValidating: false,
              isValid: result.isValid,
              error: result.error,
            })
          })
        }
        // If shortcut is incomplete, continue capturing without stopping
      }

      const handleClickOutside = () => {
        setIsCapturingShortcut(false)
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('click', handleClickOutside)
      }

      document.addEventListener('keydown', handleKeyDown)
      // Add click outside to cancel capture
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 100) // Small delay to prevent immediate cancellation
    },
  }

  const onMount = useCallback(() => {
    loadSettingsData()
  }, [])

  return { state, actions, onMount }
}
