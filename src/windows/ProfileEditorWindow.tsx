import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { TooltipProvider } from '../components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Profile } from '@/store/slices/appSlice'
import { useProfileEditorViewModel } from './profileEditorWindow.viewModel'
import { useProfileEditorWindowViewModel } from './profileEditorWindow.viewModel'

interface ProfileEditorWindowProps {
  profile: Profile
  onSave: (profile: Profile) => void
  onDelete: (profileId: string) => void
  onBack: () => void
}

export default function ProfileEditorWindow({
  profile,
  onSave,
  onDelete,
  onBack,
}: ProfileEditorWindowProps) {
  const { onMount: onWindowMount } = useProfileEditorWindowViewModel()
  const { state, actions, onMount } = useProfileEditorViewModel(
    profile,
    onSave,
    onDelete,
    onBack
  )

  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(onWindowMount, [onWindowMount])
  useEffect(onMount, [])

  // Focus management - focus the first input when component mounts
  useEffect(() => {
    if (nameInputRef.current) {
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
    }
  }, [])

  return (
    <TooltipProvider>
      <div className="profile-editor-window">
        <div className="profile-editor">
          <div className="editor-header">
            <Button
              className="back-button"
              onClick={actions.navigateBack}
              aria-label="Go back to profiles list"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
            <h3>
              {state.isNewProfile ? 'Create New Profile' : 'Edit Profile'}
            </h3>
          </div>

          <div className="editor-content">
            <div className="profile-form">
              <div className="form-group">
                <label htmlFor="profile-name" className="form-label">
                  Profile Name *
                </label>
                <Input
                  id="profile-name"
                  ref={nameInputRef}
                  type="text"
                  value={state.formData.name}
                  onChange={(e) =>
                    actions.updateFormData('name', e.target.value)
                  }
                  placeholder="Enter profile name"
                  aria-describedby="name-error"
                  aria-invalid={!!state.errors.name}
                  maxLength={50}
                  required
                />
                {state.errors.name && (
                  <span id="name-error" className="form-error">
                    {state.errors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="profile-description" className="form-label">
                  Description
                </label>
                <Input
                  id="profile-description"
                  type="text"
                  value={state.formData.description || ''}
                  onChange={(e) =>
                    actions.updateFormData('description', e.target.value)
                  }
                  placeholder="Brief description of this profile"
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <label htmlFor="profile-prompt" className="form-label">
                  GPT Prompt
                </label>
                <Textarea
                  id="profile-prompt"
                  value={state.formData.prompt || ''}
                  onChange={(e) =>
                    actions.updateFormData('prompt', e.target.value)
                  }
                  placeholder="Instructions for GPT on how to format the transcribed text"
                  rows={4}
                  maxLength={1000}
                />
              </div>

              <div className="form-group">
                <label htmlFor="profile-example-input" className="form-label">
                  Example Input
                </label>
                <Textarea
                  id="profile-example-input"
                  value={state.formData.example_input || ''}
                  onChange={(e) =>
                    actions.updateFormData('example_input', e.target.value)
                  }
                  placeholder="Example of input text that would be transcribed"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label htmlFor="profile-example-output" className="form-label">
                  Example Output
                </label>
                <Textarea
                  id="profile-example-output"
                  value={state.formData.example_output || ''}
                  onChange={(e) =>
                    actions.updateFormData('example_output', e.target.value)
                  }
                  placeholder="Example of how the text should be formatted"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label htmlFor="profile-shortcut" className="form-label">
                  Keyboard Shortcut
                </label>
                <Input
                  id="profile-shortcut"
                  type="text"
                  value={state.formData.shortcut || ''}
                  onChange={(e) =>
                    actions.updateFormData('shortcut', e.target.value)
                  }
                  placeholder="e.g., Ctrl+Shift+1"
                  maxLength={50}
                />
              </div>

              <div className="form-group checkbox-group">
                <div className="checkbox-item">
                  <Switch
                    id="profile-visible"
                    checked={state.formData.visible || false}
                    onCheckedChange={(checked) =>
                      actions.updateFormData('visible', checked)
                    }
                    aria-describedby="visible-description"
                  />
                  <label htmlFor="profile-visible" className="checkbox-label">
                    Visible in Main Window
                  </label>
                </div>
                <span id="visible-description" className="checkbox-description">
                  Show this profile as a button in the main window (max 4
                  profiles)
                </span>
              </div>

              <div className="form-group checkbox-group">
                <div className="checkbox-item">
                  <Switch
                    id="profile-active"
                    checked={state.formData.active || false}
                    onCheckedChange={(checked) =>
                      actions.updateFormData('active', checked)
                    }
                    aria-describedby="active-description"
                  />
                  <label htmlFor="profile-active" className="checkbox-label">
                    Set as Default Profile
                  </label>
                </div>
                <span id="active-description" className="checkbox-description">
                  Use this profile by default when starting recordings
                </span>
              </div>
            </div>

            <div className="editor-actions">
              {!state.isNewProfile && (
                <Button
                  variant="destructive"
                  onClick={actions.handleDelete}
                  className="delete-button"
                  aria-label={`Delete ${state.formData.name} profile`}
                >
                  Delete Profile
                </Button>
              )}

              <div className="save-actions">
                <Button
                  variant="outline"
                  onClick={actions.navigateBack}
                  className="cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  onClick={actions.handleSave}
                  disabled={!actions.canSave()}
                  className="save-button"
                  aria-label={
                    state.isNewProfile ? 'Create profile' : 'Save changes'
                  }
                >
                  {state.isNewProfile ? 'Create Profile' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
