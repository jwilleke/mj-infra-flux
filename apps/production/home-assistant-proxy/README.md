# Home Assistant Proxy

Proxy for external Home Assistant instance with Authentik authentication.

## Overview

- **URL:** https://ha.nerdsbythehour.com
- **Backend:** 192.168.68.20:8123 (external host on local network)
- **Type:** External Service Proxy (Home Assistant runs outside k3s)
- **Security:** Protected by Authentik ForwardAuth (to be enabled)

## Architecture

This is a **proxy configuration** for an external Home Assistant instance:

1. Home Assistant runs on separate host at `192.168.68.20:8123`
2. k3s Traefik ingress proxies `ha.nerdsbythehour.com` → `192.168.68.20:8123`
3. Authentik ForwardAuth protects access (optional, to be enabled)
4. Let's Encrypt certificate via cert-manager

## Components

### External Service

```yaml
type: ExternalName
externalName: ha.nerdsbythehour.com  # Resolves to 192.168.68.20
port: 8123 (HTTPS)
```

### Ingress

- **Host:** ha.nerdsbythehour.com
- **Path:** / (all paths)
- **Backend:** home-assistant-external:8123
- **TLS:** Let's Encrypt certificate
- **Authentication:** Authentik (commented out, ready to enable)

## Deployment

### Prerequisites

1. Home Assistant running at `192.168.68.20:8123`
2. DNS: `ha.nerdsbythehour.com` → Your public IP
3. k3s Traefik ingress controller
4. cert-manager for Let's Encrypt

### Apply

```bash
# Apply with kubectl
kubectl apply -k apps/production/home-assistant-proxy/

# Or let Flux reconcile
flux reconcile kustomization flux-system --with-source
```

### Verify

```bash
# Check resources
kubectl get all -n home-assistant-proxy
kubectl get ingress -n home-assistant-proxy
kubectl get certificate -n home-assistant-proxy

# Test access
curl -I https://ha.nerdsbythehour.com
```

## Authentik Integration

**Current Status:** Authentik ForwardAuth is ENABLED

### Architecture

This setup uses Authentik as a forward authentication proxy:
1. User requests https://ha.nerdsbythehour.com
2. Traefik forwards authentication to Authentik
3. If authenticated, Authentik passes request to Home Assistant with user headers
4. Home Assistant trusts the headers from Authentik

### Configuration Steps

#### 1. Configure Authentik Application

Create a Proxy Provider application in Authentik:

1. Log into Authentik at https://auth.nerdsbythehour.com
2. Navigate to **Applications > Applications**
3. Click **Create with Provider**
4. Select **Proxy** as provider type
5. Configure:
   - **Name:** Home Assistant
   - **External host:** `https://ha.nerdsbythehour.com`
   - **Internal host:** `http://home-assistant-external.home-assistant-proxy.svc.cluster.local:8123`
   - **Authorization flow:** Default (implicit consent)
6. Create the application

#### 2. Configure Home Assistant

Home Assistant needs to trust the proxy headers from Authentik:

1. SSH to the Home Assistant host (192.168.68.20)
2. Edit `/homeassistant/configuration.yaml`:
   ```yaml
   http:
     use_x_forwarded_for: true
     trusted_proxies:
       - 10.42.0.0/16  # k3s pod network
       - 10.43.0.0/16  # k3s service network
       - 192.168.68.71 # k3s host (deby)
   ```
3. Restart Home Assistant

#### 3. (Optional) Install hass-auth-header Component

For automatic user matching based on Authentik username:

1. Install the `hass-auth-header` custom component
2. Configure it to use `X-authentik-username` header
3. Users will auto-login if their HA username matches Authentik username

Reference: https://integrations.goauthentik.io/miscellaneous/home-assistant/

**Important:** Home Assistant will still require its own user accounts. Authentik provides SSO layer, but users must exist in HA.

## Home Assistant Configuration

The actual Home Assistant instance runs on `192.168.68.20` (separate host).

**Configuration location:** `apps/production/home-assistant/config-home-assistant/`

This directory contains the Home Assistant configuration files that sync to the external host.

## Troubleshooting

### 502 Bad Gateway

Check if Home Assistant is running on the backend:
```bash
curl -I https://192.168.68.20:8123 -k
```

### Certificate Issues

Check cert-manager:
```bash
kubectl describe certificate -n home-assistant-proxy
kubectl get certificaterequest -n home-assistant-proxy
```

### DNS Not Resolving

Verify DNS:
```bash
nslookup ha.nerdsbythehour.com
# Should resolve to your public IP
```

### Authentik 401 Errors

Check Authentik configuration:
```bash
kubectl logs -n authentik -l app.kubernetes.io/name=authentik
```

## Related Documentation

- Home Assistant config: `apps/production/home-assistant/`
- Authentik setup: `apps/production/authentik/`
- Traefik ingress: `infrastructure/base/traefik/`
