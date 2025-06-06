import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft,
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { useProfiles, Profile } from '@/contexts/ProfileContext'
import { SettingsConfig } from '@/types/settings'
import { invoke } from '@tauri-apps/api/core'

interface SettingsSheetProps {
  onClose: () => void
}

const SettingsSheet: React.FC<SettingsSheetProps> = ({ onClose }) => {
  const [view, setView] = useState<'overview' | 'editor'>('overview')
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<SettingsConfig | null>(null)
  const [originalSettings, setOriginalSettings] =
    useState<SettingsConfig | null>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isTestingApiKey, setIsTestingApiKey] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Ref to track if we're currently saving to prevent unnecessary dirty state updates
  const isSavingRef = useRef(false)

  const {
    profiles,
    isLoading: isLoadingProfiles,
    error: profilesError,
    loadProfiles,
  } = useProfiles()

  // Check if settings have changed (dirty state)
  const checkForChanges = useCallback(
    (
      currentSettings: SettingsConfig | null,
      original: SettingsConfig | null
    ) => {
      if (!currentSettings || !original || isSavingRef.current) return false

      return JSON.stringify(currentSettings) !== JSON.stringify(original)
    },
    []
  )

  // Update dirty state when settings change
  useEffect(() => {
    const hasChanges = checkForChanges(settings, originalSettings)
    setHasUnsavedChanges(hasChanges)
  }, [settings, originalSettings, checkForChanges])

  // Load settings data on component mount
  useEffect(() => {
    loadSettingsData()
  }, [])

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      const shouldDiscard = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      )
      if (!shouldDiscard) return
    }
    onClose()
  }, [hasUnsavedChanges, onClose])

  // Prevent accidental data loss
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Don't show modal if we're currently saving or if there are no unsaved changes
      if (isSavingRef.current || !hasUnsavedChanges) {
        return
      }

      e.preventDefault()
      e.returnValue =
        'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'editor') {
          setView('overview')
          setEditingProfile(null)
        } else {
          handleClose()
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasUnsavedChanges, view, handleClose])

  const loadSettingsData = async () => {
    try {
      setIsLoadingSettings(true)
      setSettingsError(null)
      console.log('Loading settings...')

      const settingsData = await invoke<SettingsConfig>('load_settings')
      console.log('Loaded settings:', settingsData)
      setSettings(settingsData)
      setOriginalSettings(JSON.parse(JSON.stringify(settingsData))) // Deep copy
    } catch (error) {
      console.error('Failed to load settings:', error)
      setSettingsError(
        error instanceof Error ? error.message : 'Failed to load settings'
      )

      // Create default settings if loading fails
      const defaultSettings = {
        whisper: {
          api_key: '',
          endpoint: 'https://api.openai.com/v1/audio/transcriptions',
          model: 'whisper-1',
          timeout_seconds: 30,
          max_retries: 3,
        },
        audio: {
          input_device: null,
          sample_rate: 44100,
          buffer_size: 1024,
        },
        encoding: {
          bitrate: 32000,
          size_limit_mb: 23,
        },
        ui: {
          theme: 'auto',
          auto_start_recording: false,
        },
        global_shortcut: 'CmdOrCtrl+Shift+F9',
      }
      setSettings(defaultSettings)
      setOriginalSettings(JSON.parse(JSON.stringify(defaultSettings)))
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const handleSaveSettings = async (e?: React.MouseEvent) => {
    // Prevent any default button behavior
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (!settings) return

    try {
      isSavingRef.current = true
      setIsSaving(true)
      setSaveError(null)
      setSaveSuccess(false)

      console.log('Saving settings:', settings)

      // Check if global shortcut changed
      const shortcutChanged =
        originalSettings &&
        settings.global_shortcut !== originalSettings.global_shortcut

      // Save settings to backend
      const result = await invoke<string>('save_settings', { settings })
      console.log('Save result:', result)

      // If global shortcut changed, update it immediately
      if (shortcutChanged) {
        try {
          console.log('Updating global shortcut to:', settings.global_shortcut)
          await invoke<string>('update_global_shortcut', {
            newShortcut: settings.global_shortcut,
          })
          console.log('Global shortcut updated successfully')
        } catch (shortcutError) {
          console.error('Failed to update global shortcut:', shortcutError)
          setSaveError(
            shortcutError instanceof Error
              ? `Settings saved but failed to update global shortcut: ${shortcutError.message}`
              : 'Settings saved but failed to update global shortcut'
          )
        }
      }

      // Update original settings to current settings (reset dirty state)
      setOriginalSettings(JSON.parse(JSON.stringify(settings)))

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000) // Clear success message after 3 seconds
    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save settings'
      )
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  const handleTestApiKey = async () => {
    if (!settings?.whisper.api_key) {
      setSaveError('Please enter an API key first')
      return
    }

    try {
      setIsTestingApiKey(true)
      setSaveError(null)

      // Test API key by making a simple request
      // TODO: Implement actual API key testing via IPC command
      console.log(
        'Testing API key:',
        settings.whisper.api_key.substring(0, 10) + '...'
      )

      // For now, just simulate a test
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('API key test failed:', error)
      setSaveError('API key test failed')
    } finally {
      setIsTestingApiKey(false)
    }
  }

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile)
    setView('editor')
  }

  const handleAddProfile = () => {
    const newProfile: Profile = {
      id: Date.now().toString(),
      name: '',
      description: '',
      prompt: '',
      example_input: '',
      example_output: '',
      active: false,
      visible: false,
      shortcut: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setEditingProfile(newProfile)
    setView('editor')
  }

  const handleSaveProfile = async (profile: Profile) => {
    try {
      // Find existing profile or add new one
      const existingProfileIndex = profiles.findIndex(
        (p) => p.id === profile.id
      )
      let updatedProfiles: Profile[]

      if (existingProfileIndex >= 0) {
        // Update existing profile
        updatedProfiles = [...profiles]
        updatedProfiles[existingProfileIndex] = {
          ...profile,
          updated_at: new Date().toISOString(),
        }
      } else {
        // Add new profile
        updatedProfiles = [
          ...profiles,
          {
            ...profile,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      }

      // Save to backend
      const profileCollection = {
        profiles: updatedProfiles,
        default_profile_id:
          profiles.find((p) => p.active)?.id || updatedProfiles[0]?.id || '',
      }

      await invoke('save_profiles', { profiles: profileCollection })

      // Reload profiles to sync with backend
      await loadProfiles()

      setView('overview')
      setEditingProfile(null)
    } catch (error) {
      console.error('Failed to save profile:', error)
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save profile'
      )
    }
  }

  const handleDeleteProfile = async (profileId: string) => {
    try {
      const updatedProfiles = profiles.filter((p) => p.id !== profileId)

      const profileCollection = {
        profiles: updatedProfiles,
        default_profile_id:
          profiles.find((p) => p.active && p.id !== profileId)?.id ||
          updatedProfiles[0]?.id ||
          '',
      }

      await invoke('save_profiles', { profiles: profileCollection })

      // Reload profiles to sync with backend
      await loadProfiles()

      setView('overview')
      setEditingProfile(null)
    } catch (error) {
      console.error('Failed to delete profile:', error)
      setSaveError(
        error instanceof Error ? error.message : 'Failed to delete profile'
      )
    }
  }

  const handleToggleVisible = async (profileId: string, visible: boolean) => {
    const visibleCount = profiles.filter((p) => p.visible).length

    // Check if we're trying to make visible but already at limit
    if (visible && visibleCount >= 5) return

    try {
      const updatedProfiles = profiles.map((p) =>
        p.id === profileId
          ? { ...p, visible, updated_at: new Date().toISOString() }
          : p
      )

      const profileCollection = {
        profiles: updatedProfiles,
        default_profile_id:
          profiles.find((p) => p.active)?.id || updatedProfiles[0]?.id || '',
      }

      await invoke('save_profiles', { profiles: profileCollection })

      // Reload profiles to sync with backend
      await loadProfiles()
    } catch (error) {
      console.error('Failed to toggle profile visibility:', error)
      setSaveError(
        error instanceof Error ? error.message : 'Failed to update profile'
      )
    }
  }

  // Show loading state while data is loading
  if (isLoadingSettings || isLoadingProfiles) {
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
  if (settingsError && !settings) {
    return (
      <div className="settings-content">
        <div className="settings-header">
          <h2>SETTINGS</h2>
        </div>
        <div className="error-state">
          <AlertCircle size={24} />
          <span>Failed to load settings: {settingsError}</span>
          <Button onClick={loadSettingsData}>Retry</Button>
        </div>
      </div>
    )
  }

  if (view === 'editor' && editingProfile) {
    return (
      <ProfileEditor
        profile={editingProfile}
        onSave={handleSaveProfile}
        onDelete={handleDeleteProfile}
        onBack={() => {
          setView('overview')
          setEditingProfile(null)
        }}
      />
    )
  }

  const visibleProfilesCount = profiles.filter((p) => p.visible).length

  return (
    <div className="settings-content">
      <div className="settings-header">
        <h2>SETTINGS</h2>
        {hasUnsavedChanges && (
          <div className="unsaved-indicator">
            <AlertCircle size={16} />
            <span>Unsaved changes</span>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {settingsError && (
        <div className="error-message">
          <AlertCircle size={16} />
          Warning: {settingsError}
        </div>
      )}

      {profilesError && (
        <div className="error-message">
          <AlertCircle size={16} />
          Profiles Error: {profilesError}
        </div>
      )}

      {saveError && (
        <div className="error-message">
          <AlertCircle size={16} />
          Save Error: {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="success-message">Settings saved successfully!</div>
      )}

      <div className="settings-form">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label>Global Shortcut</label>
            <div className="shortcut-input-group">
              <Input
                value={settings?.global_shortcut || ''}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev ? { ...prev, global_shortcut: e.target.value } : null
                  )
                }
                placeholder="Press keys..."
                className="shortcut-input"
              />
              <Button
                type="button"
                className="capture-button"
                onClick={() => {
                  // TODO: Implement shortcut capture functionality
                  console.log('Capture shortcut clicked')
                }}
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
                value={settings?.whisper.api_key || ''}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev
                      ? {
                          ...prev,
                          whisper: { ...prev.whisper, api_key: e.target.value },
                        }
                      : null
                  )
                }
                placeholder="sk-..."
                className="api-key-input"
              />
              <Button
                type="button"
                className="test-button"
                onClick={handleTestApiKey}
                disabled={isTestingApiKey || !settings?.whisper.api_key}
              >
                {isTestingApiKey ? (
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
            <label>Profiles ({visibleProfilesCount}/5 visible)</label>
            <div className="profiles-list">
              {profiles.map((profile) => (
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
                          handleToggleVisible(profile.id, checked as boolean)
                        }
                        disabled={!profile.visible && visibleProfilesCount >= 5}
                        className={
                          !profile.visible && visibleProfilesCount >= 5
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
                      onClick={() => handleEditProfile(profile)}
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
            onClick={handleAddProfile}
          >
            <Plus size={16} />
            Add Profile
          </Button>

          {/* Save Settings Button */}
          <div className="settings-actions">
            <Button
              type="button"
              className={`save-settings-button ${
                hasUnsavedChanges ? 'has-changes' : ''
              }`}
              onClick={handleSaveSettings}
              disabled={isSaving || !settings || !hasUnsavedChanges}
            >
              {isSaving ? (
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

interface ProfileEditorProps {
  profile: Profile
  onSave: (profile: Profile) => void
  onDelete: (profileId: string) => void
  onBack: () => void
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profile,
  onSave,
  onDelete,
  onBack,
}) => {
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

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData)
    }
  }

  const handleDelete = () => {
    if (
      profile.id &&
      confirm('Are you sure you want to delete this profile?')
    ) {
      onDelete(profile.id)
    }
  }

  return (
    <div className="profile-editor">
      <div className="editor-header">
        <Button className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <h3>Profile Editor</h3>
      </div>

      <div className="editor-form">
        <div className="form-group">
          <label>Name *</label>
          <Input
            value={formData.name || ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label>Description</label>
          <Input
            value={formData.description || ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
          />
        </div>

        <div className="form-group">
          <label>Prompt *</label>
          <Textarea
            value={formData.prompt || ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, prompt: e.target.value }))
            }
            className={errors.prompt ? 'error' : ''}
            rows={4}
          />
          {errors.prompt && <span className="error-text">{errors.prompt}</span>}
        </div>

        <div className="form-group">
          <label>Example Input</label>
          <Textarea
            value={formData.example_input || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                example_input: e.target.value,
              }))
            }
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Example Output</label>
          <Textarea
            value={formData.example_output || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                example_output: e.target.value,
              }))
            }
            className={errors.example_output ? 'error' : ''}
            rows={3}
          />
          {errors.example_output && (
            <span className="error-text">{errors.example_output}</span>
          )}
        </div>

        <div className="form-group">
          <label>Shortcut</label>
          <Input
            value={formData.shortcut || ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, shortcut: e.target.value }))
            }
            className="shortcut-field"
          />
        </div>

        <div className="form-group toggle-group">
          <label>Visible</label>
          <Switch
            checked={formData.visible || false}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, visible: checked }))
            }
          />
        </div>

        <div className="editor-actions">
          <Button className="save-button" onClick={handleSave}>
            Save
          </Button>
          {profile.id && profile.created_at !== profile.updated_at && (
            <Button className="delete-button" onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsSheet
