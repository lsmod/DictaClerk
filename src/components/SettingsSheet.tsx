import React, { useEffect } from 'react'
import {
  Plus,
  Edit,
  TestTube,
  Move,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProfileEditor from './ProfileEditor'
import { useSettingsSheetViewModel } from './settingsSheet.viewModel'
import { Profile } from '@/contexts/ProfileContext'

interface SettingsSheetProps {
  onClose: () => void
}

interface SortableProfileRowProps {
  profile: Profile
  visibleProfilesCount: number
  onToggleVisibility: (profileId: string, visible: boolean) => void
  onEdit: (profile: Profile) => void
}

function SortableProfileRow({
  profile,
  visibleProfilesCount,
  onToggleVisibility,
  onEdit,
}: SortableProfileRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: profile.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`profile-row ${isDragging ? 'dragging' : ''}`}
    >
      <div className="drag-handle" {...attributes} {...listeners}>
        <Move size={14} />
      </div>
      <span className="profile-name">{profile.name || 'Untitled'}</span>
      <div className="profile-controls">
        <div className="visible-checkbox">
          <Checkbox
            checked={profile.visible || false}
            onCheckedChange={(checked) =>
              onToggleVisibility(profile.id, checked as boolean)
            }
            disabled={!profile.visible && visibleProfilesCount >= 5}
            className={
              !profile.visible && visibleProfilesCount >= 5
                ? 'disabled-checkbox'
                : ''
            }
          />
          {profile.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </div>
        <Button
          type="button"
          size="sm"
          className="edit-button"
          onClick={() => onEdit(profile)}
        >
          <Edit size={12} />
        </Button>
      </div>
    </div>
  )
}

const SettingsSheet: React.FC<SettingsSheetProps> = ({ onClose }) => {
  const { state, actions, onMount } = useSettingsSheetViewModel(onClose)
  useEffect(onMount, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    actions.reorderProfiles(String(active.id), String(over.id))
  }

  // Show loading state while data is loading
  if (state.isLoadingSettings || state.isLoadingProfiles) {
    return (
      <div className="settings-content">
        <div className="settings-header">
          <h2>SETTINGS</h2>
        </div>
        <div className="loading-state">
          <Loader2 className="animate-spin" size={24} />
          <span>Loading settings...</span>
        </div>
      </div>
    )
  }

  // Show error state if there's a critical error
  if (state.settingsError && !state.settings) {
    return (
      <div className="settings-content">
        <div className="settings-header">
          <h2>SETTINGS</h2>
        </div>
        <div className="error-state">
          <AlertCircle size={24} />
          <span>Failed to load settings: {state.settingsError}</span>
          <Button onClick={onMount}>Retry</Button>
        </div>
      </div>
    )
  }

  if (state.view === 'editor' && state.editingProfile) {
    return (
      <ProfileEditor
        profile={state.editingProfile}
        onSave={actions.saveProfile}
        onDelete={actions.deleteProfile}
        onBack={actions.navigateBack}
      />
    )
  }

  return (
    <div className="settings-content">
      <div className="settings-header">
        <h2>SETTINGS</h2>
        {state.hasUnsavedChanges && (
          <div className="unsaved-indicator">
            <AlertCircle size={16} />
            <span>Unsaved changes</span>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {state.settingsError && (
        <div className="error-message">
          <AlertCircle size={16} />
          Warning: {state.settingsError}
        </div>
      )}

      {state.profilesError && (
        <div className="error-message">
          <AlertCircle size={16} />
          Profiles Error: {state.profilesError}
        </div>
      )}

      {state.saveError && (
        <div className="error-message">
          <AlertCircle size={16} />
          Save Error: {state.saveError}
        </div>
      )}

      {state.saveSuccess && (
        <div className="success-message">Settings saved successfully!</div>
      )}

      <div className="settings-form">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label>Global Shortcut</label>
            <div className="shortcut-input-group">
              <Input
                value={state.settings?.global_shortcut || ''}
                onChange={(e) => actions.updateGlobalShortcut(e.target.value)}
                placeholder={
                  state.isCapturingShortcut
                    ? 'Press keys...'
                    : 'Enter shortcut...'
                }
                className={`shortcut-input ${
                  !state.shortcutValidation.isValid &&
                  state.settings?.global_shortcut
                    ? 'error'
                    : ''
                } ${state.isCapturingShortcut ? 'capturing' : ''}`}
                readOnly={state.isCapturingShortcut}
              />
              <Button
                type="button"
                className={`capture-button ${
                  state.isCapturingShortcut ? 'capturing' : ''
                }`}
                onClick={actions.captureShortcut}
              >
                {state.isCapturingShortcut ? 'Cancel' : 'Capture'}
              </Button>
            </div>
            {/* Validation feedback */}
            {state.shortcutValidation.isValidating && (
              <div className="validation-feedback validating">
                <Loader2 className="animate-spin" size={12} />
                <span>Validating shortcut...</span>
              </div>
            )}
            {!state.shortcutValidation.isValid &&
              state.settings?.global_shortcut &&
              !state.shortcutValidation.isValidating && (
                <div className="validation-feedback error">
                  <AlertCircle size={12} />
                  <span>{state.shortcutValidation.error}</span>
                </div>
              )}
            {state.isCapturingShortcut && (
              <div className="validation-feedback info">
                <span>Press the key combination you want to use...</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>OpenAI API Key</label>
            <div className="api-key-group">
              <Input
                type="password"
                value={state.settings?.whisper.api_key || ''}
                onChange={(e) => actions.updateApiKey(e.target.value)}
                placeholder="sk-..."
                className="api-key-input"
              />
              <Button
                type="button"
                className="test-button"
                onClick={actions.testApiKey}
                disabled={
                  state.isTestingApiKey || !state.settings?.whisper.api_key
                }
              >
                {state.isTestingApiKey ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube size={16} />
                    Test
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="profiles-section">
            <label>Profiles ({state.visibleProfilesCount}/5 visible)</label>
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={state.profiles.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="profiles-list">
                  {state.profiles.map((profile) => (
                    <SortableProfileRow
                      key={profile.id}
                      profile={profile}
                      visibleProfilesCount={state.visibleProfilesCount}
                      onToggleVisibility={actions.toggleProfileVisibility}
                      onEdit={actions.navigateToEditor}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <Button
            type="button"
            className="add-profile-button"
            onClick={actions.navigateToAddProfile}
          >
            <Plus size={16} />
            Add Profile
          </Button>

          {/* Save Settings Button */}
          <div className="settings-actions">
            <Button
              type="button"
              className={`save-settings-button ${
                state.hasUnsavedChanges ? 'has-changes' : ''
              }`}
              onClick={actions.saveSettings}
              disabled={
                state.isSaving ||
                !state.settings ||
                !state.hasUnsavedChanges ||
                (!state.shortcutValidation.isValid &&
                  Boolean(state.settings?.global_shortcut)) ||
                state.shortcutValidation.isValidating
              }
            >
              {state.isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SettingsSheet
