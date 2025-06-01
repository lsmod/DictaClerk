# Disk Space Optimization for DictaClerk

This document explains how to avoid disk space accumulation during development.

## 🚀 Automatic solutions in place

### 1. Optimized Cargo configuration

- **Shared target directory**: Builds use `/tmp/rust-builds/dicta-clerk` instead of `src-tauri/target`
- **Compilation optimizations**: Reduced debug information and dependency optimization
- **Configuration**: See `src-tauri/.cargo/config.toml`

### 2. Automatic cleanup script

- **Script**: `./scripts/cleanup-builds.sh`
- **Usage**: `./scripts/cleanup-builds.sh [days]` (default: 7 days)
- **Features**:
  - Cleans old builds with `cargo-sweep`
  - Cleans cargo cache
  - Shows disk space usage

### 3. Automatic Git hooks

- **Pre-push hook**: Automatically cleans old builds (>3 days) before each push
- **Configuration**: See `.pre-commit-config.yaml`

## 🛠️ Useful commands

### Manual cleanup

```bash
# Complete cleanup (removes everything)
cd src-tauri && cargo clean

# Clean old builds (7 days default)
./scripts/cleanup-builds.sh

# Clean old builds (custom)
./scripts/cleanup-builds.sh 14  # 14 days
```

### Disk space monitoring

```bash
# Check local target folder size (if it exists)
du -sh src-tauri/target

# Check shared target folder size
du -sh /tmp/rust-builds/dicta-clerk

# Check total disk space used by Rust
du -sh ~/.cargo
```

### Additional tools installation

```bash
# cargo-sweep: cleans old builds
cargo install cargo-sweep

# cargo-cache: manages cargo cache
cargo install cargo-cache

# sccache: shared compilation cache (optional)
cargo install sccache
```

## ⚙️ Recommended configuration

### Automation with crontab

To automatically clean weekly:

```bash
# Edit crontab
crontab -e

# Add this line (cleanup every Sunday at 2 AM)
0 2 * * 0 /path/to/DictaClerk/scripts/cleanup-builds.sh 14
```

### Useful environment variables

```bash
# Use sccache to speed up builds
export RUSTC_WRAPPER=sccache

# Limit RAM usage during compilation
export CARGO_BUILD_JOBS=4
```

## 📊 Monitoring

### Typical disk space

- **Empty project**: ~0 MB
- **After first debug build**: ~2-3 GB
- **After multiple builds**: ~5-8 GB (without cleanup)
- **With automatic cleanup**: ~2-4 GB maximum

### Alerts

If disk space exceeds 5 GB, check:

1. That the cleanup script is working
2. That cargo configuration is active
3. Run manual cleanup with `cargo clean`

## 🔧 Troubleshooting

### Target folder becomes very large

```bash
# Check cargo configuration
cat src-tauri/.cargo/config.toml

# Force using temporary folder
cd src-tauri
export CARGO_TARGET_DIR=/tmp/rust-builds/dicta-clerk
cargo build
```

### cargo-sweep doesn't work

```bash
# Reinstall cargo-sweep
cargo install --force cargo-sweep

# Check installation
cargo sweep --help
```

### Cleanup script fails

```bash
# Check permissions
ls -la scripts/cleanup-builds.sh

# Make executable if needed
chmod +x scripts/cleanup-builds.sh

# Test manually
./scripts/cleanup-builds.sh
```

## 💡 Additional tips

1. **Development**: Use `cargo check` instead of `cargo build` for quick checks
2. **Tests**: Use `cargo test` with `--release` for performance tests
3. **Production**: Always use `cargo build --release` for final builds
4. **IDE**: Configure your IDE to use the shared target folder

## 🔗 Resources

- [Cargo Book - Configuration](https://doc.rust-lang.org/cargo/reference/config.html)
- [cargo-sweep Documentation](https://github.com/holmgr/cargo-sweep)
- [cargo-cache Documentation](https://github.com/matthiaskrgr/cargo-cache)
