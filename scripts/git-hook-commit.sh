#!/usr/bin/env bash
set -euo pipefail

# When running as a hook, we're in .git/hooks/, so need to go up two levels
# When running directly, we're in scripts/, so need to go up one level
this_dir=$(cd $(dirname "$0"); pwd)
repo_dir=$(git rev-parse --show-toplevel)

# the goal here is just to make sure at minimum kubectl kustomize processes all the yaml
check_kustomize() {
  local dir=$1
  local line_count=$(kubectl kustomize "$dir" | wc -l)

  if [ $? -ne 0 ]; then
    echo "Error: kubectl kustomize failed for $dir"
    exit 1
  else 
    echo "kustomize succeeded for $dir! Final line count: $line_count"
  fi
}

# Lint (and auto-fix) staged markdown against .markdownlint.jsonc.
#
# CI runs the same rulebook, so anything this does not fix here fails there
# instead — with a round-trip of minutes rather than seconds. Fixing at commit
# time is what keeps the CI job green without anyone having to memorise the
# ruleset. MD033 (inline HTML) and MD036 (bold-as-heading) are enabled in this
# repo and are the two most commonly tripped by hand-written prose.
check_markdown() {
  local files
  files=$(git diff --cached --name-only --diff-filter=ACM -- '*.md' | grep -v '^CHANGELOG.md$' || true)
  [ -z "$files" ] && return 0

  if ! command -v npx >/dev/null 2>&1; then
    echo "⚠️  npx not found — skipping markdown lint. CI will still enforce it."
    return 0
  fi

  echo "Linting staged markdown…"
  # --fix repairs what is mechanically repairable; whatever remains is a real
  # violation the author has to resolve.
  # shellcheck disable=SC2086
  if ! npx --yes markdownlint-cli2 --fix $files; then
    echo ""
    echo "❌ markdownlint found problems it could not fix automatically."
    echo "   Fix them and re-stage, or commit with --no-verify to bypass."
    exit 1
  fi

  # --fix rewrites files in the working tree; without re-staging, the commit
  # would record the unfixed version and CI would fail on content that is
  # already correct on disk — the most confusing possible outcome.
  # shellcheck disable=SC2086
  git add $files
  echo "markdown OK"
}

# Check both directories
check_kustomize "${repo_dir}/apps/production"
check_kustomize "${repo_dir}/infrastructure/prod/configs"
check_markdown

exit 0
