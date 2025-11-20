# amdWiki

A simple, file-based wiki application built with Node.js, Express, and Markdown which mimics JSPWiki.

## Overview

- **Application**: amdWiki (Markdown Wiki)
- **URL**: https://nerdsbythehour.com/amdwiki
- **Namespace**: amdwiki
- **Authentication**: Authentik SSO (ForwardAuth)
- **Source**: https://github.com/jwilleke/amdWiki

## Features

- Create, view, and edit wiki pages in Markdown
- Advanced search with multi-criteria filtering
- JSPWiki-style link syntax
- Category and keyword-based organization
- Red link detection for non-existent pages
- Professional UI with Bootstrap styling
- Inline image support with upload functionality
- Page version history with diff comparison

## Data Paths

All data is stored on NFS at `/home/jim/docs/data/systems/mj-infra-flux/amdwiki/`:

- `pages/` - Wiki pages (Markdown files)
- `required-pages/` - Required system pages
- `data/` - Attachments, versions, users
- `logs/` - Application logs

## Configuration

The application uses built-in configuration from the Docker image. Configuration priority:
1. `config/app-default-config.json` (base defaults)
2. `config/app-production-config.json` (production overrides)

Key settings for production:
- Server binds to `0.0.0.0:3000`
- Secure cookies enabled
- Caching enabled (1 hour TTL)
- Enhanced security settings

## Deployment

```bash
# Apply manifests
kubectl apply -k apps/production/amdwiki/

# Check status
kubectl get pods -n amdwiki
kubectl logs -n amdwiki -l app=amdwiki

# Access logs
kubectl logs -n amdwiki -l app=amdwiki -f
```

## Docker Image

Built from source:
```bash
cd /tmp/amdwiki
docker build -f docker/Dockerfile -t amdwiki:latest .
docker save amdwiki:latest | sudo k3s ctr images import -
```

Image: `amdwiki:latest` (local, not in registry)

## Security

- **Authentication**: Protected by Authentik ForwardAuth middleware
- **Authorization**: Managed by Authentik policies
- **Access**: Members only (not on guest page)
- **SSL**: Let's Encrypt certificate

## Troubleshooting

### Pod not starting
```bash
kubectl logs -n amdwiki -l app=amdwiki
kubectl describe pod -n amdwiki -l app=amdwiki
```

### Permission issues
Data directories owned by UID/GID 3003 (apps:apps)

### Rebuild image
```bash
cd /tmp/amdwiki
git pull
docker build -f docker/Dockerfile -t amdwiki:latest .
docker save amdwiki:latest | sudo k3s ctr images import -
kubectl rollout restart deployment/amdwiki -n amdwiki
```

## Architecture

```
User → Traefik Ingress
        ↓
    Authentik ForwardAuth (SSO)
        ↓
    amdwiki Service (ClusterIP)
        ↓
    amdwiki Pod (Node.js/Express)
        ↓
    Persistent Data (NFS HostPath)
```

## Related

- Source code: https://github.com/jwilleke/amdWiki
- Similar to jimswiki but uses Markdown instead of JSPWiki format
