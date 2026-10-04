#!/usr/bin/env bash
#
# Write the local Claude Code MCP config from the Authentik token in OpenBao.
# Log in first: BAO_ADDR, BAO_CACERT, then `bao login -method=oidc role=mj`.
# The values live at kv/deby/workstation/mcp-authentik. They are not in git.
#

set -euo pipefail

MCP_CONFIG="$HOME/.config/claude-code/mcp.json"

if ! command -v bao >/dev/null; then
  echo "Error: bao is not on PATH" >&2
  exit 1
fi
if ! command -v jq >/dev/null; then
  echo "Error: jq is required" >&2
  exit 1
fi

raw=$(bao kv get -format=json kv/deby/workstation/mcp-authentik)
AUTHENTIK_BASE_URL=$(printf '%s' "$raw" | jq -r '.data.data.AUTHENTIK_BASE_URL')
AUTHENTIK_TOKEN=$(printf '%s' "$raw" | jq -r '.data.data.AUTHENTIK_TOKEN')
unset raw

if [[ -z "$AUTHENTIK_BASE_URL" || "$AUTHENTIK_BASE_URL" == "null" || -z "$AUTHENTIK_TOKEN" || "$AUTHENTIK_TOKEN" == "null" ]]; then
  echo "Error: OpenBao path is missing AUTHENTIK_BASE_URL or AUTHENTIK_TOKEN" >&2
  exit 1
fi

if [[ ! -f "$MCP_CONFIG" ]]; then
  mkdir -p "$(dirname "$MCP_CONFIG")"
  printf '%s\n' '{ "mcpServers": {} }' > "$MCP_CONFIG"
fi

tmp_config=$(mktemp)
jq --arg url "$AUTHENTIK_BASE_URL" --arg token "$AUTHENTIK_TOKEN" \
  '.mcpServers.authentik = {
    "command": "uvx",
    "args": [
      "authentik-mcp",
      "--base-url",
      $url,
      "--token",
      $token
    ]
  }' "$MCP_CONFIG" > "$tmp_config"
unset AUTHENTIK_TOKEN AUTHENTIK_BASE_URL

mv "$tmp_config" "$MCP_CONFIG"
chmod 600 "$MCP_CONFIG"

echo "MCP configuration updated at $MCP_CONFIG"
echo "Restart Claude Code to load the Authentik MCP server."
