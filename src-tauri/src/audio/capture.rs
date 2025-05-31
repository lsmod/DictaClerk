use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, StreamConfig, SupportedStreamConfig};
use hound::{WavSpec, WavWriter};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tempfile::NamedTempFile;
use tokio::sync::{Mutex, mpsc};

/// Error types for audio capture operations
#[derive(Debug, thiserror::Error)]
pub enum AudioCaptureError {
    #[error("Audio device unavailable: {0}")]
    AudioDeviceUnavailable(String),
    #[error("Stream configuration error: {0}")]
    StreamConfig(String),
    #[error("Stream creation failed: {0}")]
    StreamCreation(String),
    #[error("File I/O error: {0}")]
    FileIo(#[from] std::io::Error),
    #[error("WAV encoding error: {0}")]
    WavEncoding(#[from] hound::Error),
    #[error("Temporary file error: {0}")]
    TempFile(#[from] tempfile::PersistError),
}

/// Result type for audio capture operations
pub type AudioCaptureResult<T> = Result<T, AudioCaptureError>;

/// Trait defining audio capture operations
#[async_trait::async_trait]
pub trait AudioCapture: Send + Sync {
    /// Start capturing audio to a temporary WAV file
    async fn start_capture(&self) -> AudioCaptureResult<PathBuf>;
    
    /// Stop audio capture and return the path to the recorded file
    async fn stop_capture(&self) -> AudioCaptureResult<PathBuf>;
    
    /// Subscribe to RMS level updates (callback will be called at ≥10 Hz)
    #[allow(dead_code)]
    fn subscribe_rms(&self, callback: Box<dyn Fn(f32) + Send + Sync>);
    
    /// Check if currently recording
    fn is_recording(&self) -> bool;
}

/// Audio capture state that can be safely shared across threads
pub struct AudioCaptureState {
    pub is_recording: Arc<AtomicBool>,
    pub current_file_path: Arc<Mutex<Option<PathBuf>>>,
    pub rms_callback: Arc<Mutex<Option<Box<dyn Fn(f32) + Send + Sync>>>>,
    pub stop_sender: Arc<Mutex<Option<mpsc::UnboundedSender<()>>>>,
}

impl AudioCaptureState {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            current_file_path: Arc::new(Mutex::new(None)),
            rms_callback: Arc::new(Mutex::new(None)),
            stop_sender: Arc::new(Mutex::new(None)),
        }
    }
}

/// Live audio capture implementation using CPAL
pub struct LiveAudioCapture {
    device: Device,
    config: SupportedStreamConfig,
    app_handle: AppHandle,
    state: Arc<AudioCaptureState>,
}

impl LiveAudioCapture {
    /// Create a new LiveAudioCapture instance
    pub fn new(app_handle: AppHandle) -> AudioCaptureResult<Self> {
        let host = cpal::default_host();
        
        let device = host
            .default_input_device()
            .ok_or_else(|| AudioCaptureError::AudioDeviceUnavailable(
                "No default input device available".to_string()
            ))?;
        
        let config = device
            .default_input_config()
            .map_err(|e| AudioCaptureError::StreamConfig(format!("Failed to get default config: {}", e)))?;
        
        // Ensure we're using 16-bit 48kHz mono as specified
        let desired_sample_rate = 48000;
        let desired_channels = 1;
        
        // Check if the device supports our desired configuration
        let mut supported_config = config;
        if supported_config.sample_rate().0 != desired_sample_rate || 
           supported_config.channels() != desired_channels {
            
            // Try to find a supported configuration close to our requirements
            let supported_configs = device
                .supported_input_configs()
                .map_err(|e| AudioCaptureError::StreamConfig(format!("Failed to get supported configs: {}", e)))?;
            
            let mut best_config = None;
            for config in supported_configs {
                if config.channels() == desired_channels && 
                   config.min_sample_rate().0 <= desired_sample_rate &&
                   config.max_sample_rate().0 >= desired_sample_rate {
                    best_config = Some(config.with_sample_rate(cpal::SampleRate(desired_sample_rate)));
                    break;
                }
            }
            
            if let Some(config) = best_config {
                supported_config = config;
            }
        }
        
        Ok(Self {
            device,
            config: supported_config,
            app_handle,
            state: Arc::new(AudioCaptureState::new()),
        })
    }
    
