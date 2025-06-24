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
  useEffect(onMount, [onMount])

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

          <form
            className="editor-form"
            onSubmit={(e) => {
              e.preventDefault()
              actions.handleSave()
            }}
            noValidate
            aria-label={`${
              state.isNewProfile ? 'Create new' : 'Edit'
            } profile form`}
          >
            <div className="form-group">
              <label htmlFor="profile-name">Name *</label>
              <Input
                ref={nameInputRef}
                id="profile-name"
                value={state.formData.name || ''}
                onChange={(e) => actions.updateFormData('name', e.target.value)}
                className={state.errors.name ? 'error' : ''}
                aria-describedby={
                  state.errors.name ? 'name-error' : 'name-help'
                }
                aria-invalid={!!state.errors.name}
                required
              />
              {!state.errors.name && (
                <div id="name-help" className="sr-only">
                  Enter a descriptive name for this profile
                </div>
              )}
              {state.errors.name && (
                <span
                  id="name-error"
                  className="error-text"
                  role="alert"
                  aria-live="polite"
                >
                  {state.errors.name}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="profile-description">Description</label>
              <Input
                id="profile-description"
                value={state.formData.description || ''}
                onChange={(e) =>
                  actions.updateFormData('description', e.target.value)
                }
                aria-describedby="description-help"
              />
              <div id="description-help" className="sr-only">
                Optional brief description of this profile's purpose
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="profile-prompt">Prompt *</label>
              <Textarea
                id="profile-prompt"
                value={state.formData.prompt || ''}
                onChange={(e) =>
                  actions.updateFormData('prompt', e.target.value)
                }
                className={state.errors.prompt ? 'error' : ''}
                rows={4}
                aria-describedby={
                  state.errors.prompt ? 'prompt-error' : 'prompt-help'
                }
                aria-invalid={!!state.errors.prompt}
                required
              />
              {!state.errors.prompt && (
                <div id="prompt-help" className="sr-only">
                  The main prompt that will be used for AI processing. This is
                  the core instruction that guides how the AI will process your
                  input.
                </div>
              )}
              {state.errors.prompt && (
                <span
                  id="prompt-error"
                  className="error-text"
                  role="alert"
                  aria-live="polite"
                >
                  {state.errors.prompt}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="profile-example-input">Example Input</label>
              <Textarea
                id="profile-example-input"
                value={state.formData.example_input || ''}
                onChange={(e) =>
                  actions.updateFormData('example_input', e.target.value)
                }
                rows={3}
                aria-describedby="example-input-help"
              />
              <div id="example-input-help" className="sr-only">
                Optional example of input text for this profile. This helps
                demonstrate what kind of input this profile is designed to
                handle.
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="profile-example-output">Example Output</label>
              <Textarea
                id="profile-example-output"
                value={state.formData.example_output || ''}
                onChange={(e) =>
                  actions.updateFormData('example_output', e.target.value)
                }
                className={state.errors.example_output ? 'error' : ''}
                rows={3}
                aria-describedby={
                  state.errors.example_output
                    ? 'example-output-error'
                    : 'example-output-help'
                }
                aria-invalid={!!state.errors.example_output}
              />
              {!state.errors.example_output && (
                <div id="example-output-help" className="sr-only">
                  Optional example of expected output for this profile. This
                  shows what the AI should produce when processing the example
                  input.
                </div>
              )}
              {state.errors.example_output && (
                <span
                  id="example-output-error"
                  className="error-text"
                  role="alert"
                  aria-live="polite"
                >
                  {state.errors.example_output}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="profile-shortcut">Shortcut</label>
              <Input
                id="profile-shortcut"
                value={state.formData.shortcut || ''}
                onChange={(e) =>
                  actions.updateFormData('shortcut', e.target.value)
                }
                className="shortcut-field"
                aria-describedby="shortcut-help"
                placeholder="e.g., Ctrl+Shift+P"
              />
              <div id="shortcut-help" className="sr-only">
                Optional keyboard shortcut to activate this profile. Use
                standard modifier keys like Ctrl, Alt, Shift with other keys.
              </div>
            </div>

            <div className="form-group toggle-group">
              <label htmlFor="profile-visible">Visible in quick access</label>
              <Switch
                id="profile-visible"
                checked={state.formData.visible || false}
                onCheckedChange={(checked) =>
                  actions.updateFormData('visible', checked)
                }
                aria-describedby="visible-help"
              />
              <div id="visible-help" className="sr-only">
                When enabled, this profile appears in the quick access list.
                Maximum of 5 profiles can be visible at once.
              </div>
            </div>

            <div className="editor-actions">
              <Button
                type="submit"
                className="save-button"
                onClick={actions.handleSave}
                aria-label={`${
                  state.isNewProfile ? 'Create' : 'Save changes to'
                } profile ${state.formData.name || 'unnamed'}`}
              >
                {state.isNewProfile ? 'Create Profile' : 'Save Changes'}
              </Button>
              {profile.id && !state.isNewProfile && (
                <Button
                  type="button"
                  className="delete-button"
                  onClick={actions.handleDelete}
                  aria-label={`Delete profile ${
                    state.formData.name || 'unnamed'
                  }`}
                  aria-describedby="delete-warning"
                >
                  Delete Profile
                </Button>
              )}
              {profile.id && !state.isNewProfile && (
                <div id="delete-warning" className="sr-only">
                  Warning: Deleting this profile is permanent and cannot be
                  undone.
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </TooltipProvider>
  )
}
