import React, { useEffect, useState, useRef } from 'react'
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
import ProfileEditorWindow from '../windows/ProfileEditorWindow'
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
  onKeyboardReorder?: (profileId: string, direction: 'up' | 'down') => void
  isDragActive?: boolean
  allProfiles: Profile[]
}

function SortableProfileRow({
  profile,
  visibleProfilesCount,
  onToggleVisibility,
  onEdit,
  onKeyboardReorder,
  isDragActive = false,
  allProfiles,
}: SortableProfileRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: profile.id })

  const [isKeyboardDragging, setIsKeyboardDragging] = useState(false)
  const dragHandleRef = useRef<HTMLDivElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition || 'transform 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    opacity: isDragging ? 0.5 : 1,
    rotate: isDragging ? '2deg' : '0deg',
    scale: isDragging ? '1.02' : '1',
    zIndex: isDragging ? 999 : 'auto',
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      onKeyboardReorder?.(profile.id, e.key === 'ArrowUp' ? 'up' : 'down')

      // Announce the reorder action to screen readers
      const direction = e.key === 'ArrowUp' ? 'up' : 'down'
      const announcement = `Moving ${
        profile.name || 'Untitled'
      } profile ${direction}`
      announceToScreenReader(announcement)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsKeyboardDragging(!isKeyboardDragging)

      const action = isKeyboardDragging ? 'released' : 'grabbed'
      const announcement = `${
        profile.name || 'Untitled'
      } profile ${action}. Use arrow keys to reorder.`
      announceToScreenReader(announcement)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsKeyboardDragging(false)
      announceToScreenReader(
        `Drag operation cancelled for ${profile.name || 'Untitled'} profile`
      )
    }
  }

  // Helper function to announce to screen readers
  const announceToScreenReader = (message: string) => {
    const announcement = document.getElementById('aria-live-region')
    if (announcement) {
      announcement.textContent = message
      // Clear after a brief delay
      setTimeout(() => {
        announcement.textContent = ''
      }, 1000)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`profile-row ${isDragging ? 'dragging' : ''} ${
        isKeyboardDragging ? 'keyboard-dragging' : ''
      } ${isDragActive ? 'drag-active' : ''}`}
      role="listitem"
      aria-label={`Profile ${profile.name || 'Untitled'}`}
      data-dragging={isDragActive}
    >
      <div
        ref={dragHandleRef}
        className="drag-handle"
        {...attributes}
        {...listeners}
        role="button"
        aria-label={`Reorder ${
          profile.name || 'Untitled'
        } profile. Current position ${getProfilePosition(
          profile.id,
          allProfiles
        )}.`}
        aria-describedby="drag-instructions"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-pressed={isKeyboardDragging}
        aria-roledescription="sortable"
      >
        <Move size={14} aria-hidden="true" />
      </div>
      <span className="profile-name">{profile.name || 'Untitled'}</span>
      <div className="profile-controls">
        <div className="visible-checkbox">
          <Checkbox
            checked={profile.visible || false}
            onCheckedChange={(checked) =>
              onToggleVisibility(profile.id, checked as boolean)
            }
            aria-label={`${profile.visible ? 'Hide' : 'Show'} ${
              profile.name || 'Untitled'
            } profile${
              !profile.visible && visibleProfilesCount >= 5
                ? ' (will auto-hide oldest visible profile)'
                : ''
            }`}
            title={
              !profile.visible && visibleProfilesCount >= 5
                ? 'Will automatically hide the oldest visible profile to make room'
                : profile.visible
                  ? `Hide ${profile.name || 'Untitled'} profile`
                  : `Show ${profile.name || 'Untitled'} profile`
            }
          />
          {profile.visible ? (
            <Eye size={10} aria-hidden="true" />
          ) : (
            <EyeOff size={10} aria-hidden="true" />
          )}
          {!profile.visible && visibleProfilesCount >= 5 && (
            <span
              className="visibility-limit-indicator"
              title="Will auto-hide oldest visible profile"
            >
              ↻
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          className="edit-button"
          onClick={() => onEdit(profile)}
          aria-label={`Edit ${profile.name || 'Untitled'} profile`}
        >
          <Edit size={12} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

// Helper function to get profile position
const getProfilePosition = (profileId: string, profiles: Profile[]): number => {
  return profiles.findIndex((p) => p.id === profileId) + 1
}

const SettingsSheet: React.FC<SettingsSheetProps> = ({ onClose }) => {
  const { state, actions, onMount } = useSettingsSheetViewModel(onClose)
  const saveButtonRef = useRef<HTMLButtonElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  useEffect(onMount, [])

  // Focus management after successful save
  useEffect(() => {
    if (state.saveSuccess && saveButtonRef.current) {
      setTimeout(() => {
        saveButtonRef.current?.focus()
      }, 100)
    }
  }, [state.saveSuccess])

  // Focus first input when creating new profile
  useEffect(() => {
    if (state.view === 'overview' && firstInputRef.current) {
      setTimeout(() => {
        firstInputRef.current?.focus()
      }, 100)
    }
  }, [state.view])

  const handleDragStart = () => {
    setIsDragActive(true)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setIsDragActive(false)

    if (!over || active.id === over.id) {
      return
    }

    actions.reorderProfiles(String(active.id), String(over.id))

    // Announce reorder completion to screen readers
    const activeProfile = state.profiles.find((p) => p.id === String(active.id))
    if (activeProfile) {
      const newPosition = getProfilePosition(String(active.id), state.profiles)
      const announcement = `${
        activeProfile.name || 'Untitled'
      } profile moved to position ${newPosition}`
      const liveRegion = document.getElementById('aria-live-region')
      if (liveRegion) {
        liveRegion.textContent = announcement
        setTimeout(() => {
          liveRegion.textContent = ''
        }, 1000)
      }
    }
  }

  const handleKeyboardReorder = (
    profileId: string,
    direction: 'up' | 'down'
  ) => {
    const currentIndex = state.profiles.findIndex((p) => p.id === profileId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= state.profiles.length) return

    const targetProfile = state.profiles[newIndex]
    actions.reorderProfiles(profileId, targetProfile.id)
  }

  // Loading state with skeleton
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
        {state.isLoadingProfiles && (
          <div className="profiles-skeleton">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="profile-skeleton" aria-hidden="true" />
            ))}
          </div>
        )}
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
      <ProfileEditorWindow
        profile={state.editingProfile}
        onSave={actions.saveProfile}
        onDelete={actions.deleteProfile}
        onBack={actions.navigateBack}
      />
    )
  }

  return (
    <div className="settings-content">
      {/* ARIA live region for announcements */}
      <div
        id="aria-live-region"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Hidden instructions for screen readers */}
      <div id="drag-instructions" className="sr-only">
        Use arrow keys to reorder profiles, Enter or Space to grab/release,
        Escape to cancel
      </div>

      <div className="settings-header">
        <h2>SETTINGS</h2>
        {state.hasUnsavedChanges && (
          <div className="unsaved-indicator" role="status" aria-live="polite">
            <AlertCircle size={16} />
            <span>Unsaved changes</span>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {state.settingsError && (
        <div className="error-message" role="alert" aria-live="assertive">
          <AlertCircle size={16} />
          Warning: {state.settingsError}
        </div>
      )}

      {state.profilesError && (
        <div className="error-message" role="alert" aria-live="assertive">
          <AlertCircle size={16} />
          Profiles Error: {state.profilesError}
        </div>
      )}

      {state.saveError && (
        <div className="error-message" role="alert" aria-live="assertive">
          <AlertCircle size={16} />
          Save Error: {state.saveError}
        </div>
      )}

      {state.saveSuccess && (
        <div className="success-message" role="status" aria-live="polite">
          Settings saved successfully!
        </div>
      )}

      <div className="settings-form">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label htmlFor="global-shortcut">Global Shortcut</label>
            <div className="shortcut-input-group">
              <Input
                ref={firstInputRef}
                id="global-shortcut"
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
                aria-describedby="shortcut-feedback"
                aria-invalid={
                  !state.shortcutValidation.isValid &&
                  !!state.settings?.global_shortcut
                }
              />
              <Button
                type="button"
                className={`capture-button ${
                  state.isCapturingShortcut ? 'capturing' : ''
                }`}
                onClick={actions.captureShortcut}
                aria-label={
                  state.isCapturingShortcut
                    ? 'Cancel shortcut capture'
                    : 'Capture new shortcut'
                }
              >
                {state.isCapturingShortcut ? 'Cancel' : 'Capture'}
              </Button>
            </div>
            {/* Validation feedback */}
            <div id="shortcut-feedback" aria-live="polite">
              {state.shortcutValidation.isValidating && (
                <div className="validation-feedback validating">
                  <Loader2 className="animate-spin" size={12} />
                  <span>Validating shortcut...</span>
                </div>
              )}
              {!state.shortcutValidation.isValid &&
                state.settings?.global_shortcut &&
                !state.shortcutValidation.isValidating && (
                  <div className="validation-feedback error" role="alert">
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
          </div>

          <div className="form-group">
            <label htmlFor="api-key">OpenAI API Key</label>
            <div className="api-key-group">
              <Input
                id="api-key"
                type="password"
                value={state.settings?.whisper.api_key || ''}
                onChange={(e) => actions.updateApiKey(e.target.value)}
                placeholder="sk-..."
                className="api-key-input"
                aria-describedby="api-key-help"
              />
              <div id="api-key-help" className="sr-only">
                Your OpenAI API key for Whisper transcription service
              </div>
              <Button
                type="button"
                className="test-button"
                onClick={actions.testApiKey}
                disabled={
                  state.isTestingApiKey || !state.settings?.whisper.api_key
                }
                aria-label="Test API key connection"
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
            <div className="profiles-header">
              <label id="profiles-label">
                Profiles ({state.visibleProfilesCount}/5 visible)
              </label>
              {state.visibleProfilesCount >= 5 && (
                <div
                  id="visibility-limit-notice"
                  className="visibility-limit-warning"
                >
                  ℹ️ Showing 5 profiles (maximum). Making another profile
                  visible will auto-hide the oldest one.
                </div>
              )}
            </div>
            <DndContext
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={state.profiles.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className="profiles-list"
                  role="list"
                  aria-labelledby="profiles-label"
                  data-dragging={isDragActive}
                >
                  {state.profiles.map((profile) => (
                    <SortableProfileRow
                      key={profile.id}
                      profile={profile}
                      visibleProfilesCount={state.visibleProfilesCount}
                      onToggleVisibility={actions.toggleProfileVisibility}
                      onEdit={actions.navigateToEditor}
                      onKeyboardReorder={handleKeyboardReorder}
                      isDragActive={isDragActive}
                      allProfiles={state.profiles}
                    />
                  ))}
                  {state.profiles.length === 0 && (
                    <div className="empty-profiles-message" role="status">
                      No profiles yet. Create your first profile below.
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <Button
            type="button"
            className="add-profile-button"
            onClick={actions.navigateToAddProfile}
            aria-label="Add new profile"
          >
            <Plus size={16} />
            Add Profile
          </Button>

          {/* Save Settings Button */}
          <div className="settings-actions">
            <Button
              ref={saveButtonRef}
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
              aria-label={`Save settings${
                state.hasUnsavedChanges ? ' (has unsaved changes)' : ''
              }`}
              aria-describedby={
                state.hasUnsavedChanges ? 'save-status' : undefined
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
            {state.hasUnsavedChanges && (
              <div id="save-status" className="sr-only">
                You have unsaved changes that will be lost if you navigate away
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default SettingsSheet