    /// Calculate RMS (Root Mean Square) of audio samples
    fn calculate_rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        
        let sum_of_squares: f32 = samples.iter().map(|&sample| sample * sample).sum();
        (sum_of_squares / samples.len() as f32).sqrt()
    }
    
    /// Convert audio samples to the format expected by WAV writer
    fn samples_to_i16(samples: &[f32]) -> Vec<i16> {
        samples
            .iter()
            .map(|&sample| {
                // Clamp to [-1.0, 1.0] and convert to i16
                let clamped = sample.max(-1.0).min(1.0);
                (clamped * i16::MAX as f32) as i16
            })
            .collect()
    }
}

#[async_trait::async_trait]
impl AudioCapture for LiveAudioCapture {
    async fn start_capture(&self) -> AudioCaptureResult<PathBuf> {
        if self.state.is_recording.load(Ordering::Relaxed) {
            return Err(AudioCaptureError::StreamCreation(
                "Already recording".to_string()
            ));
        }
        
        // Create temporary file
        let temp_file = NamedTempFile::new()?;
        let temp_path = temp_file.path().to_path_buf();
        
        // Create WAV writer
        let wav_spec = WavSpec {
            channels: 1,
            sample_rate: 48000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        
        let writer = WavWriter::create(&temp_path, wav_spec)?;
        let writer = Arc::new(Mutex::new(Some(writer)));
        
        // Store the current file path
        *self.state.current_file_path.lock().await = Some(temp_path.clone());
        
        // Create stream configuration
        let config = StreamConfig {
            channels: self.config.channels(),
            sample_rate: self.config.sample_rate(),
            buffer_size: cpal::BufferSize::Default,
        };
        
        // Create a channel to signal when to stop recording
        let (stop_tx, mut stop_rx) = mpsc::unbounded_channel();
        *self.state.stop_sender.lock().await = Some(stop_tx);
        
        // Clone necessary data for the stream callback
        let writer_clone = Arc::clone(&writer);
        let app_handle = self.app_handle.clone();
        let rms_callback = Arc::clone(&self.state.rms_callback);
        let is_recording = Arc::clone(&self.state.is_recording);
        let is_recording_for_task = Arc::clone(&self.state.is_recording);
        
        // Set recording state
        self.state.is_recording.store(true, Ordering::Relaxed);
        
        // Spawn a task to handle the audio stream
        // This runs in a separate thread to avoid Send/Sync issues
        let device = self.device.clone();
        tokio::task::spawn_blocking(move || {
            // Create the input stream
            let stream = device.build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if !is_recording.load(Ordering::Relaxed) {
                        return;
                    }
                    
                    // Calculate RMS for VU meter
                    let rms = Self::calculate_rms(data);
                    
                    // Emit RMS event to frontend
                    if let Err(e) = app_handle.emit("rms", rms) {
                        eprintln!("Failed to emit RMS event: {}", e);
                    }
                    
                    // Call RMS callback if set
                    if let Ok(callback_guard) = rms_callback.try_lock() {
                        if let Some(ref callback) = *callback_guard {
                            callback(rms);
                        }
                    }
                    
                    // Write audio data to file
                    if let Ok(mut writer_guard) = writer_clone.try_lock() {
                        if let Some(ref mut writer) = *writer_guard {
                            let samples_i16 = Self::samples_to_i16(data);
                            for sample in samples_i16 {
                                if let Err(e) = writer.write_sample(sample) {
                                    eprintln!("Failed to write audio sample: {}", e);
                                    break;
                                }
                            }
                        }
                    }
                },
                |err| {
                    eprintln!("Audio stream error: {}", err);
                },
                None,
            );
            
            match stream {
                Ok(stream) => {
                    // Start the stream
                    if let Err(e) = stream.play() {
                        eprintln!("Failed to start stream: {}", e);
                        return;
                    }
                    
                    // Keep the stream alive until we receive a stop signal
                    let rt = tokio::runtime::Runtime::new().unwrap();
                    rt.block_on(async {
                        stop_rx.recv().await;
                    });
                    
                    // Stream will be dropped here, stopping the recording
                    drop(stream);
                }
                Err(e) => {
                    eprintln!("Failed to create stream: {}", e);
                }
            }
        });
        
