import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Profile } from '@/store/slices/appSlice'

interface ProfileEditorState {
  formData: Profile
  errors: Record<string, string>
  isNewProfile: boolean
}

interface ProfileEditorActions {
  updateFormData: (field: keyof Profile, value: string | boolean) => void
  handleSave: () => void
  handleDelete: () => void
  navigateBack: () => void
  canSave: () => boolean
}

// Window-level view model
export function useProfileEditorWindowViewModel() {
  const closeProfileEditor = useCallback(() => {
    invoke('close_profile_editor_window').catch(console.error)
  }, [])

  const handleProfileEditorEvents = useCallback(() => {
    // Profile editor window specific logic can be added here
    console.log('Profile editor window mounted')
  }, [])

  const setupEventListeners = useCallback(() => {
    window.addEventListener('profile-editor-events', handleProfileEditorEvents)

    return () => {
      window.removeEventListener(
        'profile-editor-events',
        handleProfileEditorEvents
      )
    }
  }, [handleProfileEditorEvents])

  const onMount = useCallback(() => {
    const cleanup = setupEventListeners()
    return cleanup
  }, [setupEventListeners])

  return {
    state: {},
    actions: {
      closeProfileEditor,
    },
    onMount,
  }
}

// Component-level view model
export function useProfileEditorViewModel(
  profile: Profile,
  onSave: (profile: Profile) => void,
  onDelete: (profileId: string) => void,
  onBack: () => void
) {
  const [formData, setFormData] = useState<Profile>(profile)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const state: ProfileEditorState = {
    formData,
    errors,
    isNewProfile: !profile.id || profile.id === '',
  }

  const actions: ProfileEditorActions = {
    updateFormData: (field: keyof Profile, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      // Clear error for this field when user starts typing
      if (errors[field]) {
        setErrors((prev) => {
          const updated = { ...prev }
          delete updated[field]
          return updated
        })
      }
    },
    handleSave: () => {
      if (validateForm()) {
        onSave(formData)
      }
    },
    handleDelete: () => {
      if (
        profile.id &&
        confirm('Are you sure you want to delete this profile?')
      ) {
        onDelete(profile.id)
      }
    },
    navigateBack: onBack,
    canSave: () => {
      return Boolean(formData.name?.trim() && Object.keys(errors).length === 0)
    },
  }

  const onMount = () => {
    // No initialization needed for ProfileEditor
  }

  return { state, actions, onMount }
}
