# mj-infra-flux Architecture

## Overview

Complete Kubernetes (k3s) infrastructure running on `192.168.68.71` (deby) with Flux GitOps management.

## Infrastructure

- __Kubernetes Distribution:__ k3s
- __GitOps Tool:__ Flux CD
- __Ingress Controller:__ Traefik (kube-system namespace)
- __Certificate Management:__ cert-manager (Let's Encrypt)
- __Domain:__ nerdsbythehour.com
- __Cluster IP:__ 192.168.68.71 (hostname: deby)

### Coding Standard:** DRY (Don't Repeat Yourself) principle

- If logic repeats more than twice, refactor into reusable components
- Abstract repeated logic into functions, classes, or modules
- Improves maintainability, reduces bugs, simplifies updates

### Key Technologies

- __Container Orchestration:__ Kubernetes (k3s)
- __GitOps:__ Flux CD
- __Configuration Management:__ Kustomize (preferred) / Helm (only when necessary)
- __Secret Management:__ SOPS + Age encryption
- __Ingress:__ Traefik
- __Authentication:__ Authentik SSO
- __Databases:__ PostgreSQL (shared)
- __Messaging:__ Mosquitto MQTT (shared)
- __Monitoring:__ Grafana + Prometheus

### Application Stack

- Node.js with TypeScript (for custom applications)
- React (for web frontends like landing page)
- Various Docker containers managed by Kubernetes
- Host ports should be from 9200-9220
- All files should be owned by APPS:APPS (3003:3003)

## Access Architecture

### Public Access (No Authentication)

__Landing Page:__ `https://nerdsbythehour.com`

- `/` - Main landing page
- `/guest` - Guest page with public service links
  - OpenSpeedTest (`/speed`)
  - whoami (`https://deby.nerdsbythehour.com`)

__CDN:__ `https://cdn.nerdsbythehour.com`

- Static asset server for icons, logos, and shared resources

### Authenticated Access (Authentik SSO)

__Members Portal:__ `https://nerdsbythehour.com/members` → Redirects to Authentik User Library

Protected services accessible after Authentik login at `https://auth.nerdsbythehour.com/if/user/#/library`:

- __Home Assistant__ - `https://ha.nerdsbythehour.com` (private DNS only)
- __TeslaMate__ - `https://teslamate.nerdsbythehour.com` (vehicle tracking)
- __Grafana__ - `https://grafana.nerdsbythehour.com` (dashboards)
- __Authentik__ - `https://auth.nerdsbythehour.com` (SSO/IdP, user profile)

## Service Categories

### Core Infrastructure

| Service | Namespace | Purpose | Storage |
|---------|-----------|---------|---------|
| __Traefik__ | kube-system | Ingress controller | - |
| __cert-manager__ | cert-manager | Let's Encrypt certificates | - |
| __Flux__ | flux-system | GitOps automation | - |

### Shared Services

| Service | Namespace | Purpose | Storage |
|---------|-----------|---------|---------|
| __PostgreSQL__ | database | Shared database | `/mnt/local-k3s-data/postgresql` |
| __Mosquitto__ | messaging | MQTT broker | NFS: `/home/jim/docs/data/systems/mj-infra-flux/mosquitto` |
| __Grafana__ | monitoring | Dashboards | `/mnt/local-k3s-data/grafana` |
| __Authentik__ | authentik | SSO/IdP | PostgreSQL + Redis |
| __Shared Resources__ | shared-resources | CDN for static assets | NFS: `/home/jim/docs/data/systems/shared-resources` |

### Applications

#### Quick Reference: Application URLs, Ports & Access

| Title | URL | Port | Access Group | Provider ID |
|-------|-----|------|--------------|-------------|
| __Landing Page__ | nerdsbythehour.com | 3000 | Public + Members | — |
| __OpenSpeedTest__ | /speed | 80 | Public | — |
| __whoami__ | deby.nerdsbythehour.com | 80 | Public | — |
| __CDN__ | cdn.nerdsbythehour.com | 80 | anyone | No auth needed |
| __TeslaMate__ | teslamate.nerdsbythehour.com | 4000 | mj | 9 |
| __Grafana__ | grafana.nerdsbythehour.com | 80 | mj | 10 |
| __Home Assistant__ | ha.nerdsbythehour.com | 8123 | mj | Existing |
| __Authentik__ | auth.nerdsbythehour.com | — | All | Self-service |
| __FileBrowser__ | TBD | 80 | Protected | TBD |

#### Detailed Applications Table

| Service | Namespace | Type | URL | Auth |
|---------|-----------|------|-----|------|
| __Landing Page__ | landingpage | React SPA | nerdsbythehour.com | Public + Members |
| __OpenSpeedTest__ | guest-services | Speed test | /speed | Public |
| __whoami__ | guest-services | Diagnostics | deby.nerdsbythehour.com | Public |
| __TeslaMate__ | teslamate | Vehicle tracking | teslamate.nerdsbythehour.com | To enable |
| __Home Assistant__ | home-assistant-proxy | Smart home | ha.nerdsbythehour.com | To enable |
| __FileBrowser__ | filebrowser | File manager | TBD | Protected |

## Data Organization

Following the standard: All external data under `/home/jim/docs/data/systems/mj-infra-flux/`

### NFS Mount (Persistent, Backed Up)

```
/home/jim/docs/data/systems/
├── mj-infra-flux/          # k3s application data
│   ├── grafana/            # Grafana config (if needed)
│   ├── mosquitto/          # MQTT config & data
│   ├── postgresql/         # Database backups (if needed)
│   ├── teslamate/          # TeslaMate config (if needed)
├── shared-resources/       # CDN static assets
│   ├── icons/              # Application icons
│   └── icons-logos/        # Application logos and branding
└── wikis/
```

### Local SSD (Fast, Ephemeral/Cache)

```
/mnt/local-k3s-data/
├── postgresql/             # PostgreSQL data (8Gi)
├── grafana/                # Grafana dashboards & data
```

## Authentication Flow

### Current State

```
Public Services (No Auth)
├── / (landing)
├── /guest
├── /speed
└── deby.nerdsbythehour.com

Redirect to Authentik
└── /members → https://auth.nerdsbythehour.com/if/user/#/library

Authentik Protected (ForwardAuth - TO BE ENABLED)
├── teslamate
├── grafana
└── ha.nerdsbythehour.com
```

### Authentik Integration (Pending)

Each protected service will have:

1. __Authentik Application__ - Configured in Authentik UI
2. __Authentik Provider__ - ForwardAuth provider with auth URL
3. __Traefik Middleware__ - ForwardAuth middleware CRD
4. __Ingress Annotation__ - Links ingress to middleware

## Network Architecture

### External Access (Public Internet)

```
Internet → Cloudflare DNS → Public IP → Router
  ↓
Port Forward 443 → 192.168.68.71:443 (k3s Traefik)
```

### Internal Access (Local Network Only)

```
Local Network → Private DNS → 192.168.68.71 (k3s Traefik)
  ↓
Services on local IPs:
- Home Assistant: 192.168.68.20:8123 (proxied via k3s)
```

### Service Mesh

```
k3s Traefik Ingress (192.168.68.71)
├── Public Services (no auth)
│   ├── Landing page (/)
│   ├── Guest page (/guest)
│   ├── OpenSpeedTest (/speed)
│   └── Shared Resources CDN (cdn.nerdsbythehour.com)
│
├── Redirect Services
│   └── /members → Authentik User Library
│
├── Authentik-Protected Services
│   ├── TeslaMate
│   ├── Grafana
│   └── Home Assistant (proxy to 192.168.68.20)
│
└── Backend Services
    ├── PostgreSQL (database namespace)
    ├── Mosquitto (messaging namespace)
    └── Redis (authentik namespace)
```

## DNS Configuration

### Public DNS (Cloudflare)

Points to your public IP:

- `nerdsbythehour.com` → Public IP
- `*.nerdsbythehour.com` → Public IP (includes cdn.nerdsbythehour.com)
- Port forward 443 → 192.168.68.71:443

### Private DNS (Local Network Only)

Internal services that don't need public access:

- `ha.nerdsbythehour.com` → `192.168.68.71` (local DNS only)

Configure in:

- Router DNS override, or
- Pi-hole local DNS, or
- `/etc/hosts` on client machines

## Security Model

### Public Layer

- Let's Encrypt TLS certificates
- Cloudflare DDoS protection (optional)
- Rate limiting (Traefik)

### Authentication Layer

- Authentik SSO for all protected services
- Single sign-on across all apps
- Group-based access control

### Application Layer

- Each service runs in isolated namespace
- Network policies (optional - can be added)
- RBAC for Kubernetes resources

### Secrets Management

- SOPS + Age encryption for secrets in git
- Cluster-only secrets for sensitive data
- Never commit plaintext secrets

## Migration Status

### ✅ Phase 1: Stateless Applications

- Landing page
- OpenSpeedTest
- whoami

### ✅ Phase 2: Shared Infrastructure + TeslaMate

- PostgreSQL
- Mosquitto MQTT
- Grafana
- TeslaMate (with historical data)

### ✅ Phase 4: Home Assistant Proxy

- External service proxy configured
- Ready for Authentik integration

## Next Steps

### 1. Authentik ForwardAuth Configuration

Create ForwardAuth middleware and enable on:

- [ ] Landing page `/members`
- [ ] TeslaMate
- [ ] Grafana
- [ ] Home Assistant

### 2. Home Assistant Trusted Proxies

Update HA configuration to trust k3s:

```yaml
http:
  trusted_proxies:
    - 10.42.0.0/16      # k3s pod network
    - 192.168.68.71/32  # k3s node
```

### 3. Docker Cleanup (Optional)

After verification period:

- Stop Docker containers
- Remove unused images
- Archive `/opt/traefik/` for reference

## Disaster Recovery

### Critical Data Backups

__Must backup:__

1. Config: `/home/jim/docs/data/systems/mj-infra-flux/`
2. PostgreSQL: Database dumps from `/mnt/local-k3s-data/postgresql/`
3. Kubernetes secrets: Export and store securely

__Can regenerate:__

- Logs
- Lucene indices
- Container images (rebuild from Dockerfile)

### Recovery Steps

1. Restore NFS mount
2. Restore local data from backups
3. Apply Flux repository: `flux bootstrap github --owner=jwilleke --repository=mj-infra-flux`
4. Restore secrets to cluster
5. Services should automatically deploy

## Performance Characteristics

| Service | Startup Time | Resource Usage |
|---------|--------------|----------------|
| Landing page | <5s | 100m CPU, 128Mi RAM |
| OpenSpeedTest | <5s | 100m CPU, 128Mi RAM |
| whoami | <1s | 10m CPU, 32Mi RAM |
| Shared Resources CDN | <2s | 50m CPU, 64Mi RAM |
| TeslaMate | ~10s | 250m CPU, 512Mi RAM |
| Grafana | ~15s | 200m CPU, 512Mi RAM |
| PostgreSQL | ~10s | 500m CPU, 1Gi RAM |
| Authentik | ~20s | 1000m CPU, 2Gi RAM |

## References

- Migration plan: `docker-migration.md`
- Deployment guidelines: `DEPLOYMENT-GUIDELINES.md`
- Security incident: `SECURITY-INCIDENT.md`
- Claude preferences: `.claude-code-preferences.md`
- Application READMEs: `apps/production/*/README.md`
