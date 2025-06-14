# HOWTO - DictaClerk Setup Guide

## Building AppImage

### Prerequisites

Before building the AppImage, ensure you have all system dependencies installed. See the [README.md](README.md) for complete installation instructions.

### Quick Setup

1. **Install system dependencies:**

   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
     cmake build-essential pkg-config libogg-dev libvorbis-dev libvorbisenc-dev libasound2-dev

   # Fedora
   sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel \
     cmake gcc-c++ pkgconf-devel libogg-devel libvorbis-devel alsa-lib-devel

   # Arch Linux
   sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg \
     cmake gcc pkgconf libogg libvorbis alsa-lib
   ```

2. **Install Node.js dependencies:**

   ```bash
   pnpm install
   ```

3. **Build the AppImage:**
   ```bash
   pnpm tauri build
   ```

The AppImage will be generated in `src-tauri/target/release/bundle/appimage/` directory.

### Detailed Instructions

For complete build instructions, troubleshooting, and development setup, please refer to the [README.md](README.md) file.

## Getting Started

### OpenAI API Key Setup

DictaClerk requires an OpenAI API key to perform voice transcription using the Whisper API.

#### Obtaining an API Key

1. **Create an OpenAI Account:**

   - Visit [https://platform.openai.com](https://platform.openai.com)
   - Sign up for an account or log in if you already have one

2. **Generate API Key:**

   - Navigate to [API Keys section](https://platform.openai.com/api-keys)
   - Click "Create new secret key"
   - Give it a descriptive name (e.g., "DictaClerk")
   - Copy the generated key (it will only be shown once)

3. **Set Up Billing:**
   - Add a payment method in your [OpenAI account settings](https://platform.openai.com/account/billing)
   - Consider setting usage limits to control costs

#### Required API Permissions

Your OpenAI API key needs access to:

- **Audio API** - Specifically the Whisper transcription endpoint (`/v1/audio/transcriptions`)
- **Text Generation** (if using profile formatting) - GPT-4 or GPT-3.5-turbo models

#### Configuring DictaClerk

1. **Launch DictaClerk**
2. **Open Settings** (click the settings button in the main window)
3. **Enter API Key** in the designated field
4. **Save Settings**

#### Usage Costs

- **Whisper API**: $0.006 per minute of audio
- **GPT-4 API** (for text formatting): Variable based on token usage

#### Security Notes

- Keep your API key secure and never share it publicly
- The API key is stored locally in your system's configuration directory
- Consider using OpenAI's usage monitoring to track consumption

### First Recording

1. **Grant Microphone Permission** when prompted by your system
2. **Select a Profile** or use the default "Transcription" profile
3. **Press the global shortcut** (configurable in Settings) or click the record button
4. **Speak clearly** into your microphone
5. **Stop recording** using the same shortcut or stop button
6. **Text will be automatically copied** to your clipboard

### Troubleshooting

If you encounter issues:

1. **Check API Key**: Ensure it's correctly entered in Settings
2. **Verify Permissions**: Make sure microphone access is granted
3. **Check Network**: Ensure internet connectivity for API calls
4. **Review Logs**: Check the application logs for error messages

For technical issues, refer to the troubleshooting section in [README.md](README.md).