        // Keep the temp file alive by moving it to a separate task
        tokio::spawn(async move {
            // Keep the temp file alive while recording
            while is_recording_for_task.load(Ordering::Relaxed) {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
            
            // Finalize the writer
            if let Ok(mut writer_guard) = writer.try_lock() {
                if let Some(writer) = writer_guard.take() {
                    if let Err(e) = writer.finalize() {
                        eprintln!("Failed to finalize WAV file: {}", e);
                    }
                }
            }
            
            // Convert temp file to permanent file
            let (file, _path) = temp_file.keep().unwrap();
            drop(file); // Close the file handle
        });
        
        Ok(temp_path)
    }
    
    async fn stop_capture(&self) -> AudioCaptureResult<PathBuf> {
        if !self.state.is_recording.load(Ordering::Relaxed) {
            return Err(AudioCaptureError::StreamCreation(
                "Not currently recording".to_string()
            ));
        }
        
        // Stop recording
        self.state.is_recording.store(false, Ordering::Relaxed);
        
        // Send stop signal to the stream task
        if let Some(stop_sender) = self.state.stop_sender.lock().await.take() {
            let _ = stop_sender.send(());
        }
        
        // Wait a bit for the stream to finish processing
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        
        // Get the file path
        let path = self.state.current_file_path.lock().await
            .take()
            .ok_or_else(|| AudioCaptureError::StreamCreation(
                "No recording file available".to_string()
            ))?;
        
        Ok(path)
    }
    
    fn subscribe_rms(&self, callback: Box<dyn Fn(f32) + Send + Sync>) {
        if let Ok(mut rms_callback) = self.state.rms_callback.try_lock() {
            *rms_callback = Some(callback);
        }
    }
    
    fn is_recording(&self) -> bool {
        self.state.is_recording.load(Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rms_calculation() {
        // Test with known values: [0.5, -0.5, 0.3, -0.3]
        // RMS = sqrt((0.5² + (-0.5)² + 0.3² + (-0.3)²) / 4)
        // RMS = sqrt((0.25 + 0.25 + 0.09 + 0.09) / 4)
        // RMS = sqrt(0.68 / 4) = sqrt(0.17) ≈ 0.4123
        let samples = vec![0.5, -0.5, 0.3, -0.3];
        let rms = LiveAudioCapture::calculate_rms(&samples);
        assert!((rms - 0.4123).abs() < 0.001); // More precise expectation
        
        // Test with empty samples
        let empty_samples = vec![];
        let rms_empty = LiveAudioCapture::calculate_rms(&empty_samples);
        assert_eq!(rms_empty, 0.0);
        
        // Test with single sample
        let single_sample = vec![0.5];
        let rms_single = LiveAudioCapture::calculate_rms(&single_sample);
        assert!((rms_single - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_samples_to_i16_conversion() {
        let samples = vec![0.0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5];
        let converted = LiveAudioCapture::samples_to_i16(&samples);
        
        assert_eq!(converted[0], 0); // 0.0 -> 0
        assert_eq!(converted[1], (0.5 * i16::MAX as f32) as i16); // 0.5 -> ~16383
        assert_eq!(converted[2], (-0.5 * i16::MAX as f32) as i16); // -0.5 -> ~-16383
        assert_eq!(converted[3], i16::MAX); // 1.0 -> 32767 (max)
        assert_eq!(converted[4], -i16::MAX); // -1.0 -> -32767 (clamped, not min)
        assert_eq!(converted[5], i16::MAX); // 1.5 clamped to 1.0 -> 32767
        assert_eq!(converted[6], -i16::MAX); // -1.5 clamped to -1.0 -> -32767
    }
} 