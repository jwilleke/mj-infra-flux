# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Kubernetes GitOps repository using Flux to manage a k3s cluster running at 192.168.68.71 (deby). The infrastructure hosts multiple production services including TeslaMate, JimsWiki (38,004 pages), Home Assistant, Grafana, Authentik SSO, and more.

## Core Principles (MANDATORY READING)

### 1. Deployment Philosophy

**ALWAYS use Kustomize for new deployments. NEVER use Helm unless absolutely necessary.**

- Use plain Kubernetes YAML + Kustomize for all new applications
- Helm is acceptable ONLY for existing third-party charts with active maintenance
- Must justify why Kustomize won't work before considering Helm

Good Kustomize examples in this repo:
- `apps/production/jimswiki/` - Complex app with 38K+ files
- `apps/production/teslamate/` - Multi-component application
- `apps/production/database/` - Shared PostgreSQL
- `apps/production/messaging/` - Shared Mosquitto MQTT

### 2. Secret Management

**NEVER commit secrets in plaintext to git. This is non-negotiable.**

Approved methods (in priority order):

1. **SOPS + Age encryption** (PREFERRED)
   ```bash
   # Store secrets in .env files
   # Encrypt with: ./scripts/encrypt-env-files.sh <directory>
   # Only commit .env*.encrypted files to git
   ```

2. **Cluster-only Kubernetes Secrets**
   ```bash
   # Create directly in cluster (NOT in git)
   kubectl create secret generic my-secret -n namespace --from-literal=key="value"
   # Document in README how to recreate it
   ```

3. **Helm valuesFrom** (only if using Helm)

Reference: See `SECURITY-INCIDENT.md` for a real security incident caused by improper secret handling.

### 3. Documentation Requirements

Every application MUST have a README.md with:
1. Overview - What it does
2. URL - Where it's accessed
3. Data Paths - Where persistent data is stored
4. Dependencies - What other services it needs
5. Configuration - How to configure it
6. Secrets - Exact kubectl commands to manage secrets
7. Deployment - How to deploy/update
8. Troubleshooting - Common issues

See `apps/production/jimswiki/README.md` as an example.

### 4. Data Path Preservation

When migrating from Docker to Kubernetes:
- Preserve exact data paths (use hostPath if needed)
- Document ALL volume mounts clearly
- Verify data accessibility before removing Docker
- Test thoroughly with actual production data

Example: jimswiki migration preserved 38,004 pages at the exact same NFS mount path.

## Repository Structure

```
mj-infra-flux/
├── apps/
│   ├── base/           # Base configurations (traefik, cert-manager)
│   └── production/     # Production deployments (16 applications)
├── infrastructure/
│   ├── base/configs/   # Infrastructure configs (webhook receiver, sops)
│   └── prod/           # Production infrastructure
├── clusters/
│   └── production/     # Flux system components
└── scripts/            # Utility scripts
```

### Key Directories

- `apps/production/`: All production application deployments
- `apps/base/`: Shared base configurations
- `infrastructure/`: Cluster infrastructure (webhook receivers, secret management)
- `clusters/production/`: Flux GitOps configuration
- `scripts/`: Automation scripts for secrets, bootstrapping, git hooks

## Common Commands

### Kustomize Operations

```bash
# Validate Kustomize manifests
kubectl kustomize apps/production/myapp/

# Dry-run apply
kubectl apply -k apps/production/myapp/ --dry-run=client

# Apply to cluster
kubectl apply -k apps/production/myapp/

# Test full apps/production kustomization
kubectl kustomize apps/production | kubectl apply --dry-run='server' -f -
```

### Flux Operations

```bash
# Force reconciliation from source
flux reconcile kustomization flux-system --with-source

# Show all Flux objects not ready
flux get all -A --status-selector ready=false

# Watch flux events
flux events -w

# Show flux warning events
kubectl get events -n flux-system --field-selector type=Warning

# Watch kustomizations
flux get kustomizations --watch

# Suspend/resume during manual changes
flux suspend kustomization apps
# make changes...
flux resume kustomization apps

# Force reconcile apps
flux reconcile kustomization apps

# View kustomization controller logs
kubectl -n flux-system logs -f deployment/kustomize-controller
```

### Image Management

```bash
# List images flux is tracking
flux get images all --all-namespaces

# List image policies
flux get images -A policy

# List image repositories
kubectl get -A imagerepository

# View tags in a repository
kubectl get -n namespace -o=yaml imagerepository/repo-name

# Import Docker image to k3s
docker save myimage:tag | sudo k3s ctr images import -
```

### Secret Management

```bash
# Encrypt secrets with SOPS + Age
./scripts/encrypt-env-files.sh apps/production/myapp/

# Create cluster-only secret
kubectl create secret generic my-secret -n namespace \
  --from-literal=key="value"

# Create image pull secret for GHCR
./scripts/create-image-pull-secret-ghcr.sh

# Create SOPS age decryption secret (for flux)
./infrastructure/configs/create-sops-age-decryption-secret.sh
```

