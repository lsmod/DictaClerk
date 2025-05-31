# DictaClerk

Voice transcription tool built with Tauri, React, and TypeScript.

## Tech Stack

- **Frontend**: React 19.1, TypeScript 5.8.3, Vite 6.3.5
- **Backend**: Tauri 2.2.0, Rust 1.77.2
- **Linting**: ESLint 9.17.0, Prettier 3.4.2

## Prerequisites

Install system dependencies for Tauri:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel

# Arch Linux
sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg
```

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

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
