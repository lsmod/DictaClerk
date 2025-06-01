# CMake Integration for Audio Encoder

This document explains the CMake and native library integration added for the OGG/Opus audio encoder in DictaClerk.

## Overview

The audio encoder requires native system libraries for OGG container format and Opus audio codec. These are linked during the Rust build process using CMake.

## Required System Dependencies

### Ubuntu/Debian

```bash
sudo apt install cmake build-essential pkg-config libogg-dev libopus-dev libasound2-dev
```

### Fedora

```bash
sudo dnf install cmake gcc-c++ pkgconf-devel libogg-devel opus-devel alsa-lib-devel
```

### Arch Linux

```bash
sudo pacman -S cmake gcc pkgconf libogg opus alsa-lib
```

## Build Configuration

### build.rs

The `src-tauri/build.rs` file automatically:

- Links system ogg and opus libraries
- Configures build dependencies
- Handles native library detection

### Cargo.toml

Dependencies added:

- `opus = "0.3"` - Rust bindings for Opus codec
- `ogg = "0.9"` - Rust bindings for OGG container
- `cpal = "0.15.3"` - Cross-platform audio I/O (requires ALSA on Linux)

## CI/CD Updates

Updated `.github/workflows/ci.yml` to include:

- CMake installation
- libogg-dev and libopus-dev packages
- libasound2-dev package (ALSA development libraries)
- Integration test execution

## Installation Instructions

Updated `README.md` with:

- Complete system dependency installation
- CMake requirements explanation
- ALSA dependency for audio capture
- Troubleshooting for common issues

## Features Enabled

With CMake integration, the following features are available:

- WAV to OGG/Opus conversion
- 32 kbps voice-optimized encoding
- Real-time size forecasting
- Progress reporting
- Async encoding with event streams
- Audio capture capabilities (via ALSA)

## Verification

To verify the integration works:

```bash
cd src-tauri
cargo check  # Verify compilation
cargo test   # Run all tests including encoder tests
cargo test --test integration_test  # Run integration tests
```

## Troubleshooting

Common issues and solutions:

1. **CMake not found**

   - Install CMake using system package manager
   - Ensure CMake is in PATH

2. **Library linking errors**

   - Verify libogg-dev and libopus-dev are installed
   - Check pkg-config can find libraries: `pkg-config --libs ogg opus`

3. **ALSA errors (alsa-sys build failures)**

   - Install libasound2-dev (Ubuntu/Debian) or alsa-lib-devel (Fedora/CentOS)
   - Check pkg-config can find ALSA: `pkg-config --libs alsa`

4. **Build failures in CI**
   - Ensure CI workflow includes all system dependencies
   - Check that package names are correct for Ubuntu (CI environment)

## Implementation Notes

- Libraries are automatically detected by pkg-config
- No manual library path configuration needed
- Compatible with cross-compilation
- Minimal overhead during build process
- ALSA is required for audio capture functionality on Linux systems
