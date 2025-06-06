import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Profile } from '@/contexts/ProfileContext'
import { useProfileEditorViewModel } from './profileEditor.viewModel'

interface ProfileEditorProps {
  profile: Profile
  onSave: (profile: Profile) => void
  onDelete: (profileId: string) => void
  onBack: () => void
}

export default function ProfileEditor({
  profile,
  onSave,
  onDelete,
  onBack,
}: ProfileEditorProps) {
  const { state, actions, onMount } = useProfileEditorViewModel(
    profile,
    onSave,
    onDelete,
    onBack
  )
  useEffect(onMount, [])

  const isNewProfile = !profile.id || profile.created_at === profile.updated_at

  return (
    <div className="profile-editor">
      <div className="editor-header">
        <Button
          className="back-button"
          onClick={actions.navigateBack}
          aria-label="Go back to profiles list"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </Button>
        <h3>{isNewProfile ? 'Create New Profile' : 'Edit Profile'}</h3>
      </div>

      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault()
          actions.saveProfile()
        }}
        noValidate
      >
        <div className="form-group">
          <label htmlFor="profile-name">Name *</label>
          <Input
            id="profile-name"
            value={state.formData.name || ''}
            onChange={(e) => actions.updateName(e.target.value)}
            className={state.errors.name ? 'error' : ''}
            aria-describedby={state.errors.name ? 'name-error' : undefined}
            aria-invalid={!!state.errors.name}
            required
            autoFocus
          />
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
            onChange={(e) => actions.updateDescription(e.target.value)}
            aria-describedby="description-help"
          />
          <span id="description-help" className="sr-only">
            Optional brief description of this profile's purpose
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="profile-prompt">Prompt *</label>
          <Textarea
            id="profile-prompt"
            value={state.formData.prompt || ''}
            onChange={(e) => actions.updatePrompt(e.target.value)}
            className={state.errors.prompt ? 'error' : ''}
            rows={4}
            aria-describedby={
              state.errors.prompt ? 'prompt-error' : 'prompt-help'
            }
            aria-invalid={!!state.errors.prompt}
            required
          />
          {!state.errors.prompt && (
            <span id="prompt-help" className="sr-only">
              The main prompt that will be used for AI processing
            </span>
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
            onChange={(e) => actions.updateExampleInput(e.target.value)}
            rows={3}
            aria-describedby="example-input-help"
          />
          <span id="example-input-help" className="sr-only">
            Optional example of input text for this profile
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="profile-example-output">Example Output</label>
          <Textarea
            id="profile-example-output"
            value={state.formData.example_output || ''}
            onChange={(e) => actions.updateExampleOutput(e.target.value)}
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
            <span id="example-output-help" className="sr-only">
              Optional example of expected output for this profile
            </span>
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
            onChange={(e) => actions.updateShortcut(e.target.value)}
            className="shortcut-field"
            aria-describedby="shortcut-help"
            placeholder="e.g., Ctrl+Shift+P"
          />
          <span id="shortcut-help" className="sr-only">
            Optional keyboard shortcut to activate this profile
          </span>
        </div>

        <div className="form-group toggle-group">
          <label htmlFor="profile-visible">Visible</label>
          <Switch
            id="profile-visible"
            checked={state.formData.visible || false}
            onCheckedChange={actions.updateVisible}
            aria-describedby="visible-help"
          />
          <span id="visible-help" className="sr-only">
            Whether this profile appears in the quick access list
          </span>
        </div>

        <div className="editor-actions">
          <Button
            type="submit"
            className="save-button"
            onClick={actions.saveProfile}
            aria-label={`${
              isNewProfile ? 'Create' : 'Save changes to'
            } profile ${state.formData.name || 'unnamed'}`}
          >
            {isNewProfile ? 'Create' : 'Save'}
          </Button>
          {profile.id && !isNewProfile && (
            <Button
              type="button"
              className="delete-button"
              onClick={actions.deleteProfile}
              aria-label={`Delete profile ${state.formData.name || 'unnamed'}`}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
