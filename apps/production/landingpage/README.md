# Landing Page Application

Main landing page for nerdsbythehour.com built with React and Vite.

## Overview

The landing page serves three main routes:
- `/` - Public landing page
- `/guest` - Guest access page with links to:
  - OpenSpeedTest at `/speed`
  - whoami at `deby.nerdsbythehour.com`
- `/members` - Redirects to Authentik User Library
  - Automatically redirects to `https://auth.nerdsbythehour.com/if/user/#/library`
  - Users can see and access all applications they're authorized to use

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

- **Redirect routes** (`ingress-members.yaml`):
  - `nerdsbythehour.com/members` → Redirects to Authentik User Library

### Members Page Redirect

The `/members` route uses a Traefik middleware to redirect users directly to the Authentik User Library at `https://auth.nerdsbythehour.com/if/user/#/library`. This eliminates the need for a separate Members page since Authentik already provides a user portal showing all authorized applications.

**Implementation**:
- `middleware-redirect-members.yaml` - Traefik redirectRegex middleware
- Permanent (301) redirect to Authentik library
- Users authenticate at Authentik and see their application library

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
- `src/pages/MembersPage.tsx` - Members page (now bypassed by redirect)
- `Dockerfile` - Multi-stage build (Node 20 Alpine)

## Migration Status

- ✅ Kubernetes manifests created
- ✅ Source code updated (Authelia → Authentik)
- ✅ Guest page updated with whoami link
- ✅ Members page redirect configured (redirects to Authentik library)
- ⏳ Docker image needs to be built and imported
- ⏳ SSL certificate needs to be issued by cert-manager

## Next Steps

1. Build and import the Docker image (if React source changes are needed)
2. Deploy to k3s: `kubectl apply -k apps/production/landingpage/`
3. Verify public routes work (/, /guest)
4. Test /members redirect to Authentik library
5. Verify SSL certificate is issued
