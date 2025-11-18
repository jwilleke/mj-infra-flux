# jimsmcp - Infrastructure MCP Server

A Model Context Protocol (MCP) server for managing and querying the mj-infra-flux Kubernetes infrastructure.

## Overview

jimsmcp provides programmatic access to your k3s cluster through the Model Context Protocol, enabling AI assistants like Claude to:

- Query Kubernetes resources (pods, deployments, services, ingresses)
- View pod logs
- Check Flux GitOps status
- Force reconciliation of Flux resources
- Perform health checks on applications
- Get application URLs and endpoints
- Query Authentik deployment information

## Features

### Kubernetes Management
- **k8s_get_pods** - List pods with status and readiness
- **k8s_get_pod_logs** - Fetch logs from specific pods
- **k8s_get_deployments** - View deployment status
- **k8s_get_services** - List services and their endpoints
- **k8s_get_ingresses** - View ingress configurations

### Flux GitOps
- **flux_get_status** - Check status of Flux resources
- **flux_reconcile** - Force reconciliation of kustomizations, helm releases, or git repositories

### Application Management
- **app_health_check** - Comprehensive health check (pods + service + ingress)
- **app_get_urls** - List all application URLs
- **authentik_get_info** - Get Authentik API and admin URLs

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

Add to your Claude Code MCP configuration:

### macOS/Linux: `~/.config/claude-code/mcp.json`

```json
{
  "mcpServers": {
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
    "jimsmcp": {
      "command": "node",
      "args": ["C:\\path\\to\\mj-infra-flux\\apps\\production\\jimsmcp\\dist\\index.js"]
    }
  }
}
```

## Tool Examples

### Check pod status
```typescript
// Using k8s_get_pods
{
  "namespace": "monitoring",
  "labelSelector": "app=grafana"
}
```

### View application health
```typescript
// Using app_health_check
{
  "app": "grafana",
  "namespace": "monitoring"
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
2. Uses the Kubernetes JavaScript client to query resources
3. Executes `kubectl` and `flux` CLI commands for advanced operations
4. Communicates via stdio using the MCP protocol

## Requirements

- Node.js 18+
- kubectl configured with cluster access
- flux CLI installed
- Kubeconfig with appropriate permissions

## Security

jimsmcp inherits permissions from your kubeconfig. It can:
- Read all cluster resources
- View logs
- Trigger Flux reconciliations

It CANNOT:
- Modify or delete resources
- Execute commands in pods
- Change cluster configuration

## Kubernetes Deployment (Future)

While jimsmcp currently runs locally, it can be deployed as a Kubernetes service with:
- API server for HTTP-based MCP communication
- ServiceAccount with RBAC for cluster access
- Ingress for external access (with Authentik protection)

See deployment manifests in this directory when available.

## Troubleshooting

### "Unable to connect to cluster"
Ensure kubectl is working: `kubectl get nodes`

### "Flux command not found"
Install flux CLI: https://fluxcd.io/flux/installation/

### "Permission denied"
Check your kubeconfig has the necessary RBAC permissions

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Kubernetes JavaScript Client](https://github.com/kubernetes-client/javascript)
- [Flux CLI](https://fluxcd.io/flux/cmd/)
