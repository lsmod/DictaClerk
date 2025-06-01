#!/bin/bash

# Pre-commit Setup Script for DictaClerk
# This script installs and configures pre-commit hooks

set -e

echo "🔧 Setting up pre-commit hooks for DictaClerk..."

# Check if we're in the right directory
if [ ! -f ".pre-commit-config.yaml" ]; then
    echo "❌ Error: .pre-commit-config.yaml not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Python is available
if ! command_exists python3 && ! command_exists python; then
    echo "❌ Error: Python is required but not installed."
    echo "Please install Python 3.6+ and try again."
    exit 1
fi

# Determine Python command
if command_exists python3; then
    PYTHON_CMD="python3"
elif command_exists python; then
    PYTHON_CMD="python"
fi

echo "✅ Found Python: $($PYTHON_CMD --version)"

# Check if pip is available
if ! command_exists pip3 && ! command_exists pip; then
    echo "❌ Error: pip is required but not installed."
    echo "Please install pip and try again."
    exit 1
fi

# Determine pip command
if command_exists pip3; then
    PIP_CMD="pip3"
elif command_exists pip; then
    PIP_CMD="pip"
fi

# Install pre-commit if not already installed
if ! command_exists pre-commit; then
    echo "📦 Installing pre-commit..."
    $PIP_CMD install pre-commit
else
    echo "✅ pre-commit is already installed: $(pre-commit --version)"
fi

# Install the git hook scripts
echo "🔗 Installing pre-commit hooks..."
pre-commit install

# Install commit-msg hook for additional checks
echo "📝 Installing commit-msg hook..."
pre-commit install --hook-type commit-msg

# Run pre-commit on all files to test the setup
echo "🧪 Testing pre-commit setup on all files..."
if pre-commit run --all-files; then
    echo "✅ All pre-commit checks passed!"
else
    echo "⚠️  Some pre-commit checks failed, but the hooks are installed."
    echo "You may need to fix the issues and commit again."
fi

echo ""
echo "🎉 Pre-commit hooks setup complete!"
echo ""
echo "What happens now:"
echo "• Every time you run 'git commit', the hooks will run automatically"
echo "• If any check fails, the commit will be blocked"
echo "• Run 'cargo fmt' in src-tauri/ to fix formatting issues"
echo "• Run 'cargo clippy --fix' in src-tauri/ to fix clippy issues"
echo ""
echo "To skip hooks temporarily (not recommended):"
echo "• Use 'git commit --no-verify'"
echo ""
echo "To run hooks manually:"
echo "• Run 'pre-commit run --all-files'"
echo ""
echo "Happy coding! 🚀"
