# Authentik SSO Setup Guide

## Initial Setup

1. Access Authentik at: https://auth.nerdsbythehour.com/if/flow/initial-setup/
2. Set password for the default `akadmin` user
3. Login with `akadmin` credentials

## Configure OAuth2/Proxy Provider for Traefik ForwardAuth

### Step 1: Create Provider

1. Go to **Admin Interface** → **Applications** → **Providers**
2. Click **Create** → Select **Proxy Provider**
3. Configure:
   - **Name**: `Traefik Forward Auth`
   - **Authorization flow**: `default-provider-authorization-implicit-consent`
   - **Type**: `Forward auth (single application)`
   - **External host**: `https://auth.nerdsbythehour.com`
   - **Token validity**: `hours=24` (or your preference)
4. Click **Finish**
5. **IMPORTANT**: Client ID and Client Secret will be displayed
   - **DO NOT commit these to the repository**
   - **DO NOT share these credentials**
   - Store them securely if needed for other integrations
   - For Traefik ForwardAuth, these are NOT required in the middleware configuration

### Step 2: Create Application

1. Go to **Applications** → **Applications**
2. Click **Create**
3. Configure:
   - **Name**: `Traefik Forward Auth`
   - **Slug**: `traefik-forward-auth`
   - **Provider**: Select the provider created in Step 1
4. Click **Create**

### Step 3: Create Outpost

1. Go to **Admin Interface** → **Outposts**
2. Click **Create**
3. Configure:
   - **Name**: `Embedded Outpost`
   - **Type**: `Proxy`
   - **Applications**: Select `Traefik Forward Auth`
4. Click **Create**

## Traefik ForwardAuth Middleware

The ForwardAuth middleware has been created in the cluster. To protect a service:

1. Add the middleware annotation to your Ingress:
   ```yaml
   annotations:
     traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd
   ```

## Protected Services

Currently protected:
- filebrowser (filebrowser.nerdsbythehour.com)

Unprotected (accessible without login):
- whoami (nerdsbythehour.com, deby.nerdsbythehour.com)

## Credentials

- **Default Admin**: `akadmin`
- **Setup URL**: https://auth.nerdsbythehour.com/if/flow/initial-setup/
- **Admin Portal**: https://auth.nerdsbythehour.com/if/admin/
