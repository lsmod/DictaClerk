#!/bin/bash

# Automatic Rust build cleanup script for DictaClerk
# Usage: ./scripts/cleanup-builds.sh [days]

set -euo pipefail

DAYS=${1:-7}  # Default: clean files older than 7 days
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🧹 Cleaning Rust builds..."

# Go to Tauri project folder
cd "$PROJECT_ROOT/src-tauri"

# Clean with cargo-sweep (old files)
if command -v cargo-sweep &> /dev/null; then
    echo "📦 Cleaning old builds (>${DAYS} days)..."
    cargo sweep --time $DAYS --recursive
else
    echo "⚠️  cargo-sweep is not installed. Installing..."
    cargo install cargo-sweep
    cargo sweep --time $DAYS --recursive
fi

# Clean unused dependency cache
echo "🔄 Cleaning cargo cache..."
if command -v cargo-cache &> /dev/null; then
    cargo cache --autoclean
else
    echo "💡 Suggestion: install cargo-cache with 'cargo install cargo-cache'"
fi

# Show disk space usage
echo "📊 Disk space after cleanup:"
if [ -d "target" ]; then
    du -sh target || echo "Local target folder: removed"
fi

if [ -d "/tmp/rust-builds/dicta-clerk" ]; then
    echo "Shared target folder:"
    du -sh /tmp/rust-builds/dicta-clerk
fi

echo "✅ Cleanup completed!"

# Automation tip
echo ""
echo "💡 To automate this cleanup, add this line to your crontab:"
echo "   0 2 * * 0 $PROJECT_ROOT/scripts/cleanup-builds.sh 14  # Every Sunday at 2 AM"
echo ""
echo "   To edit crontab: crontab -e"
