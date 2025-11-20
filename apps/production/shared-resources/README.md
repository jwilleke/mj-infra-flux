# Shared Resources Static File Server

## Overview

Static file server (nginx) that serves shared resources like icons, logos, and other assets via HTTP. This allows applications like Authentik to reference assets by URL instead of mounting volumes.

## URL

**Production**: https://cdn.nerdsbythehour.com

## Purpose

- Serve application icons and logos for Authentik and other apps
- Provide a CDN-like endpoint for shared static assets
- Enable URL-based asset references instead of volume mounts
- Directory browsing enabled for easy discovery

## Data Paths

**Source Data** (NFS mount, backed up):
```
/home/jim/docs/data/systems/shared-resources/
├── icons/              # General application icons
├── icons-logos/        # Application logos and branding
│   └── home-assistant-logo/
└── README.md
```

**Served via nginx at**: https://cdn.nerdsbythehour.com

## Architecture

- **Deployment**: nginx:alpine container
- **Volume**: hostPath mount to `/home/jim/docs/data/systems/shared-resources`
- **Features**:
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

- **Traefik**: Ingress controller
- **cert-manager**: Let's Encrypt TLS certificate
- **NFS mount**: Data persistence at `/home/jim/docs/data/systems/shared-resources`

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

- **Authentication**: None (public read-only access)
- **Container**: Runs as nginx user (101:101)
- **Filesystem**: Read-only root filesystem
- **Volume**: hostPath mounted read-only
- **Headers**: Security headers applied via nginx config

## Resource Limits

- **Requests**: 32Mi RAM, 50m CPU
- **Limits**: 128Mi RAM, 200m CPU

## DNS Configuration

Add DNS record in Cloudflare:
```
Type: A
Name: cdn
Content: 174.105.183.192 (or your external IP)
Proxy: Enabled (orange cloud)
```

This routes through Cloudflare → your firewall → 192.168.68.71 (deby) → Traefik → shared-resources service.
