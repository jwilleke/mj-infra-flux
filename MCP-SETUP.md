# MCP (Model Context Protocol) Setup

This repository uses MCP servers to enable Claude Code to interact with external services programmatically.

## Configured MCP Servers

### 1. jimsmcp
Custom MCP server for managing infrastructure.

**Location:** `apps/production/jimsmcp/`

### 2. Authentik MCP Server
Provides full API access to Authentik for automated user, group, and application management.

**Configuration:** Encrypted with SOPS+Age
**Encrypted File:** `.env.secret.mcp-authentik.encrypted`

## Setup Instructions

### Prerequisites

1. **SOPS installed:**
   ```bash
   # Already installed at /usr/local/bin/sops
   sops --version
   ```

2. **Age key file:**
   - Private key: `home-infra-private.agekey` (git-ignored)
   - Public key: `age1sr8j9p87wuuqfnmharzqqnwj76yyc6mu5j3r5t7sr3j88wzn8exqwy6jhj`
   - The private key is also stored in Kubernetes secret: `flux-system/sops-age`

3. **jq installed:**
   ```bash
   sudo apt install jq
   ```

### Initial Setup

Run the update script to decrypt credentials and configure MCP:

```bash
./scripts/update-mcp-config.sh
```

This script:
1. Decrypts `.env.secret.mcp-authentik.encrypted` using SOPS+Age
2. Extracts `AUTHENTIK_BASE_URL` and `AUTHENTIK_TOKEN`
3. Updates `~/.config/claude-code/mcp.json` with the configuration
4. Sets proper permissions (600) on the config file

### Restart Claude Code

After running the update script, restart Claude Code to load the MCP servers:

```bash
# Close and reopen Claude Code
# Or restart the MCP servers if Claude Code supports it
```

## Configuration Details

### MCP Config Location

`~/.config/claude-code/mcp.json`

**Note:** This file contains decrypted credentials and is **not committed to git**.

### Encrypted Credentials

`.env.secret.mcp-authentik.encrypted` (committed to git)

Contains:
- `AUTHENTIK_BASE_URL` - Authentik instance URL
- `AUTHENTIK_TOKEN` - API token with full access

**Encryption:** SOPS with Age encryption
**Public Key:** age1sr8j9p87wuuqfnmharzqqnwj76yyc6mu5j3r5t7sr3j88wzn8exqwy6jhj

### Decrypting Manually

To view the encrypted credentials:

```bash
export SOPS_AGE_KEY_FILE="$(pwd)/home-infra-private.agekey"
sops decrypt --input-type dotenv --output-type dotenv .env.secret.mcp-authentik.encrypted
```

## Security Notes

### ✅ Secure Practices

1. **Private key never committed:** `.agekey` files are in `.gitignore`
2. **Credentials encrypted at rest:** SOPS encryption in git
3. **Decrypted config protected:** `mcp.json` has 600 permissions
4. **API token scope limited:** Token has necessary permissions only

### ⚠️ Important Reminders

- **Never commit** `home-infra-private.agekey` to git
- **Never commit** unencrypted `.env` files
- **Rotate tokens** periodically (every 90-180 days)
- **Backup the age key** securely (it's in Kubernetes secret)

### Extracting Age Key from Kubernetes

If you need to restore the age key:

```bash
kubectl get secret -n flux-system sops-age -o jsonpath='{.data.age\.agekey}' | base64 -d > home-infra-private.agekey
chmod 600 home-infra-private.agekey
```

## Updating Credentials

### Rotate Authentik API Token

1. **Create new token in Authentik:**
   - Go to: https://auth.nerdsbythehour.com
   - Navigate to Directory → Tokens
   - Create new token with API intent
   - Copy the token

2. **Update encrypted file:**
   ```bash
   # Create temp env file
   cat > /tmp/mcp-authentik.env <<EOF
   AUTHENTIK_BASE_URL=https://auth.nerdsbythehour.com
   AUTHENTIK_TOKEN=your-new-token-here
   EOF

   # Encrypt it
   export SOPS_AGE_KEY_FILE="$(pwd)/home-infra-private.agekey"
   sops encrypt \
     --age age1sr8j9p87wuuqfnmharzqqnwj76yyc6mu5j3r5t7sr3j88wzn8exqwy6jhj \
     --input-type dotenv \
     --output-type dotenv \
     /tmp/mcp-authentik.env > .env.secret.mcp-authentik.encrypted

   # Remove plaintext
   rm /tmp/mcp-authentik.env
   ```

3. **Update MCP config:**
   ```bash
   ./scripts/update-mcp-config.sh
   ```

4. **Commit the new encrypted file:**
   ```bash
   git add .env.secret.mcp-authentik.encrypted
   git commit -m "Rotate Authentik MCP token"
   ```

5. **Revoke old token in Authentik**

## Available MCP Tools

After setup, Claude Code can use these Authentik MCP tools:

### User Management
- Create, read, update, delete users
- Manage user attributes and groups
- Reset passwords

### Group Management
- Create, read, update, delete groups
- Manage group memberships

### Application Management
- Create, read, update, delete applications
- Configure proxy providers
- Manage application settings

### Provider Management
- Create proxy providers
- Configure OAuth2/OIDC providers
- Manage provider settings

### Flow Management
- View and manage authentication flows
- Configure flow bindings

### Event Monitoring
- Search and filter events
- Monitor system activity

### Token Management
- Create API tokens
- Manage token permissions

## Troubleshooting

### MCP Server Not Loading

1. Check config syntax:
   ```bash
   cat ~/.config/claude-code/mcp.json | jq .
   ```

2. Verify credentials are decrypted:
   ```bash
   ./scripts/update-mcp-config.sh
   ```

3. Check SOPS can decrypt:
   ```bash
   export SOPS_AGE_KEY_FILE="$(pwd)/home-infra-private.agekey"
   sops decrypt .env.secret.mcp-authentik.encrypted
   ```

### Authentication Errors

1. Verify token is valid:
   ```bash
   TOKEN=$(sops decrypt --extract '["AUTHENTIK_TOKEN"]' .env.secret.mcp-authentik.encrypted)
   curl -H "Authorization: Bearer $TOKEN" https://auth.nerdsbythehour.com/api/v3/core/users/
   ```

2. Check token permissions in Authentik admin interface

### Permission Denied Errors

1. Check config file permissions:
   ```bash
   ls -l ~/.config/claude-code/mcp.json
   # Should be: -rw------- (600)
   ```

2. Check age key permissions:
   ```bash
   ls -l home-infra-private.agekey
   # Should be: -rw------- (600)
   ```

## References

- [Authentik MCP Server](https://github.com/cdmx-in/authentik-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [SOPS Documentation](https://github.com/getsops/sops)
- [Age Encryption](https://github.com/FiloSottile/age)
