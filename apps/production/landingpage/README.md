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

1. __Build the Docker image__ (from `/opt/traefik/landingpage`):

   ```bash
   cd /opt/traefik/landingpage
   docker build -t landingpage:latest .
   ```

2. __Export the image for k3s__:

   ```bash
   docker save landingpage:latest -o /tmp/landingpage.tar
   ```

3. __Import into k3s__:

   ```bash
   sudo k3s ctr images import /tmp/landingpage.tar
   ```

4. __Apply with Flux__ (or kubectl):

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

- __Public routes__ (`ingress-public.yaml`):
  - `nerdsbythehour.com/` → Landing page
  - `nerdsbythehour.com/guest` → Guest page
  - `www.nerdsbythehour.com/` → Landing page

- __Redirect routes__ (`ingress-members.yaml`):
  - `nerdsbythehour.com/members` → Redirects to Authentik User Library

### Members Page Redirect

The `/members` route uses a Traefik middleware to redirect users directly to the Authentik User Library at `https://auth.nerdsbythehour.com/if/user/#/library`. This eliminates the need for a separate Members page since Authentik already provides a user portal showing all authorized applications.

__Implementation__:

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

### Key Files

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

## Operations summary

*Moved from homelab `network/apps/landingpage.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

The home page for `nerdsbythehour.com`, a small React (Vite) site. It also has a
guest page, and `/members` sends you to the Authentik app library.

### Access

| Item | Value |
| --- | --- |
| URLs | <https://nerdsbythehour.com>, <https://www.nerdsbythehour.com>, `/guest`, `/members` |
| Reach | Public: `nerdsbythehour.com` resolves to Cloudflare in public DNS (checked 2026-11-23) |
| Sign-in | None; `/members` hands off to Authentik |

### Where it runs / where data lives

deby, namespace `landingpage`, image `landingpage:latest` built on deby from
`/opt/traefik/landingpage` and imported into k3s. No data.

### Secrets

None.

### Dependencies

Traefik, cert-manager, Authentik (for `/members`).

### Recovery

(a) Pod broken:

```bash
kubectl -n landingpage rollout restart deploy/landingpage
```

(b) Data lost: nothing to lose.

(c) deby rebuilt: rebuild the image before Flux can start it:

```bash
cd /opt/traefik/landingpage && docker build -t landingpage:latest .
docker save landingpage:latest -o /tmp/landingpage.tar && sudo k3s ctr images import /tmp/landingpage.tar
kubectl -n landingpage rollout restart deploy/landingpage
```

### Health checks

```bash
curl -o /dev/null -w "%{http_code}\n" https://nerdsbythehour.com/
curl -sI https://nerdsbythehour.com/members | grep -i location
```

### Known gaps

- Source lives on deby in `/opt/traefik/landingpage`, outside the Flux repo. Whether it is in its own git repo is Unknown — to fill in. It is covered by the deby rootfs backup.

## For users: Landing Page & Guest Services — nerdsbythehour.com

*Moved from homelab `docs/services-provided/landingpage.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

The main public landing page plus two unauthenticated guest services: a speed test and a request-info tool.

### Landing page

__URL:__ <https://nerdsbythehour.com> (also <https://www.nerdsbythehour.com>)

Public, no authentication. The page links to:

- `/guest` — Guest services page (speed test, whoami)
- `/members` — Redirects to the Authentik user library at `auth.nerdsbythehour.com/if/user/#/library`, where authenticated members see all apps they have access to.

### Speed test

__URL:__ <https://nerdsbythehour.com/speed>

Self-hosted HTML5 speed test (OpenSpeedTest). Tests download and upload to/from `deby` — useful for measuring LAN throughput or Cloudflare-proxied WAN speed. No authentication, no account needed.

### Whoami (request info)

__URL:__ <https://deby.nerdsbythehour.com>

Shows request headers, IP address, and connection details. Useful for verifying what IP a client appears to have, or confirming Traefik is handling TLS termination correctly. No authentication.

### Operator reference

[`mj-infra-flux/apps/production/landingpage/README.md`](README.md)
