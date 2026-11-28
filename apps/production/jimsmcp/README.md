# jimsmcp

Jim's Model Context Protocol (MCP) server for this cluster. It adds Flux, app-health, Authentik and a stock-quote helper. It does not replace the official [Kubernetes MCP server](https://github.com/containers/kubernetes-mcp-server), which still covers ordinary pod, log, deployment and service queries.

It runs two ways:

- __stdio__ (local): an MCP client such as Claude Code starts `dist/index.js` as a child process. This is the mode that can actually use the Flux and Authentik tools today, because those need a local `flux` CLI or a SOPS-encrypted Authentik token (see [Secrets](#secrets)).
- __HTTP__ (in cluster): `dist/http-server.js` listens on port 9210. The live service is at <https://jimsmcp.nerdsbythehour.com/mcp>, behind Authentik forward-auth.

Source and manifests live in this folder: `apps/production/jimsmcp/`. Tool behaviour is defined in `src/index.ts` and `src/authentik.ts`. Per-tool inputs are in [TOOLS.md](TOOLS.md). Local client wiring is in [SETUP.md](SETUP.md).

## Tools (15)

Source of truth: the `TOOLS` array in `src/index.ts`. Tools marked __changes things__ update the cluster or Authentik. Delete and retire are __irreversible__ (a 404 is treated as already gone and is a no-op).

### Flux

- __flux_get_status__ — runs `flux get`. Default is `flux get all --all-namespaces`. With a resource type, runs `flux get <resource> -n <namespace>` (namespace defaults to `flux-system`).
- __flux_reconcile__ — __changes things.__ Runs `flux reconcile <kind> <name> -n <namespace>`, optional `--with-source`. Kind may be `kustomization`, `helmrelease`, or `gitrepository`. That CLI call patches the Flux object so it reconciles now.

### Application health

- __app_health_check__ — one app, by name and namespace. Pods are those labelled `app=<name>`. The Service is the one whose name equals the app. The Ingress is the one whose backend service name matches.
- __app_health_check_all__ — discovers apps from Ingress backends (optional namespace filter) and returns a summary sorted Degraded, No pods, Healthy, then Error.
- __app_get_urls__ — every Ingress rule as `{ app, namespace, url, paths }`. Uses `https` when the host is in the Ingress TLS list, otherwise `http`.

### Authentik (read)

- __authentik_get_info__ — Authentik pods in namespace `authentik` (label `app.kubernetes.io/name=authentik`) plus API and admin URLs taken from the Ingress named `authentik`.
- __authentik_list_applications__ — `GET /api/v3/core/applications/`.
- __authentik_list_providers__ — `GET /api/v3/providers/all/`.
- __authentik_list_outposts__ — `GET /api/v3/outposts/instances/`.

### Authentik (write)

These call the Authentik API with the token described under [Secrets](#secrets). They change SSO config. Check first with the list tools.

- __authentik_create_homeassistant_app__ — __changes things.__ Creates a proxy provider (`Home Assistant Provider`, external host `https://ha.nerdsbythehour.com`, internal host `https://192.168.68.20:8123`, forward-auth at domain level, TLS to HA not verified) and an application (`homeassistant`). It does not bind the provider to an outpost; use __authentik_bind_provider_to_outpost__ for that.
- __authentik_bind_provider_to_outpost__ — __changes things.__ Required for ForwardAuth. Input: `providerId` (required), `outpostId` (optional; defaults to the embedded outpost). Patches the outpost's provider list.
- __authentik_retire_application__ — __changes things, irreversible.__ Looks up the application by `slug`, deletes the application first (which drops policy bindings), then deletes its bound provider if there is one. Safe to repeat: 404 on either half is reported as already gone. After retire, the embedded-outpost Ingress may take about 30 seconds to drop the host.
- __authentik_delete_application__ — __changes things, irreversible.__ Deletes one application by `slug`. 404 is already gone.
- __authentik_delete_provider__ — __changes things, irreversible.__ Deletes one provider by numeric `pk`. 404 is already gone. Deleting a provider that is still in use can break ForwardAuth. Prefer __authentik_retire_application__ when retiring a whole app.

### Stocks

- __stocks_get_price__ — Alpha Vantage `GLOBAL_QUOTE` for a ticker (`symbol`, required). Needs the `ALPHA_VANTAGE_KEY` environment variable.

## Deployment

- Namespace: `jimsmcp`
- Deployment: `jimsmcp`, one replica, image `ghcr.io/jwilleke/jimsmcp:sha-08f1ce6` (public GHCR package, pinned by hand; there is no Flux ImagePolicy for this app)
- Service: ClusterIP, port 9210
- Ingress: `jimsmcp.nerdsbythehour.com`, class `traefik`, TLS via `cert-manager.io/cluster-issuer: letsencrypt-production` (secret `jimsmcp-tls`), middleware `authentik-authentik-forwardauth@kubernetescrd`
- Health: `GET /health` on port 9210 (liveness and readiness probes)
- ServiceAccount: `jimsmcp`
- ClusterRole `jimsmcp-reader` (bound cluster-wide):
  - get/list/watch: pods, services, namespaces, deployments, ingresses, Flux GitRepositories
  - get/list/watch/patch: Flux Kustomizations and HelmReleases

CI is `.github/workflows/jimsmcp.yml`. A push or PR that touches this folder type-checks and builds the image. A push to `master` also publishes `ghcr.io/jwilleke/jimsmcp:YYYY-MM-DD`, `:sha-<shortsha>`, and `:latest`. After a new image is published, bump the `image:` tag in `deployment.yaml` and let Flux apply it. Prefer the `sha-<shortsha>` tag.

The hostname is LAN-only: public DNS points it at deby (`192.168.68.71`), so it works at home or over VPN, not from the public internet. There is no separate MCP bearer token; access is an Authentik browser session via forward-auth.

## Secrets

Name the secret and the variable only. Never commit or paste values.

### Authentik token

`src/authentik.ts` does not read the environment. It decrypts the SOPS file `.env.secret.mcp-authentik.encrypted` at the repo root (keys `AUTHENTIK_BASE_URL` and `AUTHENTIK_TOKEN`) using the age key `home-infra-private.agekey` in the same directory. The path is hardcoded to `~/Documents/mj-infra-flux`, which is the deby checkout. See [MCP-SETUP.md](../../../MCP-SETUP.md) for how that file is maintained.

The in-cluster Deployment does not set `AUTHENTIK_BASE_URL` or `AUTHENTIK_TOKEN`, and it does not mount the encrypted file or the age key. Authentik tools therefore work only on a machine that has that checkout and key (typically deby), not inside the pod.

### Alpha Vantage key

`stocks_get_price` reads `process.env.ALPHA_VANTAGE_KEY`. The Deployment does not set that variable and there is no Kubernetes Secret for it in this folder, so the tool fails in the pod until one is added. For local use, export the variable in the shell that starts the stdio server.

### Image pull

The GHCR package is public (since 2026-10-08). The Deployment has no `imagePullSecrets`. The old `ghcr-jimsmcp` pull secret was removed in that change.

## Local development

Checkouts:

- Mac: `/Volumes/hd2A/workspaces/github/mj-infra-flux`
- deby: `~/Documents/mj-infra-flux`

Prefer repo-relative paths in docs and scripts. MCP config still needs an absolute path to the built `dist/index.js`. See [SETUP.md](SETUP.md).

```bash
cd apps/production/jimsmcp
npm install
npm run build
```

`npm run watch` rebuilds on change. `npm run dev` builds and starts the stdio server. `npm run start:http` starts the HTTP server (`PORT` defaults to 3000 if unset; the cluster sets `PORT=9210`).

## Setup scripts

This folder also has one-shot Authentik helpers. They are not MCP tools. They use the same Authentik credentials as the server. Do not run them unless you mean to change Authentik. They are kept here because they are still the scripts used to stand up or inspect individual apps; do not assume they are unused.

- `setup-all-apps.ts` — create missing ForwardAuth applications
- `setup-ha-oidc.ts` — Home Assistant OAuth2/OIDC (the current HA approach; not the proxy provider)
- `setup-cockpit.mjs`, `setup-fasten.mjs`, `setup-netalertx.mjs` — ForwardAuth for those apps
- `setup-ngdpbase.mjs` — OIDC provider, application and service account for ngdpbase ingest
- `src/setup-prometheus.ts`, `src/bind-prometheus-provider.ts` — Prometheus ForwardAuth
- `bind-ha-provider.ts`, `check-ha-provider.js`, `check-proxy-provider.js`, `fix-ha-provider.js`, `create-oidc-provider.cjs` — Home Assistant provider helpers
- `list-apps.ts` — list Authentik applications and providers
- `client-proxy.js` — stdio-to-HTTP proxy for MCP clients that only speak stdio

Some of these have a compiled `.js` twin next to the TypeScript source. Prefer the `.ts` / `.mjs` sources.

## Operations summary

### What it is and does

Jim's MCP server, so assistants can check Flux and app health, list URLs, manage Authentik applications, and fetch a stock quote. The ClusterRole is read-mostly, with patch on Flux Kustomizations and HelmReleases. Several write tools exist; see [Tools](#tools-15).

### Access

| Item | Value |
| --- | --- |
| URL | <https://jimsmcp.nerdsbythehour.com/mcp> (ClusterIP port 9210) |
| Reach | LAN only |
| Sign-in | Authentik forward-auth (browser session). There is no MCP bearer token on this service. |

### Where it runs / where data lives

deby, namespace `jimsmcp`, image `ghcr.io/jwilleke/jimsmcp:sha-08f1ce6` (public, pinned, not image-automated). ClusterRole `jimsmcp-reader` as above. No data volume.

### Secrets

No Kubernetes Secret is mounted in the Deployment today. Authentik credentials come from `.env.secret.mcp-authentik.encrypted` (`AUTHENTIK_BASE_URL`, `AUTHENTIK_TOKEN`) when the process can decrypt that file. Stock quotes need `ALPHA_VANTAGE_KEY` in the process environment. See [Secrets](#secrets).

### Dependencies

Authentik, Traefik, cert-manager, the Kubernetes API, and (for Flux tools, locally) the Flux CLI.

### Recovery

(a) Pod broken (from a machine that can reach deby):

```bash
ssh deby 'sudo -n k3s kubectl -n jimsmcp get pods'
ssh deby 'sudo -n k3s kubectl -n jimsmcp logs deploy/jimsmcp --tail=100'
ssh deby 'sudo -n k3s kubectl -n jimsmcp rollout restart deploy/jimsmcp'
```

(b) Data lost: no data.

(c) deby rebuilt: Flux redeploys; the image comes from public GHCR. The Authentik token file and age key are not in the pod, so in-cluster Authentik tools stay unavailable until that is wired differently.

### Health checks

```bash
ssh deby 'sudo -n k3s kubectl -n jimsmcp get pods'
curl -sI https://jimsmcp.nerdsbythehour.com/health
```

The Ingress should redirect unauthenticated clients to Authentik. In-cluster, the probes hit `/health` directly and expect HTTP 200 `{"status":"ok"}`.

### Known gaps

- New image tags need a manual bump in `deployment.yaml`.
- The ClusterRole can patch Flux objects. The HTTP endpoint is on the LAN and gated by Authentik; review that role if the service is ever exposed further.
- In the pod, Flux tools need a `flux` binary that the image does not ship, Authentik tools need a checkout path and age key that the pod does not have, and `stocks_get_price` needs `ALPHA_VANTAGE_KEY`, which is not set. Those tools work locally (with the caveats under [Secrets](#secrets)), not in the deployed server, as of this writing.
- `flux_reconcile` accepts `gitrepository`, but `jimsmcp-reader` cannot patch GitRepositories.
- `app_health_check` only sees pods labelled `app=<name>`. Apps that use other labels may show "No pods" even when they are running.

## References

- [TOOLS.md](TOOLS.md) — per-tool inputs and examples
- [SETUP.md](SETUP.md) — local stdio setup
- [MCP-SETUP.md](../../../MCP-SETUP.md) — Authentik token file used by local tools and setup scripts
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Official Kubernetes MCP Server](https://github.com/containers/kubernetes-mcp-server)
- [Flux CLI](https://fluxcd.io/flux/cmd/)
- [Authentik docs](https://goauthentik.io/docs/)
