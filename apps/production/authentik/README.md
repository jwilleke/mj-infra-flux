# Authentik SSO Setup Guide

## Current Status

✅ __Completed:__

- Authentik deployed via Flux at <https://auth.nerdsbythehour.com>
- PostgreSQL and Redis persistence configured
- Let's Encrypt certificate issued
- Traefik ForwardAuth middleware created
- DNS records configured for the `auth` subdomain

> __Note:__ This guide was originally written using Filebrowser as the worked example for an Authentik-protected application. That deployment was removed on 2026-05-05 (the SMB stack it served was orphaned — see the related cleanup commit). The Step 1 / Step 2 / Step 3 instructions below still reference Filebrowser by name; treat them as historical reference for the shape of the setup, and substitute your own application's name and URLs when adapting.

🔧 __Pending Configuration:__

- Complete OAuth2/Proxy Provider setup in Authentik UI (steps below)
- Test authentication flow

## Initial Setup

1. Access Authentik at: <https://auth.nerdsbythehour.com/if/flow/initial-setup/>
2. Set password for the default `akadmin` user
3. Login with `akadmin` credentials

## Configure OAuth2/Proxy Provider for Traefik ForwardAuth

__To access the Admin Interface:__

- Click on your username in the top right corner
- Select __Admin Interface__ from the dropdown
- OR directly access: <https://auth.nerdsbythehour.com/if/admin/>

### Step 1: Create Provider

1. In the Admin Interface, go to __Applications__ → __Providers__
2. Click __Create__ → Select __Proxy Provider__
3. Configure:
   - __Name__: `Filebrowser Forward Auth`
   - __Authorization flow__: `default-provider-authorization-implicit-consent`
   - __Type__: `Forward auth (single application)` or `Proxy` (depending on your version)
   - __External host__: `https://filebrowser.nerdsbythehour.com` ⚠️ __IMPORTANT: Use the protected app domain, NOT auth.nerdsbythehour.com__
   - __Internal host__: Leave empty or use `http://smb-filebrowser.default.svc.cluster.local`
   - __Token validity__: `hours=24` (or your preference)
4. Click __Finish__
5. __IMPORTANT__: Client ID and Client Secret may be displayed
   - __DO NOT commit these to the repository__
   - __DO NOT share these credentials__
   - Store them securely if needed for other integrations
   - For Traefik ForwardAuth, these are NOT required in the middleware configuration

### Step 2: Create Application

1. Go to __Applications__ → __Applications__
2. Click __Create__
3. Configure:
   - __Name__: `Filebrowser`
   - __Slug__: `filebrowser`
   - __Provider__: Select the provider created in Step 1 (`Filebrowser Forward Auth`)
4. Click __Create__

### Step 3: Create Outpost

1. Go to __Admin Interface__ → __Outposts__
2. Click __Create__ (or edit the existing `authentik Embedded Outpost`)
3. Configure:
   - __Name__: `authentik Embedded Outpost` (or create new)
   - __Type__: `Proxy`
   - __Applications__: Select `Filebrowser`
4. Click __Create__ or __Update__
5. ⚠️ __IMPORTANT__: After creating, check if an ingress was auto-created for filebrowser.nerdsbythehour.com
   - If an ingress `ak-outpost-*` appears for filebrowser, __DELETE IT__ - we already have our own ingress configured

## Traefik ForwardAuth Middleware

The ForwardAuth middleware has been created in the cluster. To protect a service:

1. Add the middleware annotation to your Ingress:

   ```yaml
   annotations:
     traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd
   ```

## Protected Services

Other services in the cluster apply the Authentik ForwardAuth middleware directly via their ingress annotation (`traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd`); see the example in `apps/production/jimsmcp/ingress.yaml`. The original Filebrowser worked-example deployment was removed on 2026-05-05.

Unprotected (accessible without login):

- __Whoami__: <https://nerdsbythehour.com> and <https://deby.nerdsbythehour.com>

## Important URLs

- __Authentik Setup__: <https://auth.nerdsbythehour.com/if/flow/initial-setup/>
- __Authentik Admin Portal__: <https://auth.nerdsbythehour.com/if/admin/>

## Default Credentials

- __Authentik Admin__: `akadmin` (set password on first login)

## DNS Configuration

All DNS records are configured in Cloudflare with Proxy enabled (orange cloud):

- auth.nerdsbythehour.com → Cloudflare Proxy → 174.105.183.192 → 192.168.68.71

## Troubleshooting

### "Not Found" Error from Authentik

If you see an Authentik-branded "Not Found" page when accessing a protected service:

- ✅ __Good__: ForwardAuth middleware is working and intercepting requests
- ❌ __Issue__: OAuth2/Proxy Provider configuration is incomplete or missing

__Solution__: Complete the provider, application, and outpost setup in the Admin Interface.

### Version-Specific UI Differences

You're running Authentik __2025.10.1__. The UI and options may differ from older guides:

- Look for "Proxy" or "Forward auth" when creating providers
- Some versions have "Forward auth (single application)" vs "Forward auth (domain level)"
- Use "Forward auth (single application)" if available
