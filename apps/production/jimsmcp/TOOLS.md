# jimsmcp tool reference

All 15 tools from the `TOOLS` array in `src/index.ts`. Authentik write calls are implemented in `src/authentik.ts`.

Tools marked __changes things__ update the cluster or Authentik. Delete and retire are __irreversible__ when they succeed. A 404 on delete or retire is treated as already gone and is a no-op.

In Claude Code, tool names are prefixed with `mcp__jimsmcp__` (for example `mcp__jimsmcp__flux_get_status`).

There are no `k8s_get_*` tools here any more. Use the official Kubernetes MCP server for pods, logs, deployments, services and ingresses.

## Flux

### flux_get_status

Get Flux resource status by running the `flux` CLI.

__Parameters:__

- `resource` (optional): resource type, for example `kustomization` or `helmrelease`. If omitted (or `all`), runs `flux get all --all-namespaces`.
- `namespace` (optional): used only when `resource` is set. Default: `flux-system`.

__Examples:__

```json
{}
```

```json
{"resource": "kustomization"}
```

```json
{"resource": "kustomization", "namespace": "flux-system"}
```

__Returns:__ text from `flux get`.

__Needs:__ the `flux` CLI on the machine running the server. The container image does not include it.

---

### flux_reconcile

__Changes things.__ Force a Flux object to reconcile now. Runs `flux reconcile <kind> <name> -n <namespace>`, and adds `--with-source` when asked. That patches the object.

__Parameters:__

- `kind` (required): `kustomization`, `helmrelease`, or `gitrepository`
- `name` (required): resource name
- `namespace` (optional): default `flux-system`
- `withSource` (optional): also reconcile the source. Default: false

__Example:__

```json
{
  "kind": "kustomization",
  "name": "apps",
  "withSource": true
}
```

__Needs:__ the `flux` CLI. The in-cluster ServiceAccount may patch Kustomizations and HelmReleases, but not GitRepositories. A local run that uses Jim's kubeconfig is not limited by that ClusterRole.

---

## Application health

### app_health_check

Health for one application: matching pods, the Service of the same name, and an Ingress whose backend service name matches.

__Parameters:__

- `app` (required): application name (also the Service name and the `app=` label)
- `namespace` (required): namespace

__Example:__

```json
{
  "app": "grafana",
  "namespace": "monitoring"
}
```

__Returns:__ JSON with `app`, `namespace`, `pods` (name, status, ready, restarts), `service` (name, type, clusterIP, or `null`), and `ingress` (name, hosts, or omitted / `null`).

Pods are listed with label selector `app=<app>`. Apps that use a different label may return an empty pod list.

---

### app_health_check_all

Discover applications from Ingress backends and run a shorter health check on each.

__Parameters:__

- `namespace` (optional): only Ingresses in that namespace. If omitted, all namespaces.

__Returns:__ JSON summary: `total`, `healthy`, `degraded`, `noPods`, `errors`, and `apps`. Each app has `status` (`Degraded`, `No pods`, `Healthy`, or `Error`), pod counts, restart sum, and whether a Service and Ingress were found. Results are sorted Degraded, No pods, Healthy, then Error, then by name.

---

### app_get_urls

List application URLs from Ingress rules.

__Parameters:__

- `namespace` (optional): filter by namespace

__Returns:__

```json
[
  {
    "app": "grafana",
    "namespace": "monitoring",
    "url": "https://grafana.nerdsbythehour.com",
    "paths": ["/"]
  }
]
```

`app` is the Ingress name. The URL is `https` when that host appears in the Ingress TLS list, otherwise `http`.

---

## Authentik (read)

