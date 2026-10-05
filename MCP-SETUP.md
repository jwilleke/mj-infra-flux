# MCP (Model Context Protocol) Setup

This repository uses MCP servers to enable Claude Code to interact with external services programmatically.

## Configured MCP Servers

### 1. jimsmcp

Custom MCP server for managing infrastructure.

__Location:__ `apps/production/jimsmcp/`

### 2. Authentik MCP Server

Provides full API access to Authentik for automated user, group, and application management.

__Configuration:__ OpenBao path `kv/deby/workstation/mcp-authentik`

Keys: `AUTHENTIK_BASE_URL`, `AUTHENTIK_TOKEN`.

## Setup Instructions

### Prerequisites

1. __OpenBao CLI login__ from this workstation. The API is LAN-only. Trust the internal CA first (`infrastructure/prod/openbao/README.md`).

   ```bash
   export BAO_ADDR=https://stuff.nerdsbythehour.com
   export BAO_CACERT="$HOME/deby-internal-root-ca.crt"
   bao login -method=oidc
   ```

2. __jq installed:__

   ```bash
   sudo apt install jq
   ```

3. __kubectl__ that can reach the cluster, if `bao` is not installed locally. `scripts/update-mcp-config.sh` uses `kubectl exec` into `openbao-0`.

### Initial Setup

Run the update script. It reads OpenBao and writes the local MCP config. It does not print the token.

```bash
./scripts/update-mcp-config.sh
```

This script:

1. Reads `kv/deby/workstation/mcp-authentik`
2. Extracts `AUTHENTIK_BASE_URL` and `AUTHENTIK_TOKEN`
3. Updates `~/.config/claude-code/mcp.json`
4. Sets permissions `600` on that file

The encrypted file `.env.secret.mcp-authentik.encrypted` is not in this branch. Load it into OpenBao from an older checkout before Phase 2, using `scripts/openbao-bootstrap.sh`. See `infrastructure/prod/openbao/README.md`.

### Restart Claude Code

After running the update script, restart Claude Code to load the MCP servers.

## Configuration Details

### MCP Config Location

`~/.config/claude-code/mcp.json`

__Note:__ This file contains credentials and is __not committed to git__.

### OpenBao path

`kv/deby/workstation/mcp-authentik`

Contains:

- `AUTHENTIK_BASE_URL` - Authentik instance URL
- `AUTHENTIK_TOKEN` - API token with full access

## Security Notes

- The token is not in git.
- `mcp.json` is mode `600`.
- Rotate the token in Authentik, write the new value to OpenBao, then re-run `scripts/update-mcp-config.sh`.
- Do not extract `flux-system/sops-age`. That Secret is removed after Phase 3 reconciles.

## Updating Credentials

### Rotate Authentik API Token

1. Create a new token in Authentik at <https://auth.nerdsbythehour.com> (Directory, Tokens, API intent).
2. Write `AUTHENTIK_BASE_URL` and `AUTHENTIK_TOKEN` to `kv/deby/workstation/mcp-authentik` with the file-based `bao kv put` procedure in `infrastructure/prod/openbao/README.md`. Do not commit the token.
3. Run `./scripts/update-mcp-config.sh`.
4. Revoke the old token in Authentik.

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
   jq . ~/.config/claude-code/mcp.json
   ```

2. Refresh from OpenBao:

   ```bash
   ./scripts/update-mcp-config.sh
   ```

### Authentication Errors

Confirm the token in Authentik, then re-run `./scripts/update-mcp-config.sh`. Check token permissions in the Authentik admin interface.

### Permission Denied Errors

```bash
ls -l ~/.config/claude-code/mcp.json
# Should be: -rw------- (600)
```

## References

- [Authentik MCP Server](https://github.com/cdmx-in/authentik-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OpenBao runbook](infrastructure/prod/openbao/README.md)
