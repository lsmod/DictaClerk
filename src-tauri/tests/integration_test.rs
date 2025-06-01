use dicta_clerk_lib::audio::{Encoder, OggOpusEncoder};
use hound::{WavSpec, WavWriter};
use tempfile::TempDir;

#[tokio::test]
async fn test_encoder_integration() {
    // Create a temporary directory for test files
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let wav_path = temp_dir.path().join("test.wav");
    let ogg_path = temp_dir.path().join("test.ogg");

    // Create a test WAV file (1 second, 48kHz, mono)
    let spec = WavSpec {
        channels: 1,
        sample_rate: 48000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = WavWriter::create(&wav_path, spec).expect("Failed to create WAV writer");

    // Generate a 1-second sine wave at 440Hz
    for i in 0..48000 {
        let t = i as f64 / 48000.0;
        let sample = (t * 440.0 * 2.0 * std::f64::consts::PI).sin();
        let amplitude = (sample * i16::MAX as f64) as i16;
        writer
            .write_sample(amplitude)
            .expect("Failed to write sample");
    }

    writer.finalize().expect("Failed to finalize WAV file");

    // Test the encoder
    let encoder = OggOpusEncoder::new();
    let result = encoder
        .encode(&wav_path, Some(&ogg_path), None)
        .await
        .expect("Encoding failed");

    // Verify the output
    assert!(ogg_path.exists(), "OGG file was not created");
    assert_eq!(result.path, ogg_path);
    assert!(result.actual_size.unwrap() > 0, "OGG file is empty");

    // Verify the file size is reasonable (should be much smaller than WAV)
    let wav_size = std::fs::metadata(&wav_path).unwrap().len();
    let ogg_size = result.actual_size.unwrap();

    println!("WAV size: {} bytes", wav_size);
    println!("OGG size: {} bytes", ogg_size);
    println!(
        "Compression ratio: {:.2}x",
        wav_size as f64 / ogg_size as f64
    );

    // OGG should be significantly smaller than WAV
    assert!(
        ogg_size < wav_size / 2,
        "OGG file is not significantly smaller than WAV"
    );
}

#[tokio::test]
async fn test_encoder_with_different_durations() {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");

    // Test different durations
    let durations = vec![0.1, 1.0, 5.0]; // 0.1s, 1s, 5s

    for duration in durations {
        let wav_path = temp_dir.path().join(format!("test_{}.wav", duration));
        let ogg_path = temp_dir.path().join(format!("test_{}.ogg", duration));

        // Create test WAV
        let spec = WavSpec {
            channels: 1,
            sample_rate: 48000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = WavWriter::create(&wav_path, spec).expect("Failed to create WAV writer");
        let samples = (duration * 48000.0) as usize;

        for i in 0..samples {
            let t = i as f64 / 48000.0;
            let sample = (t * 440.0 * 2.0 * std::f64::consts::PI).sin();
            let amplitude = (sample * i16::MAX as f64) as i16;
            writer
                .write_sample(amplitude)
                .expect("Failed to write sample");
        }

        writer.finalize().expect("Failed to finalize WAV file");

        // Encode
        let encoder = OggOpusEncoder::new();
        let result = encoder
            .encode(&wav_path, Some(&ogg_path), None)
            .await
            .unwrap_or_else(|_| panic!("Encoding failed for duration {}", duration));

        // Verify
        assert!(
            ogg_path.exists(),
            "OGG file was not created for duration {}",
            duration
        );
        assert!(
            result.actual_size.unwrap() > 0,
            "OGG file is empty for duration {}",
            duration
        );

        println!(
            "Duration: {}s, OGG size: {} bytes",
            duration,
            result.actual_size.unwrap()
        );
    }
}