These Authentik tools (read and write) load `AUTHENTIK_BASE_URL` and `AUTHENTIK_TOKEN` by decrypting `.env.secret.mcp-authentik.encrypted` from the hardcoded path `~/Documents/mj-infra-flux`. They do not read those variables from the environment. See the [README secrets section](README.md#secrets).

### authentik_get_info

Authentik deployment info and URLs. No Authentik API token is used; this is a Kubernetes read.

__Parameters:__ none

__Returns:__ JSON with namespace `authentik`, pods matching `app.kubernetes.io/name=authentik`, `apiUrl` (`https://<host>/api/v3/`) and `adminUrl` (`https://<host>/if/admin/`) from the Ingress named `authentik`, or `"Not found"`.

---

### authentik_list_applications

List Authentik applications (`GET /api/v3/core/applications/`).

__Parameters:__ none

__Returns:__ the API `results` list (id, name, slug, provider, and so on).

---

### authentik_list_providers

List Authentik providers (`GET /api/v3/providers/all/`).

__Parameters:__ none

__Returns:__ the API `results` list (including numeric `pk`).

---

### authentik_list_outposts

List Authentik outposts (`GET /api/v3/outposts/instances/`).

__Parameters:__ none

__Returns:__ the API `results` list.

---

## Authentik (write)

These change Authentik. Verify the slug or `pk` with the list tools before delete or retire.

### authentik_create_homeassistant_app

__Changes things.__ Creates the Home Assistant proxy provider and application. Inputs are hardcoded; there are no parameters.

What it creates:

1. A proxy provider named `Home Assistant Provider`:
   - external host: `https://ha.nerdsbythehour.com`
   - internal host: `https://192.168.68.20:8123`
   - forward-auth at domain level
   - TLS validation to HA disabled (self-signed certificate)
2. An application named `Home Assistant`, slug `homeassistant`, linked to that provider

It does not bind the provider to an outpost. Call __authentik_bind_provider_to_outpost__ next if ForwardAuth should go live.

__Parameters:__ none (`{}`)

__Returns:__ the created provider and application, plus admin URLs for both.

---

### authentik_bind_provider_to_outpost

__Changes things.__ Binds a provider to an outpost (needed for ForwardAuth). If the provider is already on the outpost, this is a no-op.

__Parameters:__

- `providerId` (required): numeric provider id
- `outpostId` (optional): outpost id. If omitted, uses the embedded outpost (name contains `embedded`, or `managed` is `goauthentik.io/outposts/embedded`)

__Example:__

```json
{"providerId": 123}
```

---

### authentik_retire_application

__Changes things, irreversible.__ Retire a service from SSO end to end: look up the application by slug, delete the application first (drops policy bindings), then delete its bound provider if there is one.

__Parameters:__

- `slug` (required): application slug (for example `jimswiki`)

__Example:__

```json
{"slug": "jimswiki"}
```

__Returns:__ a short text summary of what was deleted or already gone. If the application had no provider (or was already gone before lookup), no provider delete is attempted. The Authentik embedded-outpost Ingress may take about 30 seconds to drop the host; if it does not, the note in the tool output says to restart `authentik-worker`.

---

### authentik_delete_application

__Changes things, irreversible.__ Delete one application by slug (`DELETE /api/v3/core/applications/{slug}/`). Prefer __authentik_retire_application__ if the provider should go too.

__Parameters:__

- `slug` (required): application slug

__Returns:__ deleted, or already gone (HTTP 404).

---

### authentik_delete_provider

__Changes things, irreversible.__ Delete one provider by primary key (`DELETE /api/v3/providers/all/{pk}/`). Deleting a provider that is still bound to a live application can break ForwardAuth.

__Parameters:__

- `pk` (required): numeric provider primary key

__Returns:__ deleted, or already gone (HTTP 404).

---

## Stocks

### stocks_get_price

Latest quote from Alpha Vantage `GLOBAL_QUOTE`.

__Parameters:__

- `symbol` (required): ticker, for example `AAPL`. It is trimmed and uppercased.

__Example:__

```json
{"symbol": "AAPL"}
```

__Returns:__ the `Global Quote` object (price, open, high, low, volume, change, and so on), or the raw JSON if that field is missing.

__Needs:__ environment variable `ALPHA_VANTAGE_KEY`. If it is unset, the tool returns an error. The in-cluster Deployment does not set this variable.

Alpha Vantage free-tier rate limits apply (commonly 5 requests per minute and 500 per day; confirm against their current docs).

---

## See also

- [README.md](README.md) — deployment, secrets, and setup scripts
- [SETUP.md](SETUP.md) — local stdio wiring
