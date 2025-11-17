# Landing Page Application

Main landing page for nerdsbythehour.com built with React and Vite.

## Overview

The landing page serves three main routes:
- `/` - Public landing page
- `/guest` - Guest access page with links to:
  - OpenSpeedTest at `/speed`
  - whoami at `deby.nerdsbythehour.com`
- `/members` - Protected page requiring Authentik authentication
  - Links to authenticated services (JimsWiki, TeslaMate, Grafana, Authentik User Library)

## Deployment

### Build and Deploy Process

1. **Build the Docker image** (from `/opt/traefik/landingpage`):
   ```bash
   cd /opt/traefik/landingpage
   docker build -t landingpage:latest .
   ```

2. **Export the image for k3s**:
   ```bash
   docker save landingpage:latest -o /tmp/landingpage.tar
   ```

3. **Import into k3s**:
   ```bash
   sudo k3s ctr images import /tmp/landingpage.tar
   ```

4. **Apply with Flux** (or kubectl):
   ```bash
   # Flux will automatically pick up changes from git
   # Or manually apply:
   sudo kubectl apply -k apps/production/landingpage/
   ```

### Updating the Application

When you make changes to the React source code:

1. Rebuild the Docker image with a new tag or updated content
2. Re-export and re-import to k3s
3. Restart the deployment:
   ```bash
   sudo kubectl rollout restart deployment/landingpage -n landingpage
   ```

## Configuration

### Ingress Routes

- **Public routes** (`ingress-public.yaml`):
  - `nerdsbythehour.com/` → Landing page
  - `nerdsbythehour.com/guest` → Guest page
  - `www.nerdsbythehour.com/` → Landing page

- **Protected routes** (`ingress-members.yaml`):
  - `nerdsbythehour.com/members` → Members page (requires Authentik)

### Authentik ForwardAuth

The `/members` route is protected by Authentik ForwardAuth middleware.
To enable authentication, uncomment the middleware annotation in `ingress-members.yaml`:

```yaml
traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd
```

**Prerequisites**:
- Authentik must be configured with a ForwardAuth provider
- Traefik Middleware CRD must be created in the `authentik` namespace

## Security

- Runs as UID/GID 3003:3003 (apps:apps)
- Uses read-only root filesystem where possible
- Minimal Node.js Alpine image
- Uses `serve` package for static file serving with SPA support

## Monitoring

Health checks:
- Liveness probe: HTTP GET `/` every 30s
- Readiness probe: HTTP GET `/` every 10s

## Source Code

The React application source is located at `/opt/traefik/landingpage/` on the host.

### Key Files:
- `src/App.tsx` - React Router configuration
- `src/pages/LandingPage.tsx` - Main landing page
- `src/pages/GuestPage.tsx` - Guest access page
- `src/pages/MembersPage.tsx` - Protected members page
- `Dockerfile` - Multi-stage build (Node 20 Alpine)

## Migration Status

- ✅ Kubernetes manifests created
- ✅ Source code updated (Authelia → Authentik)
- ✅ Guest page updated with whoami link
- ⏳ Docker image needs to be built and imported
- ⏳ Authentik ForwardAuth middleware needs configuration
- ⏳ SSL certificate needs to be issued by cert-manager

## Next Steps

1. Build and import the Docker image
2. Deploy to k3s
3. Verify public routes work (/, /guest)
4. Configure Authentik ForwardAuth for /members route
5. Test authentication flow
