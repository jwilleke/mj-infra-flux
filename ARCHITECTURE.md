# mj-infra-flux Architecture

## Overview

Complete Kubernetes (k3s) infrastructure running on `192.168.68.71` (deby) with Flux GitOps management.

## Access Architecture

### Public Access (No Authentication)

**Landing Page:** `https://nerdsbythehour.com`
- `/` - Main landing page
- `/guest` - Guest page with public service links
  - OpenSpeedTest (`/speed`)
  - whoami (`https://deby.nerdsbythehour.com`)

### Authenticated Access (Authentik SSO)

**Members Portal:** `https://nerdsbythehour.com/members`

Protected services accessible after Authentik login:
- **Home Assistant** - `https://ha.nerdsbythehour.com` (private DNS only)
- **JimsWiki** - `https://nerdsbythehour.com/jimswiki` (38,004 pages)
- **TeslaMate** - `https://teslamate.nerdsbythehour.com` (vehicle tracking)
- **Grafana** - `https://grafana.nerdsbythehour.com` (dashboards)
- **Authentik** - `https://auth.nerdsbythehour.com` (SSO/IdP, user profile)

## Service Categories

### Core Infrastructure

| Service | Namespace | Purpose | Storage |
|---------|-----------|---------|---------|
| **Traefik** | kube-system | Ingress controller | - |
| **cert-manager** | cert-manager | Let's Encrypt certificates | - |
| **Flux** | flux-system | GitOps automation | - |

### Shared Services

| Service | Namespace | Purpose | Storage |
|---------|-----------|---------|---------|
| **PostgreSQL** | database | Shared database | `/mnt/local-k3s-data/postgresql` |
| **Mosquitto** | messaging | MQTT broker | NFS: `/home/jim/docs/data/systems/mj-infra-flux/mosquitto` |
| **Grafana** | monitoring | Dashboards | `/mnt/local-k3s-data/grafana` |
| **Authentik** | authentik | SSO/IdP | PostgreSQL + Redis |

### Applications

| Service | Namespace | Type | URL | Auth |
|---------|-----------|------|-----|------|
| **Landing Page** | landingpage | React SPA | nerdsbythehour.com | Public + Members |
| **OpenSpeedTest** | guest-services | Speed test | /speed | Public |
| **whoami** | guest-services | Diagnostics | deby.nerdsbythehour.com | Public |
| **TeslaMate** | teslamate | Vehicle tracking | teslamate.nerdsbythehour.com | To enable |
| **JimsWiki** | jimswiki | Wiki (38K pages) | /jimswiki | To enable |
| **Home Assistant** | home-assistant-proxy | Smart home | ha.nerdsbythehour.com | To enable |
| **FileBrowser** | filebrowser | File manager | TBD | Protected |

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
│   └── jimswiki/           # JSPWiki configuration
│       ├── config/         # ✓ jspwiki-custom.properties (EDITABLE)
│       ├── logs/           # (moved to local disk)
│       └── work/           # (moved to local disk)
└── wikis/
    └── jimswiki/           # 38,004 wiki pages (3.4GB) - CRITICAL PATH
```

### Local SSD (Fast, Ephemeral/Cache)

```
/mnt/local-k3s-data/
├── postgresql/             # PostgreSQL data (8Gi)
├── grafana/                # Grafana dashboards & data
├── jimswiki-work/          # JSPWiki cache (~921MB, regenerated)
└── jimswiki-logs/          # JSPWiki logs (ephemeral)
```

## Authentication Flow

### Current State

```
Public Services (No Auth)
├── / (landing)
├── /guest
├── /speed
└── deby.nerdsbythehour.com

Authentik Protected (ForwardAuth - TO BE ENABLED)
├── /members (landing page)
├── jimswiki
├── teslamate
├── grafana
└── ha.nerdsbythehour.com
```

### Authentik Integration (Pending)

Each protected service will have:
1. **Authentik Application** - Configured in Authentik UI
2. **Authentik Provider** - ForwardAuth provider with auth URL
3. **Traefik Middleware** - ForwardAuth middleware CRD
4. **Ingress Annotation** - Links ingress to middleware

**Example for jimswiki:**
```yaml
# In ingress
traefik.ingress.kubernetes.io/router.middlewares: authentik-forwardauth-jimswiki@kubernetescrd
```

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
│   ├── Landing page
│   ├── Guest page
│   └── OpenSpeedTest
│
├── Authentik-Protected Services
│   ├── Members page
│   ├── jimswiki (38K pages)
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
- `*.nerdsbythehour.com` → Public IP
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

### ✅ Phase 3: jimswiki
- 38,004 wiki pages migrated
- All data paths preserved

### ✅ Phase 4: Home Assistant Proxy
- External service proxy configured
- Ready for Authentik integration

## Next Steps

### 1. Authentik ForwardAuth Configuration

Create ForwardAuth middleware and enable on:
- [ ] Landing page `/members`
- [ ] jimswiki
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

**Must backup:**
1. Wiki pages: `/home/jim/docs/data/systems/wikis/jimswiki/` (38K pages)
2. Config: `/home/jim/docs/data/systems/mj-infra-flux/`
3. PostgreSQL: Database dumps from `/mnt/local-k3s-data/postgresql/`
4. Kubernetes secrets: Export and store securely

**Can regenerate:**
- Work caches (`/mnt/local-k3s-data/jimswiki-work/`)
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
| TeslaMate | ~10s | 250m CPU, 512Mi RAM |
| jimswiki | ~30s | 500m CPU, 1Gi RAM (rebuilds cache) |
| Grafana | ~15s | 200m CPU, 512Mi RAM |
| PostgreSQL | ~10s | 500m CPU, 1Gi RAM |
| Authentik | ~20s | 1000m CPU, 2Gi RAM |

## References

- Migration plan: `docker-migration.md`
- Deployment guidelines: `DEPLOYMENT-GUIDELINES.md`
- Security incident: `SECURITY-INCIDENT.md`
- Claude preferences: `.claude-code-preferences.md`
- Application READMEs: `apps/production/*/README.md`
