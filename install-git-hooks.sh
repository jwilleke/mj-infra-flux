#!/usr/bin/env bash
set -euo pipefail

this_dir=$(cd $(dirname "$0"); pwd)
repo_dir=$(cd "$this_dir"; pwd)
hooks_dir="$repo_dir/.git/hooks"

echo "Installing git hooks..."
mkdir -p "$hooks_dir"

# Install pre-commit hook
cp "$repo_dir/scripts/git-hook-commit.sh" "$hooks_dir/pre-commit"
chmod +x "$hooks_dir/pre-commit"

echo "Git hooks installed successfully!"
