# amdWiki

A simple, file-based wiki application built with Node.js, Express, and Markdown which mimics JSPWiki.

## Overview

- **Application**: amdWiki (Markdown Wiki)
- **URL**: https://nerdsbythehour.com/amdwiki
- **Namespace**: amdwiki
- **Authentication**: Authentik SSO (ForwardAuth)
- **Source**: https://github.com/jwilleke/amdWiki
  - cloned at: /home/jim/Documents/amdWiki/
- data folder use /home/jim/docs/data/systems/wikis/amdWiki-data on the host, so it's not inside the container - it's preserved automatically.    


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

All data is consolidated under `INSTANCE_DATA_FOLDER` at `/home/jim/docs/data/systems/wikis/amdWiki-data/`:

- `pages/` - Wiki pages (Markdown files)
- `attachments/` - File attachments
- `users/` - User accounts
- `sessions/` - Session data
- `versions/` - Page version history
- `logs/` - Application logs
- `config/` - Instance-level configuration files

## Configuration

Configuration loads hierarchically:
1. `/app/config/app-default-config.json` (base defaults, baked into Docker image)
2. `INSTANCE_DATA_FOLDER/config/app-production-config.json` (environment-specific)
3. `INSTANCE_DATA_FOLDER/config/app-custom-config.json` (instance overrides, optional)

**Important:** Do NOT mount `/app/config` - it's built into the Docker image. Only mount `INSTANCE_DATA_FOLDER` (`/app/data`).

Instance config files go in `data/config/`:
- `app-production-config.json` - production environment settings
- `app-custom-config.json` - optional local overrides

Example `data/config/app-production-config.json`:
```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3001
  },
  "session": {
    "secure": true,
    "sameSite": "lax"
  }
}
```

## Deployment

Managed by Flux GitOps. Changes are applied automatically when committed to the repository.

```bash
# Force reconciliation after commit
flux reconcile kustomization flux-system --with-source

# Check status
kubectl get pods -n amdwiki
flux get kustomizations | grep amdwiki

# Access logs
kubectl logs -n amdwiki -l app=amdwiki -f
```

## Docker Image

Built from source using multi-stage build (~450MB, down from 2.2GB):
```bash
cd /tmp/amdwiki
git pull origin master
docker build -f docker/Dockerfile -t amdwiki:latest .
docker save amdwiki:latest | sudo k3s ctr images import -
```

Image: `amdwiki:latest` (local, not in registry)
- Uses direct `node app.js` (no PM2)
- TypeScript compiled at build time
- Production dependencies only

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
Data directories owned by UID/GID 3003 (apps:apps). Pod uses `fsGroup: 3003` for proper file access.

### Rebuild image
```bash
cd /tmp/amdwiki
git pull origin master
docker build -f docker/Dockerfile -t amdwiki:latest .
docker save amdwiki:latest | sudo k3s ctr images import -
# Delete pod to pick up new image (Flux manages the deployment)
kubectl delete pod -n amdwiki -l app=amdwiki
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
