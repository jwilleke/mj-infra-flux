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

__For standard Kubernetes operations__ (pods, deployments, services, logs, ingresses), use the official [Kubernetes MCP Server](https://github.com/containers/kubernetes-mcp-server).

## Features

### Flux GitOps

- __flux_get_status__ - Check status of all Flux resources
- __flux_reconcile__ - Force reconciliation of kustomizations, helm releases, or git repositories

### Application Management

- __app_health_check__ - Comprehensive health check for a specific app (pods + service + ingress)
- __app_health_check_all__ - Check health of all applications in the cluster (auto-discovers via ingresses)
- __app_get_urls__ - List all application URLs and ingress endpoints
- __authentik_get_info__ - Get Authentik API and admin URLs

### Authentik Management

- __authentik_create_homeassistant_app__ - Create complete Home Assistant Authentik setup
- __authentik_list_applications__ - List all Authentik applications
- __authentik_list_providers__ - List all Authentik providers
- __authentik_list_outposts__ - List all Authentik outposts
- __authentik_bind_provider_to_outpost__ - Bind a provider to an outpost (enables ForwardAuth)

### Financial Data

- __stocks_get_price__ - Get real-time stock quotes from Alpha Vantage (requires API key)

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

__Separation of Concerns:__

- __Kubernetes MCP Server__: Handles standard K8s queries and operations
- __jimsmcp__: Handles infrastructure-specific features (Flux, Authentik, custom health checks)

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

Install flux CLI: <https://fluxcd.io/flux/installation/>

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

## Operations summary

*Moved from homelab `network/apps/jimsmcp.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

jimsmcp is Jim's own MCP server, so AI agents can read cluster and home state
through one tool endpoint. It has a read-mostly cluster role that can also tell
Flux to reconcile.

### Access

| Item | Value |
| --- | --- |
| URL | <https://jimsmcp.nerdsbythehour.com> (port 9210 in cluster) |
| Reach | LAN only |
| Sign-in | Authentik forward-auth. How agents authenticate is Unknown — to fill in |

### Where it runs / where data lives

deby, namespace `jimsmcp`, image `ghcr.io/jwilleke/jimsmcp:sha-08f1ce6` (pinned,
not image-automated). ClusterRole `jimsmcp-reader` (read plus patch on Flux
Kustomizations and HelmReleases). No data volume.

### Secrets

Unknown — to fill in (none found in the app folder).

### Dependencies

Authentik, Traefik, Kubernetes API, Flux.

### Recovery

(a) Pod broken:

```bash
kubectl -n jimsmcp get pods
kubectl -n jimsmcp logs deploy/jimsmcp --tail=100
kubectl -n jimsmcp rollout restart deploy/jimsmcp
```

(b) Data lost: no data.

(c) deby rebuilt: Flux redeploys; image comes from GHCR.

### Health checks

```bash
kubectl -n jimsmcp get pods
curl -sI https://jimsmcp.nerdsbythehour.com/ | head -3     # redirect to Authentik
```

### Known gaps

- New versions need a manual tag bump in git.
- The role can patch Flux objects (suspend/resume); review if the server is ever exposed further.

## For users: MCP Server — jimsmcp.nerdsbythehour.com

*Moved from homelab `docs/services-provided/jimsmcp.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Model Context Protocol (MCP) endpoint. Exposes tools and resources to AI assistants (e.g. Claude) that support the MCP standard, enabling them to interact with services in this infrastructure.

### How to reach it

__MCP endpoint:__ <https://jimsmcp.nerdsbythehour.com/mcp>

LAN only. Public DNS (checked 2026-11-23 with `dig @1.1.1.1`) points this name at deby, `192.168.68.71`, so it is not reachable from the internet. (The older homelab page said it was public via Cloudflare.)

### Authentication

Authentik ForwardAuth — an authenticated Authentik session is required. AI clients connecting programmatically will need to handle the OAuth2 flow or use a token.

### What it exposes

The MCP server provides AI assistants with tools to interact with local services such as Home Assistant. The exact tool set is defined by the server's configuration in `mj-infra-flux/apps/production/jimsmcp/`.

### Operator reference

- Operator notes from the old `docs/apps/jimsmcp-server.md` are in this README
- [`mj-infra-flux/apps/production/jimsmcp/`](./)

## Operator notes: jimsmcp — custom infrastructure MCP server

*Moved from homelab `docs/apps/jimsmcp-server.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Operator-side documentation for `jimsmcp`: where the source lives, how it builds and ships to the cluster, how to operate the deployed pod, and the current tool surface. End-user client wiring (Claude Code's `mcp.json`) is documented in the source repo's `SETUP.md`; this doc is the host owner's view from `deby`.

### What it is

A Model Context Protocol (MCP) server written in TypeScript that exposes 12 custom tools over Kubernetes, Flux, Authentik, and Alpha Vantage. It deliberately does __not__ duplicate the official [Kubernetes MCP server](https://github.com/containers/kubernetes-mcp-server) — pod listings, log tails, deployment rollouts, and similar basics live there. `jimsmcp` adds the things that aren't generic: Flux GitOps reconciliation, application health roll-ups (auto-discovered via ingresses), Authentik admin operations, and one stock-quote helper.

It runs in two transport modes:

- __stdio__ — invoked by an MCP client like Claude Code as a child process; the default `main()` path. This is the local-development shape.
- __HTTP__ — `dist/http-server.js`, listens on port 9210, exposed via Traefik ingress at `https://jimsmcp.nerdsbythehour.com` (Authentik ForwardAuth gates access). This is the cluster-deployed shape.

### Where everything lives

| Asset | Location |
| --- | --- |
| Source | `~/Documents/mj-infra-flux/apps/production/jimsmcp/` |
| K8s manifests | same directory: `deployment.yaml`, `service.yaml`, `ingress.yaml`, `namespace.yaml`, `serviceaccount.yaml`, `kustomization.yaml` |
| Build config | `tsconfig.json` (target ES2022, `module: Node16`, `strict: true`, `rootDir: src`, `outDir: dist`) |
| Build artifacts | `dist/` (gitignored; produced by `npm run build`) |
| Container image (canonical) | `ghcr.io/jwilleke/jimsmcp:<tag>` — private GHCR package; kubelet pulls via `imagePullSecret` |
| Container image (build artifact) | `jimsmcp:<tag>` in the host Docker daemon (transient — only between `docker build` and `docker push`) |
| Rollback image | `ghcr.io/jwilleke/jimsmcp:rollback-2026-05-04` (id `b374ff52`, same bytes as the previously-running `:latest`) |
| Image-pull credential | `ghcr-jimsmcp` Secret in namespace `jimsmcp`, type `kubernetes.io/dockerconfigjson`. __Committed + SOPS-age-encrypted__ at `apps/production/jimsmcp/ghcr-jimsmcp.sops.yaml`; Flux-applied via the `apps` Kustomization's `decryption: sops`. The cluster rebuilds this Secret from Git automatically (no hand-application step). The decryption private key is `flux-system/sops-age` — backed up nightly into `deby-backup/host/daily/<date>/dumps/flux-sops-age.key` (mode 0600, age-format validated); restore procedure in `/deby-backup/RESTORE.md` §6a (used only on a fresh-cluster bootstrap, *before* the first Flux reconcile). |
| Deployed pod | namespace `jimsmcp`, deployment `jimsmcp`, single replica |
| Public URL | `https://jimsmcp.nerdsbythehour.com` — Authentik-protected |

### Architecture

```text
host: deby                                  k3s: namespace jimsmcp
─────────────                               ──────────────────────
~/Documents/mj-infra-flux/apps/production/jimsmcp
  src/*.ts ──tsc──> dist/*.js
                     │
                     │ docker build (Dockerfile copies dist/ + src/,
                     │                npm ci --only=production)
                     ▼
              jimsmcp:<tag>  (Docker daemon — local build artifact)
                     │
                     │ docker push
                     ▼
              ghcr.io/jwilleke/jimsmcp:<tag>  (private GHCR package)
                                                │
                                                │ kubelet pull, authenticated via
                                                │ secret/ghcr-jimsmcp (dockerconfigjson)
                                                ▼
                                    deployment/jimsmcp (1 replica)
                                       │  imagePullSecrets: [ghcr-jimsmcp]
                                       │  imagePullPolicy: IfNotPresent
                                       │  port 9210, /health probe
                                       ▼
                                    pod jimsmcp-*
                                       │  uses ServiceAccount/jimsmcp
                                       │  in-cluster API access via
                                       │  @kubernetes/client-node@1.x
                                       ▼
                                    Service jimsmcp (ClusterIP :9210)
                                       │
                                       ▼
                                    Ingress (traefik)
                                      jimsmcp.nerdsbythehour.com
                                      cert-manager: letsencrypt-production
                                      middleware:   authentik-authentik-forwardauth
```

The Dockerfile uses `node:18-alpine`; local `tsc` runs on Node 22 (the host default). Compiled JS is portable between both — but if behavior diverges, suspect a Node-22-only API leaking into source.

### Build flow

The canonical build path is the __CI workflow__ at `mj-infra-flux/.github/workflows/jimsmcp.yml` (landed 2026-05-22; closes [#42](https://github.com/jwilleke/mj-infra-flux/issues/42)). It triggers on push or PR for changes under `apps/production/jimsmcp/**` (or to the workflow file itself) and runs:

1. `actions/setup-node@v4` — Node 22, `npm` cache keyed on `package-lock.json`.
2. `npm ci --include=dev` — install with devDeps (typescript).
3. `npx tsc --noEmit` — __type-check gate__. Fails the workflow on any TS error. This is what would have caught [#29](https://github.com/jwilleke/mj-infra-flux/issues/29).
4. `npm run build` — produce `dist/`.
5. `docker/build-push-action@v5` — build image. __On `master` push only__ (not PRs), also pushes three tags to GHCR:
   - `ghcr.io/jwilleke/jimsmcp:YYYY-MM-DD` (mutable per-day pointer)
   - `ghcr.io/jwilleke/jimsmcp:sha-<shortsha>` (immutable per-commit; preferred for `deployment.yaml`)
   - `ghcr.io/jwilleke/jimsmcp:latest` (mutable; convenience)

GHCR auth uses `${{ secrets.GITHUB_TOKEN }}` with `packages: write`. No PAT involved. PRs run steps 1–5 (build validation, no push); only master pushes get to GHCR.

Tag strategy for `deployment.yaml`: prefer the __`sha-<shortsha>`__ form (immutable, lossless audit trail, works cleanly with `imagePullPolicy: IfNotPresent`). Avoid pinning to `:latest` — it loses the audit trail of what's actually running, and `IfNotPresent` won't re-pull without an explicit `kubectl rollout restart`. The dated tag is OK if you want a "latest-of-day" pointer but be aware it shifts.

#### Emergency local rebuild

If CI is down or you need to test a build before pushing the PR, the manual path still works (the Dockerfile __does not__ run `tsc` itself; `dist/` must exist in the build context before `docker build`):

```bash
cd ~/Documents/mj-infra-flux/apps/production/jimsmcp
npm install --include=dev          # devDeps: typescript, @types/node
npm run build                      # tsc → dist/
docker build -t jimsmcp:<tag> .
docker tag jimsmcp:<tag> ghcr.io/jwilleke/jimsmcp:<tag>
docker push ghcr.io/jwilleke/jimsmcp:<tag>
```

Use this sparingly — the CI workflow is the source of truth for what's been built and pushed.

### Ship the image to k3s

The image lives on GHCR after `docker push`; kubelet pulls it on demand using the `ghcr-jimsmcp` Secret. No host-side `k3s ctr images import` step is needed — the registry IS the canonical store. Verify the push landed:

```bash
gh api /users/jwilleke/packages/container/jimsmcp/versions \
  --jq '.[] | {tags: .metadata.container.tags, updated_at}'
```

(Older builds left `jimsmcp:*` tags in the local Docker daemon and k3s containerd cache. After the GHCR cutover, those local copies are no longer load-bearing — the rollout will pull from the registry. They're safe to `docker rmi` once you've verified the registry path works end-to-end.)

### Roll the pod

If you bumped the tag and committed, Flux reconciles within ~10 min; force it with:

```bash
flux reconcile kustomization apps -n flux-system
```

If you reused `:latest`:

```bash
kubectl rollout restart deployment/jimsmcp -n jimsmcp
kubectl rollout status deployment/jimsmcp -n jimsmcp
```

### Day-to-day operations

```bash
# Pod state, restart count, age
kubectl get pod -n jimsmcp -o wide

# Live logs (HTTP transport prints to stderr)
kubectl logs -n jimsmcp -l app=jimsmcp --tail=200 -f

# Health probe
kubectl get pod -n jimsmcp -l app=jimsmcp -o jsonpath='{.items[0].status.containerStatuses[0].ready}'

# Tool registration (stdio mode, local)
node ~/Documents/mj-infra-flux/apps/production/jimsmcp/dist/index.js < /dev/null 2>&1 &
# (the server runs until stdin closes; just confirm it boots)

# Public endpoint reachability (will redirect to Authentik for auth)
curl -sI https://jimsmcp.nerdsbythehour.com/health
```

### Tool surface (12 tools)

Source of truth: the `TOOLS` array in `src/index.ts`. The source-side `TOOLS.md` is __stale__ — it lists 14 tools, including `k8s_get_pods`, which was removed when the official Kubernetes MCP server took over the basics. Cross-check against `src/index.ts` if `TOOLS.md` and reality disagree.

#### Flux

- __`flux_get_status`__ — wraps `flux get all --all-namespaces` (or scoped `flux get <kind> -n <ns>`).
- __`flux_reconcile`__ — wraps `flux reconcile {kind} {name} -n {namespace}`, with `--with-source` toggle.

#### Application health

- __`app_health_check`__ — for one app: pod state + label-matched service + ingress.
- __`app_health_check_all`__ — auto-discovers apps from cluster ingresses, then runs the same check across all of them. Returns a sorted summary (Degraded / No pods / Healthy / Error).
- __`app_get_urls`__ — flattens all ingress rules into a list of `{ app, namespace, url, paths }` records.

#### Authentik

- __`authentik_get_info`__ — pulls Authentik pod state and infers `apiUrl` / `adminUrl` from the ingress.
- __`authentik_create_homeassistant_app`__ — one-shot: creates the ProxyProvider + Application for Home Assistant.
- __`authentik_list_applications`__, __`authentik_list_providers`__, __`authentik_list_outposts`__ — admin listings.
- __`authentik_bind_provider_to_outpost`__ — required step for ForwardAuth (binds a provider to the embedded outpost by default).

#### Misc

- __`stocks_get_price`__ — Alpha Vantage `GLOBAL_QUOTE` lookup. Reads `ALPHA_VANTAGE_KEY` from the pod environment.

### Known state (2026-05-05)

- __Running image:__ `ghcr.io/jwilleke/jimsmcp:2026-05-05`, manifest digest `sha256:a34b3b1dd6b2419e3551d7a4b362b9a14e3a31ae7cd9f0bdb1bc07a7f4053045`. Pulled from GHCR via `imagePullSecrets: [ghcr-jimsmcp]`. Same compiled bytes as the local-only `40edbea4...` Docker daemon image — they were tagged from the same `docker build`.
- __Source state:__ master is buildable. The 7 TS errors documented in [#29](https://github.com/jwilleke/mj-infra-flux/issues/29) (plus 4 hidden runtime bugs masked by `as any` casts) were fixed in `mj-infra-flux@c6205ff` — all 12 k8s API call sites now use the v1.x request-object form.
- __Source-side dep vulns:__ 0 open Dependabot alerts on `apps/production/jimsmcp/package-lock.json` (was 25; cleared by 6 PR merges plus a manual `express-rate-limit` lock bump on 2026-05-05). The fixes are now actually running in production after the GHCR-mediated rollout.
- __Off-host preservation:__ done — both the running tag and the rollback tag live at `ghcr.io/jwilleke/jimsmcp:*` (private). The local-only Docker daemon and containerd copies are no longer load-bearing. Tracked in [#41](https://github.com/jwilleke/mj-infra-flux/issues/41).
- __Pod restarts:__ post-rollover, fresh pod (`jimsmcp-6bc7fd8477-*`), 0 restarts at last check. The previous incarnation accumulated 7 over 157d but those were largely host-reboot artifacts (kernel updates) — see session 2026-05-05-12 for the cluster-wide flap analysis.
- __CI workflow:__ [#42](https://github.com/jwilleke/mj-infra-flux/issues/42) closed 2026-05-22. `.github/workflows/jimsmcp.yml` builds + type-checks every push/PR touching `apps/production/jimsmcp/**`; master pushes also publish the image to GHCR with date / sha / latest tags. The `tsc --noEmit` gate would now catch source-side drift like the #29 pattern. __Deployment auto-bump__ (image-automation entry under `apps/production/image-automation/` analogous to `geohazardwatch-policy.yaml`) is a separate follow-up — for now an operator still hand-bumps the `image:` tag in `deployment.yaml` after a new build.

### Pointers

- `mj-infra-flux/apps/production/jimsmcp/README.md` — feature overview, written from the user's side.
- `mj-infra-flux/apps/production/jimsmcp/SETUP.md` — Claude Code MCP client wiring (`~/.config/claude-code/mcp.json`).
- `mj-infra-flux/apps/production/jimsmcp/TOOLS.md` — per-tool detailed reference. __Stale__: lists tools that no longer exist. Use `src/index.ts` as the source of truth; update `TOOLS.md` next time it's touched.
- [`mj-infra-flux#29`](https://github.com/jwilleke/mj-infra-flux/issues/29) — closed; the v1.x API migration that unblocked builds.
- [`mj-infra-flux#40`](https://github.com/jwilleke/mj-infra-flux/issues/40) — closed; rebuild + redeploy executed (commit `24c2f7b`, image bumped from 5-month-old `b374ff52` to `40edbea4`).
- [`mj-infra-flux#41`](https://github.com/jwilleke/mj-infra-flux/issues/41) — closed; image off-host preservation. GHCR auth, push, and `imagePullSecret` wiring landed in `4ff3708`.
- [`mj-infra-flux#42`](https://github.com/jwilleke/mj-infra-flux/issues/42) — open; CI workflow that closes the drift-detection gap.
- The 2026-05 session log (no longer kept; it was `~/thishost/docs/project_log.md`) — sessions 2026-05-05-07 through -13 cover the Dependabot sweep, the source migration, the rebuild + redeploy, the cluster-flap analysis, and the SMB-stack retirement.
