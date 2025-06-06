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
import ProfileEditor from './ProfileEditor'
import { useSettingsSheetViewModel } from './settingsSheet.viewModel'

interface SettingsSheetProps {
  onClose: () => void
}

const SettingsSheet: React.FC<SettingsSheetProps> = ({ onClose }) => {
  const { state, actions, onMount } = useSettingsSheetViewModel(onClose)
  useEffect(onMount, [])

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
                placeholder="Press keys..."
                className="shortcut-input"
              />
              <Button
                type="button"
                className="capture-button"
                onClick={actions.captureShortcut}
              >
                Capture
              </Button>
            </div>
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
            <div className="profiles-list">
              {state.profiles.map((profile) => (
                <div key={profile.id} className="profile-row">
                  <div className="drag-handle">
                    <Move size={14} />
                  </div>
                  <span className="profile-name">
                    {profile.name || 'Untitled'}
                  </span>
                  <div className="profile-controls">
                    <div className="visible-checkbox">
                      <Checkbox
                        checked={profile.visible || false}
                        onCheckedChange={(checked) =>
                          actions.toggleProfileVisibility(
                            profile.id,
                            checked as boolean
                          )
                        }
                        disabled={
                          !profile.visible && state.visibleProfilesCount >= 5
                        }
                        className={
                          !profile.visible && state.visibleProfilesCount >= 5
                            ? 'disabled-checkbox'
                            : ''
                        }
                      />
                      {profile.visible ? (
                        <Eye size={12} />
                      ) : (
                        <EyeOff size={12} />
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="edit-button"
                      onClick={() => actions.navigateToEditor(profile)}
                    >
                      <Edit size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
                state.isSaving || !state.settings || !state.hasUnsavedChanges
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
