#!/usr/bin/env bash
# Build a GHCR pull secret and store it in OpenBao.
# ESO syncs kv/deby/jimsmcp/ghcr-jimsmcp property dockerconfigjson into
# Secret jimsmcp/ghcr-jimsmcp key .dockerconfigjson.
# The local env file is gitignored. Nothing is written into the git tree.
# Secret values are not printed.
set -euo pipefail
umask 077

this_dir=$(cd "$(dirname "$0")" && pwd)
env_file="$this_dir/.env.secret.github"

if [[ ! -f "$env_file" ]]; then
  echo "Error: $env_file not found. Create it with github_username, github_token, and github_email." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$env_file"

if [[ -z "${github_username:-}" || -z "${github_token:-}" || -z "${github_email:-}" ]]; then
  echo "Error: github_username, github_token, and github_email must be set in $env_file." >&2
  exit 1
fi

if [[ -z "${BAO_TOKEN:-}" ]]; then
  echo "Export BAO_TOKEN to an admin token. Do not paste it into git." >&2
  exit 1
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

auth=$(printf '%s:%s' "$github_username" "$github_token" | base64 | tr -d '\n')
jq -n \
  --arg user "$github_username" \
  --arg pass "$github_token" \
  --arg email "$github_email" \
  --arg auth "$auth" \
  '{dockerconfigjson: ({auths: {"ghcr.io": {username: $user, password: $pass, email: $email, auth: $auth}}} | @json)}' \
  >"$tmp"

kubectl -n openbao exec -i openbao-0 -- sh -c 'cat > /tmp/bao-payload.json && chmod 600 /tmp/bao-payload.json' <"$tmp"
kubectl -n openbao exec -i openbao-0 -- env BAO_TOKEN="$BAO_TOKEN" \
  bao kv put kv/deby/jimsmcp/ghcr-jimsmcp @/tmp/bao-payload.json >/dev/null
kubectl -n openbao exec openbao-0 -- rm -f /tmp/bao-payload.json

echo "Stored dockerconfigjson at kv/deby/jimsmcp/ghcr-jimsmcp."
echo "ESO refreshes Secret jimsmcp/ghcr-jimsmcp. See infrastructure/prod/openbao/README.md."
