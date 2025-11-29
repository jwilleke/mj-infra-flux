# jimsmcp - Custom Infrastructure MCP Server

A Model Context Protocol (MCP) server for custom and augmented features on the mj-infra-flux Kubernetes infrastructure.

## Overview

jimsmcp complements the official Kubernetes MCP server with custom features specific to your infrastructure, enabling AI assistants like Claude to:

- Check Flux GitOps status and trigger reconciliation
- Perform intelligent health checks on all applications (auto-discovers via ingresses)
- Get application URLs and endpoints
- Query and manage Authentik deployment and applications
- Get real-time stock quotes
- Execute custom infrastructure workflows

**For standard Kubernetes operations** (pods, deployments, services, logs, ingresses), use the official [Kubernetes MCP Server](https://github.com/containers/kubernetes-mcp-server).

## Features

### Flux GitOps
- **flux_get_status** - Check status of all Flux resources
- **flux_reconcile** - Force reconciliation of kustomizations, helm releases, or git repositories

### Application Management
- **app_health_check** - Comprehensive health check for a specific app (pods + service + ingress)
- **app_health_check_all** - Check health of all applications in the cluster (auto-discovers via ingresses)
- **app_get_urls** - List all application URLs and ingress endpoints
- **authentik_get_info** - Get Authentik API and admin URLs

### Authentik Management
- **authentik_create_homeassistant_app** - Create complete Home Assistant Authentik setup
- **authentik_list_applications** - List all Authentik applications
- **authentik_list_providers** - List all Authentik providers
- **authentik_list_outposts** - List all Authentik outposts
- **authentik_bind_provider_to_outpost** - Bind a provider to an outpost (enables ForwardAuth)

### Financial Data
- **stocks_get_price** - Get real-time stock quotes from Alpha Vantage (requires API key)

## Installation

```bash
cd /home/jim/Documents/mj-infra-flux/apps/production/jimsmcp
npm install
npm run build
```

## Development

```bash
# Watch mode for development
npm run watch

# Test the server
npm run dev
```

## Usage with Claude Code

Configure both the official Kubernetes MCP server and jimsmcp in your Claude Code MCP configuration.

### macOS/Linux: `~/.config/claude-code/mcp.json`

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "kubernetes-mcp-server@latest"]
    },
    "jimsmcp": {
      "command": "node",
      "args": ["/home/jim/Documents/mj-infra-flux/apps/production/jimsmcp/dist/index.js"]
    }
  }
}
```

### Windows: `%APPDATA%\claude-code\mcp.json`

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "kubernetes-mcp-server@latest"]
    },
    "jimsmcp": {
      "command": "node",
      "args": ["C:\\path\\to\\mj-infra-flux\\apps\\production\\jimsmcp\\dist\\index.js"]
    }
  }
}
```

## Tool Examples

### Check health of all applications
```typescript
// Using app_health_check_all
// Returns status of all ingress-exposed apps with pod/service/ingress details
```

### Check specific app health
```typescript
// Using app_health_check
{
  "app": "grafana",
  "namespace": "monitoring"
}
```

### Get Flux status
```typescript
// Using flux_get_status
{
  "resource": "kustomization"
}
```

### Reconcile Flux resources
```typescript
// Using flux_reconcile
{
  "kind": "kustomization",
  "name": "apps",
  "withSource": true
}
```

### Get all application URLs
```typescript
// Using app_get_urls
{
  "namespace": "production" // optional
}
```

## Architecture

jimsmcp runs as a standalone Node.js process that:

1. Connects to your Kubernetes cluster using the default kubeconfig
2. Executes `kubectl` and `flux` CLI commands for advanced operations
3. Interacts with Authentik API for SSO management
4. Communicates via stdio using the MCP protocol

**Separation of Concerns:**
- **Kubernetes MCP Server**: Handles standard K8s queries and operations
- **jimsmcp**: Handles infrastructure-specific features (Flux, Authentik, custom health checks)

## Requirements

- Node.js 18+
- kubectl configured with cluster access
- flux CLI installed
- Kubeconfig with appropriate permissions
- ALPHA_VANTAGE_KEY environment variable (for stock quotes)

## Security

jimsmcp inherits permissions from your kubeconfig. It can:
- Read Kubernetes resources (via kubernetes MCP server)
- View logs (via kubernetes MCP server)
- Trigger Flux reconciliations
- Query Authentik via API
- Trigger infrastructure workflows

It CANNOT:
- Modify or delete resources (read-only by design)
- Execute commands in pods
- Change cluster configuration
- Modify Authentik without explicit API calls

## Kubernetes Deployment (Future)

While jimsmcp currently runs locally, it can be deployed as a Kubernetes service with:
- API server for HTTP-based MCP communication
- ServiceAccount with RBAC for cluster access
- Ingress for external access (with Authentik protection)

## Troubleshooting

### "Unable to connect to cluster"
Ensure kubectl is working: `kubectl get nodes`

### "Flux command not found"
Install flux CLI: https://fluxcd.io/flux/installation/

### "Permission denied"
Check your kubeconfig has the necessary RBAC permissions

### Using both MCP servers
If you get errors about unknown tools:
- Standard K8s operations (pods, deployments, services, logs) → use `kubernetes` MCP server
- Custom infrastructure features (Flux, Authentik, health checks) → use `jimsmcp` MCP server

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Official Kubernetes MCP Server](https://github.com/containers/kubernetes-mcp-server)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Flux CLI](https://fluxcd.io/flux/cmd/)
- [Authentik Docs](https://goauthentik.io/docs/)
