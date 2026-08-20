# Home Assistant Proxy

Proxy for external Home Assistant instance, authenticated by Home Assistant's own OIDC login
against Authentik.

## Overview

- __URL:__ <https://ha.nerdsbythehour.com>
- __Backend:__ 192.168.68.20:8123 (external host on local network)
- __Type:__ External Service Proxy (Home Assistant runs outside k3s)
- __Security:__ Home Assistant's OIDC login, pointed at Authentik as the identity provider

## Architecture

```text
User Browser
    ↓ HTTPS
ha.nerdsbythehour.com (Traefik Ingress, Let's Encrypt cert)
    ↓ HTTPS, insecureSkipVerify (self-signed cert on the HA side)
192.168.68.20:8123 (Home Assistant, OIDC login against Authentik)
```

Home Assistant itself runs outside k3s, on a separate host. This app has no forward-auth gate in
front of it — Traefik proxies straight through, and Home Assistant's own login screen (backed by
OIDC against Authentik) is what enforces access.

An earlier iteration of this app used Traefik's Authentik ForwardAuth middleware instead
(`ingressroute.yaml` + `middleware.yaml`, referenced by the old `AUTHENTIK-SETUP.md`). Those files
were never wired into `kustomization.yaml` and were removed as dead config — see
[jwilleke/mj-infra-flux#176](https://github.com/jwilleke/mj-infra-flux/issues/176). If ForwardAuth
is wanted again later (e.g. for defense in depth, or to gate access before it reaches HA's own
login), follow the pattern in `apps/production/jimsmcp/ingress.yaml`: add the annotation
`traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd`
to `ingress.yaml` rather than reviving the `IngressRoute` — confirm first whether double-auth
(Authentik, then HA's own OIDC) is acceptable.

## Components

### External Service (`external-service.yaml`)

A `Service`/`Endpoints` pair with no selector, pointing directly at the external host:

```yaml
Service:   home-assistant-external, port 8123
Endpoints: 192.168.68.20:8123
```

### ServersTransport (`serverstransport.yaml`)

`insecure-skip-verify` — Home Assistant's backend cert is self-signed, so Traefik skips TLS
validation on the hop to `192.168.68.20`.

### Ingress (`ingress.yaml`)

- __Host:__ ha.nerdsbythehour.com
- __Path:__ / (all paths)
- __Backend:__ home-assistant-external:8123
- __TLS:__ Let's Encrypt certificate (`certificate.yaml`)

## Deployment

### Prerequisites

1. Home Assistant running at `192.168.68.20:8123`
2. DNS: `ha.nerdsbythehour.com` → public IP
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
kubectl get all -n home-assistant-proxy
kubectl get ingress -n home-assistant-proxy
kubectl get certificate -n home-assistant-proxy

curl -I https://ha.nerdsbythehour.com
```

## Home Assistant OIDC configuration

Home Assistant's own login is configured to use Authentik as an OIDC provider. That configuration
lives on the Home Assistant side (`configuration.yaml` / the auth provider config on
`192.168.68.20`), not in this repo.

Home Assistant should still trust Traefik as a reverse proxy for forwarded-for handling:

```yaml
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 10.42.0.0/16   # k3s pod network
    - 10.43.0.0/16   # k3s service network
    - 192.168.68.71  # k3s host (deby)
```

## Troubleshooting

### 502 Bad Gateway

Check if Home Assistant is running on the backend:

```bash
curl -I https://192.168.68.20:8123 -k
```

### Certificate Issues

```bash
kubectl describe certificate -n home-assistant-proxy
kubectl get certificaterequest -n home-assistant-proxy
```

### DNS Not Resolving

```bash
nslookup ha.nerdsbythehour.com
# Should resolve to your public IP
```

## Related Documentation

- Authentik setup: `apps/production/authentik/`
