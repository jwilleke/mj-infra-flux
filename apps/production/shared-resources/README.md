# Shared Resources Static File Server

## Overview

Static file server (nginx) that serves shared resources like icons, logos, and other assets via HTTP. This allows applications like Authentik to reference assets by URL instead of mounting volumes.

## URL

__Production__: <https://cdn.nerdsbythehour.com>

## Purpose

- Serve application icons and logos for Authentik and other apps
- Provide a CDN-like endpoint for shared static assets
- Enable URL-based asset references instead of volume mounts
- Directory browsing enabled for easy discovery

## Data Paths

__Source Data__ (NFS mount, backed up):

```
/home/jim/docs/data/systems/shared-resources/
├── icons/              # General application icons
├── icons-logos/        # Application logos and branding
│   └── home-assistant-logo/
└── README.md
```

__Served via nginx at__: <https://cdn.nerdsbythehour.com>

## Architecture

- __Deployment__: nginx:alpine container
- __Volume__: hostPath mount to `/home/jim/docs/data/systems/shared-resources`
- __Features__:
  - Directory listing (autoindex on)
  - 30-day caching for static assets
  - Security headers (X-Content-Type-Options, X-Frame-Options)
  - Read-only filesystem for security

## Configuration

### nginx Configuration

Custom nginx config includes:

- Autoindex enabled for directory browsing
- Cache headers for static assets (30 days)
- Security headers
- Read-only serving

See `configmap.yaml` for full nginx configuration.

## Usage Examples

### For Authentik Applications

When configuring applications in Authentik Admin UI, use URLs like:

```
https://cdn.nerdsbythehour.com/icons-logos/home-assistant-logo/icon.png
```

### For Other Applications

Reference assets directly by URL:

```html
<img src="https://cdn.nerdsbythehour.com/icons/app-icon.png" />
```

## Adding New Assets

1. Add files to the NFS mount:

   ```bash
   cp my-icon.png /home/jim/docs/data/systems/shared-resources/icons/
   ```

2. Assets are immediately available at:

   ```
   https://cdn.nerdsbythehour.com/icons/my-icon.png
   ```

3. Recommended structure:
   - `icons/` - Small icons (192x192, 512x512 PNG)
   - `icons-logos/app-name/` - Full logos and branding per application

## Dependencies

- __Traefik__: Ingress controller
- __cert-manager__: Let's Encrypt TLS certificate
- __NFS mount__: Data persistence at `/home/jim/docs/data/systems/shared-resources`

## Secrets

None required - public read-only static file server.

## Deployment

Managed by Flux GitOps from:

```
apps/production/shared-resources/
```

Manual apply:

```bash
kubectl apply -k apps/production/shared-resources/
```

Force Flux reconciliation:

```bash
flux reconcile kustomization apps
```

## Troubleshooting

### Check pod status

```bash
kubectl get pods -n shared-resources
kubectl logs -n shared-resources -l app=shared-resources
```

### Verify ingress

```bash
kubectl get ingress -n shared-resources
```

### Test locally

```bash
curl https://cdn.nerdsbythehour.com/
```

### Check certificate

```bash
kubectl get certificate -n shared-resources
```

## Security

- __Authentication__: None (public read-only access)
- __Container__: Runs as nginx user (101:101)
- __Filesystem__: Read-only root filesystem
- __Volume__: hostPath mounted read-only
- __Headers__: Security headers applied via nginx config

## Resource Limits

- __Requests__: 32Mi RAM, 50m CPU
- __Limits__: 128Mi RAM, 200m CPU

## DNS Configuration

Add DNS record in Cloudflare:

```
Type: A
Name: cdn
Content: 174.105.183.192 (or your external IP)
Proxy: Enabled (orange cloud)
```

This routes through Cloudflare → your firewall → 192.168.68.71 (deby) → Traefik → shared-resources service.

## Operations summary

*Moved from homelab `network/apps/shared-resources.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

An nginx site that serves static files (images, scripts and similar) from a
folder on the NAS, so other sites can link to them.

### Access

| Item | Value |
| --- | --- |
| URL | <https://cdn.nerdsbythehour.com> |
| Reach | LAN |
| Sign-in | None |

### Where it runs / where data lives

deby, namespace `shared-resources`, Deployment `shared-resources` (nginx).
Files on NAS hostPath `/mnt/tank/jims/data/systems/shared-resources`, mirrored
nightly to `/nas-backup/tank_nas-to-deby/jims/`.

### Secrets

None.

### Dependencies

Tank NAS mount, Traefik, cert-manager.

### Recovery

(a) Pod broken: `kubectl -n shared-resources rollout restart deploy/shared-resources`

(b) Data lost: copy back from
`/nas-backup/tank_nas-to-deby/jims/data/systems/shared-resources/`.

(c) deby rebuilt: mount the NAS, Flux redeploys.

### Health checks

```bash
curl -o /dev/null -w "%{http_code}\n" https://cdn.nerdsbythehour.com/
```

### Known gaps

- If the NAS is not mounted, nginx serves an empty folder instead of failing.
