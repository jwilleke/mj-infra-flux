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

**Current Status:** Authentik ForwardAuth is commented out

**To Enable:**

1. Configure Authentik application for Home Assistant
2. Create ForwardAuth middleware (if not already exists)
3. Uncomment annotation in `ingress.yaml`:
   ```yaml
   traefik.ingress.kubernetes.io/router.middlewares: authentik-forwardauth-homeassistant@kubernetescrd
   ```
4. Apply: `kubectl apply -k apps/production/home-assistant-proxy/`

**Important:** Home Assistant has its own authentication. You can choose:
- Use Authentik as first layer (SSO)
- Disable Authentik and use HA's native auth
- Use both (SSO + HA auth)

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
