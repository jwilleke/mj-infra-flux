# Authentik SSO Setup Guide

## Current Status

✅ **Completed:**
- Authentik deployed via Flux at https://auth.nerdsbythehour.com
- PostgreSQL and Redis persistence configured
- Let's Encrypt certificate issued
- Traefik ForwardAuth middleware created
- Filebrowser application deployed at https://filebrowser.nerdsbythehour.com
- DNS records configured for auth and filebrowser subdomains

🔧 **Pending Configuration:**
- Complete OAuth2/Proxy Provider setup in Authentik UI (steps below)
- Test authentication flow

## Initial Setup

1. Access Authentik at: https://auth.nerdsbythehour.com/if/flow/initial-setup/
2. Set password for the default `akadmin` user
3. Login with `akadmin` credentials

## Configure OAuth2/Proxy Provider for Traefik ForwardAuth

**To access the Admin Interface:**
- Click on your username in the top right corner
- Select **Admin Interface** from the dropdown
- OR directly access: https://auth.nerdsbythehour.com/if/admin/

### Step 1: Create Provider

1. In the Admin Interface, go to **Applications** → **Providers**
2. Click **Create** → Select **Proxy Provider**
3. Configure:
   - **Name**: `Filebrowser Forward Auth`
   - **Authorization flow**: `default-provider-authorization-implicit-consent`
   - **Type**: `Forward auth (single application)` or `Proxy` (depending on your version)
   - **External host**: `https://filebrowser.nerdsbythehour.com` ⚠️ **IMPORTANT: Use the protected app domain, NOT auth.nerdsbythehour.com**
   - **Internal host**: Leave empty or use `http://smb-filebrowser.default.svc.cluster.local`
   - **Token validity**: `hours=24` (or your preference)
4. Click **Finish**
5. **IMPORTANT**: Client ID and Client Secret may be displayed
   - **DO NOT commit these to the repository**
   - **DO NOT share these credentials**
   - Store them securely if needed for other integrations
   - For Traefik ForwardAuth, these are NOT required in the middleware configuration

### Step 2: Create Application

1. Go to **Applications** → **Applications**
2. Click **Create**
3. Configure:
   - **Name**: `Filebrowser`
   - **Slug**: `filebrowser`
   - **Provider**: Select the provider created in Step 1 (`Filebrowser Forward Auth`)
4. Click **Create**

### Step 3: Create Outpost

1. Go to **Admin Interface** → **Outposts**
2. Click **Create** (or edit the existing `authentik Embedded Outpost`)
3. Configure:
   - **Name**: `authentik Embedded Outpost` (or create new)
   - **Type**: `Proxy`
   - **Applications**: Select `Filebrowser`
4. Click **Create** or **Update**
5. ⚠️ **IMPORTANT**: After creating, check if an ingress was auto-created for filebrowser.nerdsbythehour.com
   - If an ingress `ak-outpost-*` appears for filebrowser, **DELETE IT** - we already have our own ingress configured

## Traefik ForwardAuth Middleware

The ForwardAuth middleware has been created in the cluster. To protect a service:

1. Add the middleware annotation to your Ingress:
   ```yaml
   annotations:
     traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd
   ```

## Protected Services

Currently protected (requires authentication once OAuth2 provider is configured):
- **Filebrowser**: https://filebrowser.nerdsbythehour.com
  - Default credentials: admin/admin (change after first login)
  - Deployment, Service, and Ingress managed by Flux
  - ForwardAuth middleware applied

Unprotected (accessible without login):
- **Whoami**: https://nerdsbythehour.com and https://deby.nerdsbythehour.com

## Important URLs

- **Authentik Setup**: https://auth.nerdsbythehour.com/if/flow/initial-setup/
- **Authentik Admin Portal**: https://auth.nerdsbythehour.com/if/admin/
- **Filebrowser**: https://filebrowser.nerdsbythehour.com

## Default Credentials

- **Authentik Admin**: `akadmin` (set password on first login)
- **Filebrowser**: `admin` / `9Dix_hIlqUA1mnSX` (randomly generated - change after first login)

## DNS Configuration

All DNS records are configured in Cloudflare with Proxy enabled (orange cloud):
- auth.nerdsbythehour.com → Cloudflare Proxy → 174.105.183.192 → 192.168.68.71
- filebrowser.nerdsbythehour.com → Cloudflare Proxy → 174.105.183.192 → 192.168.68.71

## Troubleshooting

### "Not Found" Error from Authentik

If you see an Authentik-branded "Not Found" page when accessing a protected service:
- ✅ **Good**: ForwardAuth middleware is working and intercepting requests
- ❌ **Issue**: OAuth2/Proxy Provider configuration is incomplete or missing

**Solution**: Complete the provider, application, and outpost setup in the Admin Interface.

### Version-Specific UI Differences

You're running Authentik **2025.10.1**. The UI and options may differ from older guides:
- Look for "Proxy" or "Forward auth" when creating providers
- Some versions have "Forward auth (single application)" vs "Forward auth (domain level)"
- Use "Forward auth (single application)" if available
