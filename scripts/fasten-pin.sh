#!/usr/bin/env bash
# Pin apps/production/fasten/deployment.yaml to the current :main digest.
#
# Usage (from mj-infra-flux root):
#   ./scripts/fasten-pin.sh           # pin + commit + push
#   ./scripts/fasten-pin.sh --dry-run # show what would change, no commit
#
# Prerequisites: gh CLI authenticated, git configured, run from repo root.
#
# When to run:
#   After merging a change to jwilleke/fasten-onprem main and confirming
#   the CI Docker build passed (ghcr.io/jwilleke/fasten-onprem:main updated).
#   Check CI: https://github.com/jwilleke/fasten-onprem/actions/workflows/docker-jwilleke.yaml
set -euo pipefail

DEPLOY="apps/production/fasten/deployment.yaml"
IMAGE="ghcr.io/jwilleke/fasten-onprem"
DRY_RUN=false

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Resolve the digest of :main via the GitHub Packages API.
# Returns the sha256 digest (e.g. sha256:abc123...)
DIGEST=$(gh api \
  -H "Accept: application/vnd.github+json" \
  "/users/jwilleke/packages/container/fasten-onprem/versions" \
  --jq '[.[] | select(.metadata.container.tags | index("main"))] | first | .name' \
  2>/dev/null || true)

if [[ -z "$DIGEST" || "$DIGEST" == "null" ]]; then
  echo "ERROR: could not resolve digest for ${IMAGE}:main" >&2
  echo "  - Confirm the GHCR package exists: https://github.com/jwilleke/fasten-onprem/pkgs/container/fasten-onprem" >&2
  echo "  - Confirm the CI build passed: https://github.com/jwilleke/fasten-onprem/actions/workflows/docker-jwilleke.yaml" >&2
  echo "  - Confirm the package visibility is Public (anonymous scan requires it)" >&2
  exit 1
fi

PINNED="${IMAGE}:main@${DIGEST}"
CURRENT=$(grep -oP '(?<=image: ).*' "$DEPLOY" | head -1)

if [[ "$CURRENT" == "$PINNED" ]]; then
  echo "Already pinned to current digest — nothing to do."
  echo "  $PINNED"
  exit 0
fi

echo "Pinning:"
echo "  was: $CURRENT"
echo "  now: $PINNED"

if $DRY_RUN; then
  echo "(dry-run — no changes written)"
  exit 0
fi

SHORT="${DIGEST:7:12}"  # first 12 chars of the hex after "sha256:"
sed -i "s|image: ${IMAGE}:main.*|image: ${PINNED}|" "$DEPLOY"

git add "$DEPLOY"
git commit -m "chore(fasten): pin image to main@${SHORT}"
git push
echo "Done. Flux will reconcile and roll out within ~1 minute."
