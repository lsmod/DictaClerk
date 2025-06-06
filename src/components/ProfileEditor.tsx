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

  return (
    <div className="profile-editor">
      <div className="editor-header">
        <Button className="back-button" onClick={actions.navigateBack}>
          <ArrowLeft size={16} />
        </Button>
        <h3>Profile Editor</h3>
      </div>

      <div className="editor-form">
        <div className="form-group">
          <label>Name *</label>
          <Input
            value={state.formData.name || ''}
            onChange={(e) => actions.updateName(e.target.value)}
            className={state.errors.name ? 'error' : ''}
          />
          {state.errors.name && (
            <span className="error-text">{state.errors.name}</span>
          )}
        </div>

        <div className="form-group">
          <label>Description</label>
          <Input
            value={state.formData.description || ''}
            onChange={(e) => actions.updateDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Prompt *</label>
          <Textarea
            value={state.formData.prompt || ''}
            onChange={(e) => actions.updatePrompt(e.target.value)}
            className={state.errors.prompt ? 'error' : ''}
            rows={4}
          />
          {state.errors.prompt && (
            <span className="error-text">{state.errors.prompt}</span>
          )}
        </div>

        <div className="form-group">
          <label>Example Input</label>
          <Textarea
            value={state.formData.example_input || ''}
            onChange={(e) => actions.updateExampleInput(e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Example Output</label>
          <Textarea
            value={state.formData.example_output || ''}
            onChange={(e) => actions.updateExampleOutput(e.target.value)}
            className={state.errors.example_output ? 'error' : ''}
            rows={3}
          />
          {state.errors.example_output && (
            <span className="error-text">{state.errors.example_output}</span>
          )}
        </div>

        <div className="form-group">
          <label>Shortcut</label>
          <Input
            value={state.formData.shortcut || ''}
            onChange={(e) => actions.updateShortcut(e.target.value)}
            className="shortcut-field"
          />
        </div>

        <div className="form-group toggle-group">
          <label>Visible</label>
          <Switch
            checked={state.formData.visible || false}
            onCheckedChange={actions.updateVisible}
          />
        </div>

        <div className="editor-actions">
          <Button className="save-button" onClick={actions.saveProfile}>
            Save
          </Button>
          {profile.id && profile.created_at !== profile.updated_at && (
            <Button className="delete-button" onClick={actions.deleteProfile}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
