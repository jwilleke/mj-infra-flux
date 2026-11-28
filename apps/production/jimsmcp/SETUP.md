# jimsmcp local setup

How to run jimsmcp as a local stdio MCP server (for example from Claude Code). The cluster already runs the HTTP server at <https://jimsmcp.nerdsbythehour.com/mcp>. For what the 15 tools do, and which ones change things, see [TOOLS.md](TOOLS.md) and [README.md](README.md).

## Checkouts

- Mac: `/Volumes/hd2A/workspaces/github/mj-infra-flux`
- deby: `~/Documents/mj-infra-flux`

Build from a repo-relative path:

```bash
cd apps/production/jimsmcp
npm install
npm run build
```

The MCP client config still needs an __absolute__ path to `apps/production/jimsmcp/dist/index.js` in whichever checkout you are using.

## Claude Code config

File: `~/.config/claude-code/mcp.json`

Example (Mac checkout). On deby, point `args` at `.../Documents/mj-infra-flux/apps/production/jimsmcp/dist/index.js` instead. An official Kubernetes MCP server can sit alongside this one; it is optional and handles ordinary kubectl-style queries.

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "kubernetes-mcp-server@latest"]
    },
    "jimsmcp": {
      "command": "node",
      "args": [
        "/Volumes/hd2A/workspaces/github/mj-infra-flux/apps/production/jimsmcp/dist/index.js"
      ]
    }
  }
}
```

`mcp-config-example.json` in this folder is a stub of the same shape; edit the path before copying it.

Restart Claude Code after changing the file. You should then see `mcp__jimsmcp__*` tools (15 of them).

### Authentik and stock tools locally

Authentik tools decrypt `.env.secret.mcp-authentik.encrypted` from `~/Documents/mj-infra-flux` (keys `AUTHENTIK_BASE_URL` and `AUTHENTIK_TOKEN`). That is the deby checkout. On the Mac, those tools will fail unless that same path exists and has the age key. Details: [README secrets](README.md#secrets) and [MCP-SETUP.md](../../../MCP-SETUP.md).

For `stocks_get_price`, export `ALPHA_VANTAGE_KEY` in the environment of the process that starts the server.

Flux tools need the `flux` CLI on your `PATH`, and Kubernetes tools use your default kubeconfig.

## Smoke test

```bash
cd apps/production/jimsmcp
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
```

You should get a JSON list of all 15 tools.

Rebuild after editing TypeScript with `npm run build`, or use `npm run watch`.

## Troubleshooting

### Cannot find module

```bash
cd apps/production/jimsmcp
npm install
npm run build
```

### Unable to connect to the cluster

jimsmcp uses the default kubeconfig. Check `kubectl get nodes`, or on this network `ssh deby 'sudo -n k3s kubectl get nodes'`.

### Flux command not found

Install the Flux CLI and keep it on `PATH`: <https://fluxcd.io/flux/installation/>

### Authentik tools fail to load config

The client is looking for `~/Documents/mj-infra-flux/.env.secret.mcp-authentik.encrypted` and `home-infra-private.agekey`. That path is hardcoded. See [README secrets](README.md#secrets).

### Claude Code does not see the tools

1. Confirm `~/.config/claude-code/mcp.json` has an absolute path to `dist/index.js` in this folder.
2. Restart Claude Code.
3. Check Claude Code logs for MCP connection errors.

## Security

Local stdio jimsmcp uses your kubeconfig, so it can do whatever that kubeconfig can do, including Flux reconciles if you have those rights.

The in-cluster server uses ServiceAccount `jimsmcp` and ClusterRole `jimsmcp-reader`: read pods, services, namespaces, deployments, ingresses and GitRepositories; get/list/watch/patch Kustomizations and HelmReleases. It cannot exec into pods.

Authentik create, bind, retire and delete tools change SSO config. Retire and delete are irreversible. The in-cluster Deployment does not currently provide the Authentik token, so those tools are a local-checkout concern today.
