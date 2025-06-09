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

        // Save settings first
        await invoke('save_settings', { settings })
        console.log('Settings saved successfully')

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
          } catch (whisperError) {
            console.error(
              'Failed to reinitialize Whisper client:',
              whisperError
            )
            // Don't fail the save operation for this, just log it
          }
        }

        // Save profiles
        await invoke('save_profiles', { profiles })
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

        console.log(
          'Testing API key:',
          settings.whisper.api_key.substring(0, 10) + '...'
        )

        // Test API key by initializing the Whisper client
        await invoke('init_whisper_client', {
          apiKey: settings.whisper.api_key,
        })
        console.log('API key test successful - Whisper client initialized')

        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } catch (error) {
        console.error('API key test failed:', error)
        setSaveError(
          error instanceof Error
            ? `API key test failed: ${error.message}`
            : 'API key test failed'
        )
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

        if (existingProfileIndex >= 0 && profile.id) {
          // Update existing profile
          updatedProfiles = [...profiles]
          updatedProfiles[existingProfileIndex] = {
            ...profile,
            updated_at: new Date().toISOString(),
          }
        } else {
          // Add new profile - generate ID if not present
          const newProfile = {
            ...profile,
            id: profile.id || Date.now().toString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          updatedProfiles = [...profiles, newProfile]
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

      try {
        let updatedProfiles = [...profiles]

        if (visible && visibleCount >= 5) {
          // If trying to make visible but already at limit, hide the oldest visible profile first
          const visibleProfiles = profiles.filter(
            (p) => p.visible && p.id !== profileId
          )
          if (visibleProfiles.length > 0) {
            // Find the profile that was updated longest ago (oldest)
            const oldestVisible = visibleProfiles.reduce((oldest, current) => {
              return new Date(current.updated_at) < new Date(oldest.updated_at)
                ? current
                : oldest
            })

            // Hide the oldest visible profile
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
    reorderProfiles: async (activeId: string, overId: string) => {
      try {
        // Find the indices of the profiles being reordered
        const activeIndex = profiles.findIndex((p) => p.id === activeId)
        const overIndex = profiles.findIndex((p) => p.id === overId)

        if (activeIndex === -1 || overIndex === -1) return

        // Create a new array with the reordered profiles
        const reorderedProfiles = [...profiles]
        const [movedProfile] = reorderedProfiles.splice(activeIndex, 1)
        reorderedProfiles.splice(overIndex, 0, movedProfile)

        // Update timestamps for the moved profiles
        const updatedProfiles = reorderedProfiles.map((profile) => ({
          ...profile,
          updated_at: new Date().toISOString(),
        }))

        const profileCollection = {
          profiles: updatedProfiles,
          default_profile_id:
            profiles.find((p) => p.active)?.id || updatedProfiles[0]?.id || '',
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
