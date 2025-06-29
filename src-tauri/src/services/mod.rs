pub mod clipboard_svc;
pub mod gpt_client;
pub mod notifier;
pub mod profile_engine;
pub mod shortcut_mgr;
pub mod size_guard;
pub mod system_tray;
pub mod whisper_client;

pub use clipboard_svc::{
    ClipboardError, ClipboardResult, ClipboardService, MockClipboardService, TauriClipboardService,
};
pub use gpt_client::{GptClient, GptError, GptResult};
pub use notifier::{
    MockNotifierService, NotificationLevel, Notifier, NotifierError, NotifierResult,
    TauriNotifierService,
};
pub use profile_engine::{
    Profile, ProfileCollection, ProfileEngine, ProfileEngineConfig, ProfileError, ProfileResult,
};
pub use shortcut_mgr::{
    ShortcutError, ShortcutEvent, ShortcutMgr, ShortcutMgrConfig, ShortcutResult,
};
pub use size_guard::{SizeGuard, SizeGuardConfig, SizeGuardError};
pub use system_tray::{
    SystemTrayConfig, SystemTrayError, SystemTrayResult, SystemTrayService, WindowState,
};
pub use whisper_client::{
    OpenAIWhisperClient, TranscriptionResponse, TranscriptionSegment, WhisperClient,
    WhisperClientConfig, WhisperError, WhisperResult,
};
