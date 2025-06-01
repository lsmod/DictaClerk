# DictaClerk Optimization Scripts

This folder contains scripts to optimize the development experience and disk space management.

## 🧹 Automatic Cleanup

### `cleanup-builds.sh`

Main Rust build cleanup script.

**Usage:**

```bash
./scripts/cleanup-builds.sh [days]
```

**Examples:**

```bash
./scripts/cleanup-builds.sh     # Clean builds > 7 days (default)
./scripts/cleanup-builds.sh 3   # Clean builds > 3 days
./scripts/cleanup-builds.sh 30  # Clean builds > 30 days
```

**Features:**

- Uses `cargo-sweep` to clean old builds
- Uses `cargo-cache` to optimize cargo cache
- Shows disk space usage
- Automatically installs missing tools

## ⚡ Development Aliases

### Alias Configuration

1. **Copy the example script:**

   ```bash
   cp scripts/setup-aliases.example.sh scripts/setup-aliases.sh
   ```

2. **Customize if needed** (optional)

3. **Run the script:**
   ```bash
   ./scripts/setup-aliases.sh
   ```

### Available Aliases

#### 🧹 Cleanup

- `dcclean` - Standard cleanup (7 days)
- `dcclean-full` - Complete cleanup (removes everything)
- `dcclean-week` - Clean builds > 7 days
- `dcclean-month` - Clean builds > 30 days

#### 📊 Monitoring

- `dcsize` - Show disk space usage

#### 🔨 Build & Tests

- `dcbuild` - Fast build (`cargo check`)
- `dcbuild-release` - Optimized build (`cargo build --release`)
- `dctest` - Run tests
- `dcdev` - Development mode (`npm run tauri dev`)

#### 🎨 Code Quality

- `dcfmt` - Format code (`cargo fmt`)
- `dclint` - Lint (`cargo clippy`)

#### 📝 Git

- `dcstatus` - Project git status
- `dclog` - Last commits (10)

#### ℹ️ Help

- `dcinfo` - Show all commands and configuration

## 🔧 Setup for New Developers

1. **Clone the repo and go to the folder**
2. **Install required Rust tools:**
   ```bash
   cargo install cargo-sweep cargo-cache
   ```
3. **Configure aliases:**
   ```bash
   cp scripts/setup-aliases.example.sh scripts/setup-aliases.sh
   ./scripts/setup-aliases.sh
   ```
4. **Reload terminal:**
   ```bash
   source ~/.bashrc
   ```
5. **Test:**
   ```bash
   dcinfo
   ```

## 📁 File Structure

```
scripts/
├── README.md                    # This file
├── cleanup-builds.sh           # Main cleanup script
└── setup-aliases.example.sh    # Alias template (to copy)

# Generated files (ignored by git):
├── setup-aliases.sh           # Your personal version
└── ~/.dicta_clerk_aliases     # Generated alias file
```

## 🚀 Automation

### Automatic cleanup with cron

To automatically clean weekly:

```bash
crontab -e
# Add:
0 2 * * 0 /path/to/DictaClerk/scripts/cleanup-builds.sh 14
```

### Git Hooks

Pre-commit hooks are configured to automatically clean before each push.

## 🔍 Troubleshooting

### Aliases don't work

```bash
# Check if file exists
ls -la ~/.dicta_clerk_aliases

# Check if it's sourced in .bashrc
grep dicta_clerk_aliases ~/.bashrc

# Reload manually
source ~/.dicta_clerk_aliases
```

### cargo-sweep or cargo-cache missing

```bash
# Install manually
cargo install cargo-sweep cargo-cache

# Or let the script install them automatically
./scripts/cleanup-builds.sh
```

### Missing permissions

```bash
# Make scripts executable
chmod +x scripts/*.sh
```

## 📚 See Also

- [Complete Documentation](../docs/DISK_SPACE_OPTIMIZATION.md)
- [Cargo Configuration](../src-tauri/.cargo/config.toml)
- [Pre-commit hooks](../.pre-commit-config.yaml)
