pub mod audio;
pub mod encoder;
pub mod shortcut;
pub mod whisper;

pub use audio::{
    init_audio_capture, is_recording, start_capture, stop_capture, subscribe_rms, AudioCaptureState,
};
pub use encoder::{encode_wav_to_ogg, get_encoder_info};
pub use shortcut::{
    auto_init_shortcut_mgr, get_shortcut_status, init_shortcut_mgr, register_global_shortcut,
    toggle_record, unregister_global_shortcut, update_global_shortcut, ShortcutMgrState,
};
pub use whisper::{
    get_whisper_info, init_whisper_client, is_whisper_initialized, transcribe_audio,
    transcribe_recorded_audio, WhisperClientState,
};
