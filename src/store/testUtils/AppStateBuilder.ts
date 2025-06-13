import { AppState, AppStatus } from '../slices/appSlice'

export class AppStateBuilder {
  private state: AppState

  constructor() {
    this.state = {
      status: 'idle',
      mainWindowVisible: true,
      hasModalWindow: false,
      windowState: {
        mainWindow: {
          visible: true,
          focused: true,
        },
        settingsWindow: {
          visible: false,
          focused: false,
        },
        profileEditorWindow: {
          visible: false,
          focused: false,
          editingProfileId: null,
        },
      },
      recordingStartTime: null,
      recordingTime: 0,
      originalTranscript: null,
      finalText: null,
      profileId: null,
      processingProgress: null,
      profiles: [],
      activeProfileId: null,
      profilesLoading: false,
      profilesError: null,
      error: null,
      errors: [],
      lastError: null,
      clipboard: {
        lastCopiedText: null,
        lastCopiedAt: null,
        copyHistory: [],
      },
      lastBackendSync: 0,
      backendConnected: true,
      connectionRetries: 0,
      systemTrayVisible: true,
      shortcutsEnabled: true,
      autoRecoveryMode: false,
    }
  }

  withStatus(status: AppStatus): AppStateBuilder {
    this.state.status = status
    return this
  }

  withRecording(startTime: number): AppStateBuilder {
    this.state.status = 'recording'
    this.state.recordingStartTime = startTime
    this.state.mainWindowVisible = true
    this.state.recordingTime = Date.now() - startTime
    return this
  }

  withProcessingTranscription(): AppStateBuilder {
    this.state.status = 'processing-transcription'
    this.state.mainWindowVisible = true
    return this
  }

  withProcessingGPTFormatting(
    transcript: string,
    profileId: string
  ): AppStateBuilder {
    this.state.status = 'processing-gpt-formatting'
    this.state.originalTranscript = transcript
    this.state.profileId = profileId
    this.state.mainWindowVisible = true
    return this
  }

  withProcessingClipboard(
    originalTranscript: string,
    finalText: string
  ): AppStateBuilder {
    this.state.status = 'processing-clipboard'
    this.state.originalTranscript = originalTranscript
    this.state.finalText = finalText
    this.state.mainWindowVisible = true
    return this
  }

  withProcessingComplete(
    transcript: string,
    finalText: string,
    profileId?: string
  ): AppStateBuilder {
    this.state.status = 'processing-complete'
    this.state.originalTranscript = transcript
    this.state.finalText = finalText
    this.state.profileId = profileId || null
    this.state.mainWindowVisible = true
    return this
  }

  withSettingsOpen(): AppStateBuilder {
    this.state.status = 'settings-open'
    this.state.hasModalWindow = true
    return this
  }

  withProfileEditorNew(): AppStateBuilder {
    this.state.status = 'profile-editor-new'
    this.state.hasModalWindow = true
    return this
  }

  withProfileEditorEdit(profileId: string): AppStateBuilder {
    this.state.status = 'profile-editor-edit'
    this.state.profileId = profileId
    this.state.hasModalWindow = true
    return this
  }

  withError(
    type:
      | 'transcription'
      | 'gpt-formatting'
      | 'clipboard'
      | 'profile-validation',
    message: string
  ): AppStateBuilder {
    this.state.status = `error-${type}` as AppStatus
    this.state.error = message
    this.state.mainWindowVisible = true
    return this
  }

  withWindowState(mainVisible: boolean, hasModal: boolean): AppStateBuilder {
    this.state.mainWindowVisible = mainVisible
    this.state.hasModalWindow = hasModal
    return this
  }

  withBackendSync(
    timestamp: number,
    connected: boolean = true
  ): AppStateBuilder {
    this.state.lastBackendSync = timestamp
    this.state.backendConnected = connected
    return this
  }

  withRecordingTime(time: number): AppStateBuilder {
    this.state.recordingTime = time
    return this
  }

  withTranscript(
    original: string | null,
    final?: string | null
  ): AppStateBuilder {
    this.state.originalTranscript = original
    if (final !== undefined) {
      this.state.finalText = final
    }
    return this
  }

  withProfileId(profileId: string | null): AppStateBuilder {
    this.state.profileId = profileId
    return this
  }

  // Convenience methods for common scenarios
  idle(): AppStateBuilder {
    return this.withStatus('idle')
      .withWindowState(true, false)
      .withBackendSync(Date.now())
  }

  recording(): AppStateBuilder {
    const now = Date.now()
    return this.withRecording(now - 5000) // 5 seconds ago
      .withBackendSync(now)
  }

  processingComplete(
    transcript: string = 'Test transcript',
    finalText: string = 'Formatted text'
  ): AppStateBuilder {
    return this.withProcessingComplete(
      transcript,
      finalText,
      'test-profile'
    ).withBackendSync(Date.now())
  }

  errorState(
    type:
      | 'transcription'
      | 'gpt-formatting'
      | 'clipboard'
      | 'profile-validation' = 'transcription'
  ): AppStateBuilder {
    return this.withError(type, `Test ${type} error`).withBackendSync(
      Date.now()
    )
  }

  disconnected(): AppStateBuilder {
    return this.withBackendSync(Date.now() - 30000, false) // 30 seconds ago, disconnected
  }

  build(): AppState {
    // Return a deep copy to ensure immutability
    return JSON.parse(JSON.stringify(this.state))
  }
}
