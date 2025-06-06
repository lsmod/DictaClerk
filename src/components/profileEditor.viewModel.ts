import { useState } from 'react'
import { Profile } from '@/contexts/ProfileContext'

interface ProfileEditorState {
  formData: Profile
  errors: Record<string, string>
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
