#!/usr/bin/env bash
set -euo pipefail

# Install the repo's pre-commit hook.
#
# git hooks live in .git/hooks/, which is NOT version controlled — so a hook
# committed to scripts/ does nothing until each clone wires it up. That gap is
# why scripts/git-hook-commit.sh sat in this repo unused: present, correct, and
# never running.
#
# Run once per clone:
#   ./scripts/install-git-hooks.sh

repo_dir=$(git rev-parse --show-toplevel)
hook_src="${repo_dir}/scripts/git-hook-commit.sh"
hook_dst="${repo_dir}/.git/hooks/pre-commit"

if [ ! -f "$hook_src" ]; then
  echo "❌ $hook_src not found"
  exit 1
fi

chmod +x "$hook_src"

if [ -e "$hook_dst" ] && [ ! -L "$hook_dst" ]; then
  echo "⚠️  $hook_dst already exists and is not a symlink."
  echo "   Move it aside and re-run, or merge the two by hand."
  exit 1
fi

ln -sf "../../scripts/git-hook-commit.sh" "$hook_dst"

echo "✅ pre-commit hook installed → scripts/git-hook-commit.sh"
echo "   Runs: kubectl kustomize validation + markdownlint --fix on staged .md"
echo "   Bypass a single commit with: git commit --no-verify"
