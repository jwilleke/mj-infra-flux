# jimsmcp Tool Reference

Complete reference for all 14 tools provided by jimsmcp.

## Kubernetes Tools

### k8s_get_pods

Get pods in a namespace or across all namespaces.

**Parameters:**
- `namespace` (optional): Namespace to query
- `labelSelector` (optional): Label selector (e.g., 'app=grafana')

**Examples:**
```json
// All pods in monitoring namespace
{"namespace": "monitoring"}

// Pods with specific label
{"labelSelector": "app=grafana"}

// All pods in cluster
{}
```

**Returns:**
```json
[
  {
    "name": "grafana-5d7f8c9b6d-abc123",
    "namespace": "monitoring",
    "status": "Running",
    "ready": "True",
    "restarts": 0,
    "age": "2024-11-18T12:00:00Z"
  }
]
```

---

### k8s_get_pod_logs

Get logs from a specific pod.

**Parameters:**
- `namespace` (required): Namespace of the pod
- `podName` (required): Name of the pod
- `container` (optional): Container name
- `tailLines` (optional): Number of lines to tail (default: 100)

**Example:**
```json
{
  "namespace": "monitoring",
  "podName": "grafana-5d7f8c9b6d-abc123",
  "tailLines": 50
}
```

---

### k8s_get_deployments

Get deployments in a namespace or across all namespaces.

**Parameters:**
- `namespace` (optional): Namespace to query

**Returns:**
```json
[
  {
    "name": "grafana",
    "namespace": "monitoring",
    "replicas": 1,
    "ready": 1,
    "upToDate": 1,
    "available": 1
  }
]
```

---

### k8s_get_services

Get services in a namespace or across all namespaces.

**Parameters:**
- `namespace` (optional): Namespace to query

**Returns:**
```json
[
  {
    "name": "grafana-service",
    "namespace": "monitoring",
    "type": "ClusterIP",
    "clusterIP": "10.43.123.45",
    "ports": [
      {
        "name": "web-ui",
        "port": 3000,
        "targetPort": 3000
      }
    ]
  }
]
```

---

### k8s_get_ingresses

Get ingresses in a namespace or across all namespaces.

**Parameters:**
- `namespace` (optional): Namespace to query

**Returns:**
```json
[
  {
    "name": "grafana-ingress",
    "namespace": "monitoring",
    "hosts": ["grafana.nerdsbythehour.com"],
    "paths": [
      {
        "path": "/",
        "backend": "grafana-service"
      }
    ]
  }
]
```

---

## Flux GitOps Tools

### flux_get_status

Get status of all Flux resources or specific kustomizations.

**Parameters:**
- `resource` (optional): Specific resource type ('kustomization', 'helmrelease')
- `namespace` (optional): Namespace to query (default: flux-system)

**Examples:**
```json
// All Flux resources
{}

// Just kustomizations
{"resource": "kustomization"}

// Specific namespace
{"resource": "kustomization", "namespace": "flux-system"}
```

**Returns:** Text output from `flux get` command

---

### flux_reconcile

Force reconciliation of a Flux resource.

**Parameters:**
- `kind` (required): 'kustomization', 'helmrelease', or 'gitrepository'
- `name` (required): Name of the resource
- `namespace` (optional): Namespace (default: flux-system)
- `withSource` (optional): Also reconcile source (default: false)

**Example:**
```json
{
  "kind": "kustomization",
  "name": "apps",
  "withSource": true
}
```

---

## Application Management Tools

### app_health_check

Comprehensive health check for an application (pods + service + ingress).

**Parameters:**
- `app` (required): Application name
- `namespace` (required): Namespace

**Example:**
```json
{
  "app": "grafana",
  "namespace": "monitoring"
}
```

**Returns:**
```json
{
  "app": "grafana",
  "namespace": "monitoring",
  "pods": [
    {
      "name": "grafana-5d7f8c9b6d-abc123",
      "status": "Running",
      "ready": "True",
      "restarts": 0
    }
  ],
  "service": {
    "name": "grafana-service",
    "type": "ClusterIP",
    "clusterIP": "10.43.123.45"
  },
  "ingress": {
    "name": "grafana-ingress",
    "hosts": ["grafana.nerdsbythehour.com"]
  }
}
```

---

### app_get_urls

Get all URLs/ingresses for applications in the cluster.

**Parameters:**
- `namespace` (optional): Filter by namespace

**Returns:**
```json
[
  {
    "app": "grafana-ingress",
    "namespace": "monitoring",
    "url": "https://grafana.nerdsbythehour.com",
    "paths": ["/"]
  },
  {
    "app": "teslamate",
    "namespace": "teslamate",
    "url": "https://teslamate.nerdsbythehour.com",
    "paths": ["/"]
  }
]
```

---

### authentik_get_info

Get information about Authentik deployment and API endpoint.

**Parameters:** None

**Returns:**
```json
{
  "namespace": "authentik",
  "pods": [
    {
      "name": "authentik-server-xyz",
      "status": "Running",
      "ready": "True"
    }
  ],
  "apiUrl": "https://auth.nerdsbythehour.com/api/v3/",
  "adminUrl": "https://auth.nerdsbythehour.com/if/admin/"
}
```