### Debugging

```bash
# Check pod status
kubectl get pods -n namespace

# View pod logs
kubectl logs -n namespace -l app=myapp

# Describe resource
kubectl describe pod -n namespace pod-name

# Get diagnostics
kubectl get events -n namespace

# Port forward for testing
kubectl port-forward -n namespace svc/myservice 8080:80
```

## Data Organization

### NFS Mount (Persistent, Backed Up)
```
/home/jim/docs/data/systems/mj-infra-flux/
├── grafana/            # Grafana config
├── mosquitto/          # MQTT config & data
├── postgresql/         # Database backups
├── teslamate/          # TeslaMate config
└── jimswiki/           # JSPWiki config
    └── config/         # jspwiki-custom.properties
```

### Local SSD (Fast, Ephemeral)
```
/mnt/local-k3s-data/
├── postgresql/         # PostgreSQL data (8Gi)
├── grafana/            # Grafana dashboards
├── jimswiki-work/      # JSPWiki cache (~921MB, regenerated)
└── jimswiki-logs/      # JSPWiki logs (ephemeral)
```

## Service Architecture

### Core Infrastructure
- **Traefik** (kube-system) - Ingress controller
- **cert-manager** (cert-manager) - Let's Encrypt certificates
- **Flux** (flux-system) - GitOps automation

### Shared Services
- **PostgreSQL** (database) - Shared database for multiple apps
- **Mosquitto** (messaging) - MQTT broker for IoT
- **Grafana** (monitoring) - Dashboards and monitoring
- **Authentik** (authentik) - SSO/IdP for all protected services

### Applications
See `ARCHITECTURE.md` for complete service inventory with URLs and authentication requirements.

## Namespace Strategy

- One namespace per logical application
- Shared services get dedicated namespaces:
  - `database` - Shared PostgreSQL
  - `messaging` - Shared MQTT
  - `monitoring` - Grafana/Prometheus
  - `authentik` - SSO/IdP

## Testing Before Commit

**Always validate before committing:**

1. Validate Kustomize: `kubectl kustomize apps/production/myapp/`
2. Dry-run: `kubectl apply -k apps/production/myapp/ --dry-run=client`
3. Apply to cluster: `kubectl apply -k apps/production/myapp/`
4. Verify deployment: `kubectl get pods -n namespace`
5. Check logs: `kubectl logs -n namespace -l app=myapp`
6. Test functionality: curl, browser, etc.

## Git Practices

- Work directly on `master` branch (small repo, sole maintainer)
- Use descriptive commit messages with "why" not just "what"
- End commits with Claude Code attribution
- Never commit secrets, age keys, or unencrypted .env files

## Security Model

### Authentication Flow
- Public services: No authentication (landing page, guest services)
- Protected services: Authentik ForwardAuth (jimswiki, teslamate, grafana, home assistant)

### Secrets Management
- SOPS + Age encryption for secrets in git
- Cluster-only secrets for highly sensitive data
- Never commit plaintext secrets (see SECURITY-INCIDENT.md)

## Migration Philosophy

Docker → Kubernetes migrations are done phase by phase:
- Test each service thoroughly
- Keep Docker running until k8s proven stable
- Document each phase

Current status: Phase 3 Complete (all services migrated to k3s)

## Resource Ownership

Prefer running as apps:apps (3003:3003):
```yaml
securityContext:
  runAsUser: 3003
  runAsGroup: 3003
  fsGroup: 3003
```

Exception: When image requires root (document why in README).

## Image Updates & Scanning

- Flux webhook receiver configured at `/infrastructure/base/configs/image-scanning-webhook-receiver`
- GitHub webhooks trigger automatic image repository refreshes
- ImageRepository resources define which images to track
- ImagePolicy resources define which tags to use

## Cluster Layout

Following Flux repository structure pattern:
```
├── apps/          # Application deployments
│   ├── base/      # Base configs
│   └── production/
├── infrastructure/  # Infrastructure configs
│   ├── base/
│   └── production/
└── clusters/      # Flux system
    └── production/
```

Per: https://fluxcd.io/flux/guides/repository-structure/

## Key Files

- `ARCHITECTURE.md` - Complete architecture documentation
- `DEPLOYMENT-GUIDELINES.md` - Deployment best practices
- `.claude-code-preferences.md` - Detailed preferences (READ FIRST)
- `SECURITY-INCIDENT.md` - Security lessons learned
- `docker-migration.md` - Migration strategy
- `README.md` - Usage and commands

## When in Doubt

1. Check `DEPLOYMENT-GUIDELINES.md`
2. Look for similar examples in `apps/production/`
3. Review `.claude-code-preferences.md`
4. Ask the user for clarification
5. Document decisions in README

## Important Notes

- k3s cluster runs at 192.168.68.71 (deby)
- Domain: nerdsbythehour.com
- Let's Encrypt certificates via cert-manager
- Traefik ingress controller in kube-system
- All production services in apps/production/
- Bootstrap script: `scripts/flux-bootstrap.sh`
