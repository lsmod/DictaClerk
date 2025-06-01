# DictaClerk

Voice transcription tool built with Tauri, React, and TypeScript.

## Tech Stack

- **Frontend**: React 19.1, TypeScript 5.8.3, Vite 6.3.5
- **Backend**: Tauri 2.2.0, Rust 1.77.2
- **Audio**: OGG/Opus encoding with native libraries
- **Linting**: ESLint 9.17.0, Prettier 3.4.2

## Prerequisites

### System Dependencies

Install system dependencies for Tauri and audio encoding:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
  cmake build-essential pkg-config libogg-dev libopus-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel \
  cmake gcc-c++ pkgconf-devel libogg-devel opus-devel

# Arch Linux
sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg \
  cmake gcc pkgconf libogg opus
```

### CMake Requirements

The audio encoder requires CMake for building native dependencies:

- **CMake 3.16+** (included in the installation commands above)
- **libogg-dev/libogg-devel**: OGG container format library
- **libopus-dev/opus-devel**: Opus audio codec library

These libraries are automatically linked during the Rust build process via the `build.rs` script.

## Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start development server:

   ```bash
   pnpm tauri dev
   ```

3. Run linting:
   ```bash
   pnpm lint
   pnpm lint:fix
   ```

## Build

```bash
pnpm tauri build
```

## Testing

Run Rust tests including audio encoder tests:

```bash
cd src-tauri
cargo test
cargo test --test integration_test
```

## Features

### Audio Encoding

- WAV to OGG/Opus conversion
- 32 kbps target bitrate optimized for voice
- Real-time size forecasting (≤2% accuracy)
- Progress reporting and size limit warnings
- Async/await support

See `src-tauri/ENCODER_README.md` for detailed audio encoder documentation.

## Troubleshooting

```bash
pnpm tauri dev --verbose
pnpm tauri --info # ensure we have all correctly setup
```

### Common Issues

- **CMake not found**: Install CMake using the system package manager
- **Audio library linking errors**: Ensure libogg-dev and libopus-dev are installed
- **Build failures**: Check that all system dependencies are properly installed

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