---

## Authentik Management Tools

### authentik_create_homeassistant_app

Create a complete Authentik setup for Home Assistant (proxy provider + application).

**Parameters:** None (uses hardcoded configuration for ha.nerdsbythehour.com)

**What it does:**
1. Creates a Proxy Provider with:
   - External host: `https://ha.nerdsbythehour.com`
   - Internal host: `https://192.168.68.20:8123`
   - Forward auth mode enabled
   - SSL validation disabled (for self-signed cert)
2. Creates an Application linked to the provider
3. Returns URLs for admin configuration

**Returns:**
```json
{
  "provider": {
    "pk": 123,
    "name": "Home Assistant Provider",
    "external_host": "https://ha.nerdsbythehour.com"
  },
  "application": {
    "pk": "...",
    "slug": "homeassistant",
    "name": "Home Assistant"
  },
  "urls": {
    "app": "https://auth.nerdsbythehour.com/if/admin/#/core/applications/homeassistant",
    "provider": "https://auth.nerdsbythehour.com/if/admin/#/core/providers/123"
  }
}
```

**Example:**
```json
{}
```

---

### authentik_list_applications

List all applications configured in Authentik.

**Parameters:** None

**Returns:**
```json
[
  {
    "pk": "...",
    "name": "Home Assistant",
    "slug": "homeassistant",
    "provider": 123,
    "meta_launch_url": ""
  }
]
```

---

### authentik_list_providers

List all providers configured in Authentik.

**Parameters:** None

**Returns:**
```json
[
  {
    "pk": 123,
    "name": "Home Assistant Provider",
    "type": "proxy",
    "external_host": "https://ha.nerdsbythehour.com"
  }
]
```

---

## Financial Data Tools

### stocks_get_price

Get the latest stock quote using Alpha Vantage's GLOBAL_QUOTE function.

**Parameters:**

- `symbol` (required): Stock ticker symbol (e.g., 'AAPL', 'TSLA', 'MSFT')

**Example:**

```json
{
  "symbol": "AAPL"
}
```

**Returns:**

```json
{
  "01. symbol": "AAPL",
  "02. open": "243.45",
  "03. high": "244.89",
  "04. low": "242.50",
  "05. price": "244.12",
  "06. volume": "52834100",
  "07. latest trading day": "2024-11-29",
  "08. previous close": "242.84",
  "09. change": "1.28",
  "10. change percent": "0.53%"
}
```

**Requirements:**

- `ALPHA_VANTAGE_KEY` environment variable must be set
- See "Setup" section below for configuration

**Rate Limits:**

- Free tier: 5 requests per minute, 500 per day
- Premium tier: Higher limits available

---

## Setup

### Alpha Vantage API Key Configuration

To enable the `stocks_get_price` tool, you need to set the `ALPHA_VANTAGE_KEY` environment variable.

#### Option 1: Local Development (.env file)

1. Create a `.env.secret.stocks` file in the jimsmcp directory:

```bash
cd /home/jim/Documents/mj-infra-flux/apps/production/jimsmcp
echo "ALPHA_VANTAGE_KEY=your_api_key_here" > .env.secret.stocks
```

2. Encrypt it with SOPS:

```bash
./scripts/encrypt-env-files.sh apps/production/jimsmcp/
```

3. Load the environment before running jimsmcp:

```bash
export ALPHA_VANTAGE_KEY=$(cat .env.secret.stocks)
npm run dev
```

#### Option 2: Shell Profile (macOS/Linux)

Add to your `~/.zshrc` or `~/.bash_profile`:

```bash
export ALPHA_VANTAGE_KEY="your_api_key_here"
```

Then reload your shell:

```bash
source ~/.zshrc  # or ~/.bash_profile
```

#### Option 3: Docker/Kubernetes Deployment

If running jimsmcp as a container, use a Kubernetes Secret:

```bash
kubectl create secret generic jimsmcp-secrets \
  -n jimsmcp \
  --from-literal=ALPHA_VANTAGE_KEY="your_api_key_here"
```

Then reference in the deployment env:

```yaml
env:
  - name: ALPHA_VANTAGE_KEY
    valueFrom:
      secretKeyRef:
        name: jimsmcp-secrets
        key: ALPHA_VANTAGE_KEY
```

---

## Usage with Claude Code

After configuring jimsmcp in Claude Code, you can ask natural language questions:

- "Show me all pods in the monitoring namespace"
- "Get logs from the grafana pod"
- "Check the health of the teslamate application"
- "What are all the application URLs in my cluster?"
- "Reconcile the apps kustomization with source"
- "Give me the Authentik admin URL"
- "What's the current price of Apple stock?"
- "Get me Tesla and Microsoft stock quotes"

Claude will automatically use the appropriate jimsmcp tools to answer your questions.

---

## Tool Naming Convention

In Claude Code, tools are prefixed with `mcp__jimsmcp__`:

- `mcp__jimsmcp__k8s_get_pods`
- `mcp__jimsmcp__flux_get_status`
- `mcp__jimsmcp__app_health_check`
- etc.

This prevents naming conflicts with other MCP servers.
