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

  // No event listeners in profile editor window - state comes from Redux
  // Main window handles all backend event listening and updates Redux store
  // Profile editor window consumes state via Redux selectors

  const onMount = useCallback(() => {
    // Profile editor window initialization (no event listeners)
    console.log(
      'Profile editor window mounted - using Redux for state management'
    )

    // Return no cleanup function since we have no event listeners
    return () => {
      // No cleanup needed
    }
  }, [])

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
