import React, { useState } from 'react'
import {
  ArrowLeft,
  Plus,
  Edit,
  TestTube,
  Move,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'

interface Profile {
  id: string
  name: string
  instruction: string
  exampleInput?: string
  exampleOutput?: string
  shortcut?: string
  visible: boolean
}

interface SettingsSheetProps {
  onClose: () => void
}

const SettingsSheet: React.FC<SettingsSheetProps> = ({ onClose }) => {
  const [view, setView] = useState<'overview' | 'editor'>('overview')
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [globalShortcut, setGlobalShortcut] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [isCapturingShortcut, setIsCapturingShortcut] = useState(false)

  const [profiles, setProfiles] = useState<Profile[]>([
    {
      id: '1',
      name: 'Profile 1',
      instruction: 'Default profile instruction',
      visible: true,
    },
    {
      id: '2',
      name: 'Profile 2',
      instruction: 'Second profile instruction',
      visible: true,
    },
    {
      id: '3',
      name: 'Profile 3',
      instruction: 'Third profile instruction',
      visible: false,
    },
  ])

  const visibleProfilesCount = profiles.filter((p) => p.visible).length

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile)
    setView('editor')
  }

  const handleAddProfile = () => {
    const newProfile: Profile = {
      id: Date.now().toString(),
      name: '',
      instruction: '',
      visible: false,
    }
    setEditingProfile(newProfile)
    setView('editor')
  }

  const handleSaveProfile = (profile: Profile) => {
    if (
      editingProfile?.id &&
      profiles.find((p) => p.id === editingProfile.id)
    ) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? profile : p))
      )
    } else {
      setProfiles((prev) => [...prev, profile])
    }
    setView('overview')
    setEditingProfile(null)
  }

  const handleDeleteProfile = (profileId: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== profileId))
    setView('overview')
    setEditingProfile(null)
  }

  const handleToggleVisible = (profileId: string, visible: boolean) => {
    if (visible && visibleProfilesCount >= 5) return
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, visible } : p))
    )
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (view === 'editor') {
        setView('overview')
        setEditingProfile(null)
      } else {
        onClose()
      }
    }
  }

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [view])

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

  return (
    <div className="settings-content">
      <div className="settings-header">
        <h2>SETTINGS</h2>
      </div>

      <div className="settings-form">
        <div className="form-group">
          <label>Global Shortcut</label>
          <div className="shortcut-input-group">
            <Input
              value={globalShortcut}
              onChange={(e) => setGlobalShortcut(e.target.value)}
              placeholder="Press keys..."
              className="shortcut-input"
              readOnly={isCapturingShortcut}
            />
            <Button
              className="capture-button"
              onClick={() => setIsCapturingShortcut(!isCapturingShortcut)}
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
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="api-key-input"
            />
            <Button className="test-button">
              <TestTube size={16} />
              Test
            </Button>
          </div>
        </div>

        <div className="profiles-section">
          <label>Profiles</label>
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
                      checked={profile.visible}
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
                    {profile.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </div>
                  <Button
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

        <Button className="add-profile-button" onClick={handleAddProfile}>
          <Plus size={16} />
          Add Profile
        </Button>
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

    if (!formData.instruction?.trim()) {
      newErrors.instruction = 'Instruction is required'
    }

    if (formData.exampleInput?.trim() && !formData.exampleOutput?.trim()) {
      newErrors.exampleOutput =
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
          <label>Instruction *</label>
          <Textarea
            value={formData.instruction || ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, instruction: e.target.value }))
            }
            className={errors.instruction ? 'error' : ''}
            rows={4}
          />
          {errors.instruction && (
            <span className="error-text">{errors.instruction}</span>
          )}
        </div>

        <div className="form-group">
          <label>Example Input</label>
          <Textarea
            value={formData.exampleInput || ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, exampleInput: e.target.value }))
            }
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Example Output</label>
          <Textarea
            value={formData.exampleOutput || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                exampleOutput: e.target.value,
              }))
            }
            className={errors.exampleOutput ? 'error' : ''}
            rows={3}
          />
          {errors.exampleOutput && (
            <span className="error-text">{errors.exampleOutput}</span>
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
            checked={formData.visible}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, visible: checked }))
            }
          />
        </div>

        <div className="editor-actions">
          <Button className="save-button" onClick={handleSave}>
            Save
          </Button>
          {profile.id && (
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
