pub mod audio;
pub mod clipboard;
pub mod encoder;
pub mod profiles;
pub mod shortcut;
pub mod system_tray;
pub mod whisper;

pub use audio::{
    init_audio_capture, is_recording, start_capture, stop_capture, subscribe_rms, AudioCaptureState,
};
pub use clipboard::{
    copy_to_clipboard, get_clipboard_info, init_clipboard_service, is_clipboard_initialized,
    ClipboardServiceState,
};
pub use encoder::{encode_wav_to_ogg, get_encoder_info};
pub use profiles::{
    apply_profile_to_text, get_active_profile, load_profiles, select_profile, ProfileAppState,
};
pub use shortcut::{
    auto_init_shortcut_mgr, check_shortcut_available, get_shortcut_status, init_shortcut_mgr,
    register_all_profile_shortcuts, register_global_shortcut, register_profile_shortcut,
    toggle_record, toggle_record_with_tray, unregister_all_profile_shortcuts,
    unregister_global_shortcut, unregister_profile_shortcut, update_global_shortcut,
    ShortcutMgrState,
};
pub use system_tray::{
    close_settings_window, handle_window_close, hide_main_window, init_system_tray,
    is_settings_window_open, is_window_hidden, open_settings_window, show_main_window,
    show_window_and_start_recording, toggle_main_window, update_tray_global_shortcut,
    update_tray_status, SystemTrayState,
};
pub use whisper::{
    get_whisper_info, init_whisper_client, is_whisper_initialized, transcribe_audio,
    transcribe_recorded_audio, WhisperClientState,
};
