import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Profile } from '@/contexts/ProfileContext'

interface ProfileEditorState {
  formData: Profile
  errors: Record<string, string>
  isNewProfile: boolean
}

interface ProfileEditorActions {
  updateName: (name: string) => void
  updateDescription: (description: string) => void
  updatePrompt: (prompt: string) => void
  updateExampleInput: (exampleInput: string) => void
  updateExampleOutput: (exampleOutput: string) => void
  updateShortcut: (shortcut: string) => void
  updateVisible: (visible: boolean) => void
  saveProfile: () => void
  deleteProfile: () => void
  navigateBack: () => void
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

    if (!formData.prompt?.trim()) {
      newErrors.prompt = 'Prompt is required'
    }

    if (formData.example_input?.trim() && !formData.example_output?.trim()) {
      newErrors.example_output =
        'Example Output is required when Example Input is provided'
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
    updateName: (name: string) => {
      setFormData((prev) => ({ ...prev, name }))
    },
    updateDescription: (description: string) => {
      setFormData((prev) => ({ ...prev, description }))
    },
    updatePrompt: (prompt: string) => {
      setFormData((prev) => ({ ...prev, prompt }))
    },
    updateExampleInput: (exampleInput: string) => {
      setFormData((prev) => ({ ...prev, example_input: exampleInput }))
    },
    updateExampleOutput: (exampleOutput: string) => {
      setFormData((prev) => ({ ...prev, example_output: exampleOutput }))
    },
    updateShortcut: (shortcut: string) => {
      setFormData((prev) => ({ ...prev, shortcut }))
    },
    updateVisible: (visible: boolean) => {
      setFormData((prev) => ({ ...prev, visible }))
    },
    saveProfile: () => {
      if (validateForm()) {
        onSave(formData)
      }
    },
    deleteProfile: () => {
      if (
        profile.id &&
        confirm('Are you sure you want to delete this profile?')
      ) {
        onDelete(profile.id)
      }
    },
    navigateBack: onBack,
  }

  const onMount = () => {
    // No initialization needed for ProfileEditor
  }

  return { state, actions, onMount }
}
