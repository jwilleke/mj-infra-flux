# jimsmcp Setup Guide

## Quick Start

The jimsmcp MCP server has been built and is ready to use!

### Step 1: Configure Claude Code

Add jimsmcp to your Claude Code MCP configuration:

**File location:** `~/.config/claude-code/mcp.json`

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

Or copy the example config:
```bash
mkdir -p ~/.config/claude-code
cp /home/jim/Documents/mj-infra-flux/apps/production/jimsmcp/mcp-config-example.json ~/.config/claude-code/mcp.json
```

### Step 2: Restart Claude Code

After adding the configuration, restart Claude Code for the changes to take effect.

### Step 3: Verify Connection

Once Claude Code restarts, you should see `mcp__jimsmcp__*` tools available. Try asking Claude:

```
"Show me all pods in the monitoring namespace"
```

Or:

```
"What's the health status of the grafana application?"
```

## Available Tools

jimsmcp provides 10 tools for managing your infrastructure:

### Kubernetes Management (5 tools)
- `mcp__jimsmcp__k8s_get_pods` - List pods with status
- `mcp__jimsmcp__k8s_get_pod_logs` - Get pod logs
- `mcp__jimsmcp__k8s_get_deployments` - View deployments
- `mcp__jimsmcp__k8s_get_services` - List services
- `mcp__jimsmcp__k8s_get_ingresses` - View ingresses

### Flux GitOps (2 tools)
- `mcp__jimsmcp__flux_get_status` - Check Flux resource status
- `mcp__jimsmcp__flux_reconcile` - Force reconciliation

### Application Management (3 tools)
- `mcp__jimsmcp__app_health_check` - Comprehensive health check
- `mcp__jimsmcp__app_get_urls` - List all application URLs
- `mcp__jimsmcp__authentik_get_info` - Get Authentik info

## Testing

Test the MCP server manually:

```bash
cd /home/jim/Documents/mj-infra-flux/apps/production/jimsmcp

# Test that server responds to MCP protocol
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
```

You should see a JSON response listing all 10 tools.

## Rebuilding

If you make changes to the TypeScript source:

```bash
cd /home/jim/Documents/mj-infra-flux/apps/production/jimsmcp
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Troubleshooting

### "Cannot find module"
Make sure dependencies are installed:
```bash
cd /home/jim/Documents/mj-infra-flux/apps/production/jimsmcp
npm install
```

### "Unable to connect to cluster"
jimsmcp uses your default kubeconfig. Verify kubectl works:
```bash
kubectl get nodes
```

### "Flux command not found"
Ensure flux CLI is installed and in PATH:
```bash
flux version
```

### Claude Code doesn't see the tools
1. Check that `~/.config/claude-code/mcp.json` exists and has the correct path
2. Restart Claude Code completely
3. Check Claude Code logs for MCP connection errors

## Security Notes

jimsmcp runs with the same permissions as your kubectl/kubeconfig. It can:
- ✅ Read all cluster resources
- ✅ View logs
- ✅ Trigger Flux reconciliations
- ❌ Cannot modify or delete resources (read-only)
- ❌ Cannot execute commands in pods

## Next Steps

Once jimsmcp is working with Claude Code, you can:

1. Ask Claude to check the health of all your applications
2. Query Flux status to see if deployments are up to date
3. Get logs from pods for troubleshooting
4. List all application URLs
5. Get Authentik API information for integration work

Enjoy your new infrastructure management capabilities!
