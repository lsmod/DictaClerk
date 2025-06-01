use async_trait::async_trait;
use hound::WavReader;
use ogg::{writing::PacketWriter, writing::PacketWriteEndInfo};
use opus::{Application, Channels, Encoder as OpusEncoder};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use thiserror::Error;
use tokio::sync::mpsc;

/// Information about the encoded OGG file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OggInfo {
    /// Estimated final file size in bytes
    pub size_estimate: u64,
    /// Path to the encoded OGG file
    pub path: PathBuf,
    /// Actual file size (if encoding is complete)
    pub actual_size: Option<u64>,
}

/// Events emitted during encoding process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EncodingEvent {
    /// Progress update with bytes processed and estimated total
    Progress { bytes_processed: u64, estimated_total: u64 },
    /// Warning that size is approaching limit (~23MB)
    SizeAlmostLimit { estimated_size: u64 },
    /// Encoding completed
    Completed { final_info: OggInfo },
    /// Encoding failed
    Error { message: String },
}

/// Errors that can occur during encoding
#[derive(Error, Debug)]
pub enum EncodingError {
    #[error("Failed to read WAV file: {0}")]
    WavReadError(#[from] hound::Error),
    
    #[error("Failed to create Opus encoder: {0}")]
    OpusError(#[from] opus::Error),
    
    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Invalid audio format: {0}")]
    InvalidFormat(String),
    
    #[error("File size exceeds limit: {estimated} bytes")]
    FileSizeExceedsLimit { estimated: u64 },
}

/// The Encoder trait for converting WAV to OGG/Opus
#[async_trait]
pub trait Encoder: Send + Sync {
    /// Encode a WAV file to OGG/Opus format
    /// 
    /// # Arguments
    /// * `wav_path` - Path to the input WAV file
    /// * `output_path` - Optional output path (if None, will use input path with .ogg extension)
    /// * `event_sender` - Optional channel to send progress events
    /// 
    /// # Returns
    /// * `OggInfo` containing size estimate and output path
    async fn encode(
        &self,
        wav_path: &Path,
        output_path: Option<&Path>,
        event_sender: Option<mpsc::UnboundedSender<EncodingEvent>>,
    ) -> Result<OggInfo, EncodingError>;
}

/// Default implementation of the Encoder trait
pub struct OggOpusEncoder {
    /// Target bitrate in bits per second (default: 32000)
    bitrate: i32,
    /// Size limit in bytes before warning (~23MB)
    size_limit: u64,
}

impl Default for OggOpusEncoder {
    fn default() -> Self {
        Self::new()
    }
}

impl OggOpusEncoder {
    /// Create a new OggOpusEncoder with default settings
    pub fn new() -> Self {
        Self {
            bitrate: 32000, // 32 kbps as specified in requirements
            size_limit: 23 * 1024 * 1024, // ~23MB limit as mentioned in requirements
        }
    }
    
    /// Create a new OggOpusEncoder with custom settings
    pub fn with_bitrate(bitrate: i32) -> Self {
        Self {
            bitrate,
            size_limit: 23 * 1024 * 1024,
        }
    }
    
    /// Set the size limit for warnings
    pub fn with_size_limit(mut self, size_limit: u64) -> Self {
        self.size_limit = size_limit;
        self
    }
    
    /// Estimate final file size based on duration and bitrate
    fn estimate_file_size(&self, duration_seconds: f64) -> u64 {
        // Basic estimation: (bitrate * duration) / 8 + overhead
        let bits_total = (self.bitrate as f64 * duration_seconds) as u64;
        let bytes_audio = bits_total / 8;
        
        // Add approximately 5% overhead for OGG container and metadata
        let overhead = bytes_audio / 20;
        bytes_audio + overhead
    }
    
    /// Calculate running average of frame sizes for more accurate forecasting
    fn update_size_forecast(&self, frames_encoded: usize, bytes_written: u64, total_frames: usize) -> u64 {
        if frames_encoded == 0 {
            return 0;
        }
        
        let avg_frame_size = bytes_written as f64 / frames_encoded as f64;
        let estimated_total = avg_frame_size * total_frames as f64;
        
        // Add 2% buffer for accuracy as per requirements
        (estimated_total * 1.02) as u64
    }
}

#[async_trait]
impl Encoder for OggOpusEncoder {
    async fn encode(
        &self,
        wav_path: &Path,
        output_path: Option<&Path>,
        event_sender: Option<mpsc::UnboundedSender<EncodingEvent>>,
    ) -> Result<OggInfo, EncodingError> {
        // Determine output path
        let output_path = match output_path {
            Some(path) => path.to_path_buf(),
            None => wav_path.with_extension("ogg"),
        };
        
        // Read WAV file header to get format information
        let mut wav_reader = WavReader::open(wav_path)?;
        let wav_spec = wav_reader.spec();
        
        // Validate format requirements
        if wav_spec.channels != 1 {
            return Err(EncodingError::InvalidFormat(
                format!("Expected mono audio, got {} channels", wav_spec.channels)
            ));
        }
        
        // Calculate duration and initial size estimate
        let total_samples = wav_reader.len();
        let duration_seconds = total_samples as f64 / wav_spec.sample_rate as f64;
        let _initial_estimate = self.estimate_file_size(duration_seconds);
        
        // Create Opus encoder with VoIP application and 32kbps bitrate
        let mut opus_encoder = OpusEncoder::new(
            wav_spec.sample_rate,
            Channels::Mono,
            Application::Voip,
        )?;
        
        opus_encoder.set_bitrate(opus::Bitrate::Bits(self.bitrate))?;
        
        // Create OGG output file
        let output_file = File::create(&output_path)?;
        let output_writer = BufWriter::new(output_file);
        
        // Initialize OGG stream
        let mut packet_writer = PacketWriter::new(output_writer);
        let stream_serial = 1; // Simple serial number for the stream
        
        // Opus frame size (20ms at the sample rate)
        let frame_size = (wav_spec.sample_rate as usize * 20) / 1000; // 20ms frames
        let mut input_buffer = vec![0f32; frame_size];
        let mut output_buffer = vec![0u8; 4000]; // Opus max packet size
        
        // Read all samples into memory for processing
        let samples: Result<Vec<f32>, _> = wav_reader.samples::<i16>()
            .map(|s| s.map(|sample| sample as f32 / i16::MAX as f32))
            .collect();
        let samples = samples?;
        
        let total_frames = (samples.len() + frame_size - 1) / frame_size;
        let mut frames_encoded = 0;
        let mut bytes_written = 0u64;
        let mut size_warning_sent = false;
        
        // Process audio in frames
        for (chunk_idx, chunk) in samples.chunks(frame_size).enumerate() {
            // Pad the last frame if necessary
            input_buffer.fill(0.0);
            for (i, &sample) in chunk.iter().enumerate() {
                if i < frame_size {
                    input_buffer[i] = sample;
                }
            }
            
            // Encode frame with Opus
            let encoded_size = opus_encoder.encode_float(
                &input_buffer,
                &mut output_buffer,
            )?;
            
            if encoded_size > 0 {
                // Determine packet end info
                let is_last_packet = chunk_idx + 1 >= total_frames;
                let packet_end_info = if is_last_packet {
                    PacketWriteEndInfo::EndStream
                } else {
                    PacketWriteEndInfo::NormalPacket
                };
                
                // Calculate granule position (sample position)
                let granule_pos = (frames_encoded as u64 + 1) * frame_size as u64;
                
                // Write packet to OGG stream
                packet_writer.write_packet(
                    output_buffer[..encoded_size].to_vec(),
                    stream_serial,
                    packet_end_info,
                    granule_pos,
                )?;
                
                bytes_written += encoded_size as u64;
                frames_encoded += 1;
                
                // Update size forecast using running average
                let current_forecast = self.update_size_forecast(frames_encoded, bytes_written, total_frames);
                
                // Send progress event
                if let Some(ref sender) = event_sender {
                    let _ = sender.send(EncodingEvent::Progress {
                        bytes_processed: bytes_written,
                        estimated_total: current_forecast,
                    });
                    
                    // Send size warning if approaching limit
                    if !size_warning_sent && current_forecast > self.size_limit {
                        size_warning_sent = true;
                        let _ = sender.send(EncodingEvent::SizeAlmostLimit {
                            estimated_size: current_forecast,
                        });
                    }
                }
            }
        }
        
        // Finalize the OGG stream
        let mut output_writer = packet_writer.into_inner();
        output_writer.flush()?;
        
        // Get actual file size
        let actual_size = std::fs::metadata(&output_path)?.len();
        let final_forecast = self.update_size_forecast(frames_encoded, bytes_written, total_frames);
        
        // Check forecast accuracy (should be ≤2% error)
        let forecast_error = if actual_size > 0 {
            ((final_forecast as f64 - actual_size as f64).abs() / actual_size as f64) * 100.0
        } else {
            0.0
        };
        
        println!("Encoding completed. Forecast error: {:.2}%", forecast_error);
        
        let ogg_info = OggInfo {
            size_estimate: final_forecast,
            path: output_path,
            actual_size: Some(actual_size),
        };
        
        // Send completion event
        if let Some(ref sender) = event_sender {
            let _ = sender.send(EncodingEvent::Completed {
                final_info: ogg_info.clone(),
            });
        }
        
        Ok(ogg_info)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tokio::sync::mpsc;
    use hound::WavSpec;
    
    /// Create a test WAV file with specified duration
    fn create_test_wav(path: &Path, duration_seconds: f64, sample_rate: u32) -> Result<(), Box<dyn std::error::Error>> {
        let spec = WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        
        let mut writer = hound::WavWriter::create(path, spec)?;
        let samples_count = (duration_seconds * sample_rate as f64) as usize;
        
        // Generate a simple sine wave
        for i in 0..samples_count {
            let t = i as f64 / sample_rate as f64;
            let sample = (t * 440.0 * 2.0 * std::f64::consts::PI).sin();
            let amplitude = (sample * i16::MAX as f64) as i16;
            writer.write_sample(amplitude)?;
        }
        
        writer.finalize()?;
        Ok(())
    }
    
    #[tokio::test]
    async fn test_encode_short_wav() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let wav_path = temp_dir.path().join("test_short.wav");
        let ogg_path = temp_dir.path().join("test_short.ogg");
        
        // Create a short (0.5 second) test WAV
        create_test_wav(&wav_path, 0.5, 48000)?;
        
        let encoder = OggOpusEncoder::new();
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        let result = encoder.encode(&wav_path, Some(&ogg_path), Some(tx)).await?;
        
        // Verify the file was created
        assert!(ogg_path.exists());
        assert_eq!(result.path, ogg_path);
        assert!(result.actual_size.unwrap() > 0);
        
        // Check that we received some events
        let mut events = Vec::new();
        while let Ok(event) = rx.try_recv() {
            events.push(event);
        }
        assert!(!events.is_empty());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_encode_long_wav() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let wav_path = temp_dir.path().join("test_long.wav");
        
        // Create a longer (30 second) test WAV
        create_test_wav(&wav_path, 30.0, 48000)?;
        
        let encoder = OggOpusEncoder::new();
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        let result = encoder.encode(&wav_path, None, Some(tx)).await?;
        
        // Verify the file was created with .ogg extension
        assert!(result.path.exists());
        assert_eq!(result.path.extension().unwrap(), "ogg");
        
        // Check that we received progress events
        let mut progress_count = 0;
        while let Ok(event) = rx.try_recv() {
            match event {
                EncodingEvent::Progress { .. } => progress_count += 1,
                _ => {}
            }
        }
        assert!(progress_count > 0);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_size_forecast_accuracy() -> Result<(), Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let wav_path = temp_dir.path().join("test_accuracy.wav");
        
        // Create a 5-second test WAV
        create_test_wav(&wav_path, 5.0, 48000)?;
        
        let encoder = OggOpusEncoder::new();
        let result = encoder.encode(&wav_path, None, None).await?;
        
        let actual_size = result.actual_size.unwrap() as f64;
        let estimated_size = result.size_estimate as f64;
        
        // Calculate forecast error
        let error_percentage = ((estimated_size - actual_size).abs() / actual_size) * 100.0;
        
        // Error should be ≤2% as per requirements
        assert!(error_percentage <= 2.0, 
                "Forecast error {}% exceeds 2% requirement", error_percentage);
        
        Ok(())
    }
} 