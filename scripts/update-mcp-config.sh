#!/usr/bin/env bash
#
# Update MCP configuration with decrypted Authentik credentials
#
# This script decrypts the SOPS-encrypted Authentik token and updates
# the Claude Code MCP configuration file.
#

set -euo pipefail

this_dir=$(cd $(dirname "$0"); pwd)
repo_dir=$(cd "$this_dir/.."; pwd)

# Load SOPS configuration
source "$this_dir/_sops_config.include.sh"

MCP_CONFIG="$HOME/.config/claude-code/mcp.json"
ENCRYPTED_ENV="$repo_dir/.env.secret.mcp-authentik.encrypted"

if [ ! -f "$ENCRYPTED_ENV" ]; then
    echo "Error: Encrypted env file not found at $ENCRYPTED_ENV"
    exit 1
fi

if [ ! -f "$SOPS_AGE_KEY_FILE" ]; then
    echo "Error: Age key file not found at $SOPS_AGE_KEY_FILE"
    exit 1
fi

echo "Decrypting Authentik MCP credentials..."

# Decrypt the env file
export SOPS_AGE_KEY_FILE
decrypted=$(sops decrypt --input-type dotenv --output-type dotenv "$ENCRYPTED_ENV")

# Extract values
AUTHENTIK_BASE_URL=$(echo "$decrypted" | grep AUTHENTIK_BASE_URL | cut -d= -f2-)
AUTHENTIK_TOKEN=$(echo "$decrypted" | grep AUTHENTIK_TOKEN | cut -d= -f2-)

if [ -z "$AUTHENTIK_BASE_URL" ] || [ -z "$AUTHENTIK_TOKEN" ]; then
    echo "Error: Failed to extract Authentik credentials"
    exit 1
fi

echo "Updating MCP configuration at $MCP_CONFIG..."

# Create or update MCP config
if [ ! -f "$MCP_CONFIG" ]; then
    mkdir -p "$(dirname "$MCP_CONFIG")"
    cat > "$MCP_CONFIG" <<EOF
{
  "mcpServers": {}
}
EOF
fi

# Use jq to update the config
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed"
    exit 1
fi

# Update or add the authentik server config
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

mv "$tmp_config" "$MCP_CONFIG"
chmod 600 "$MCP_CONFIG"

echo "✅ MCP configuration updated successfully!"
echo ""
echo "Next steps:"
echo "1. Restart Claude Code to load the Authentik MCP server"
echo "2. After restart, the Authentik MCP tools will be available"
echo ""
