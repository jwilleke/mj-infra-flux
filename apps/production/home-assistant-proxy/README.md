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

## Operations summary

*Moved from homelab `network/apps/home-assistant.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Covers Home Assistant itself (a Raspberry Pi) and the `home-assistant-proxy`
app on deby that publishes it at `ha.nerdsbythehour.com`.

### What it is and does

Home Assistant runs the house: lights, sensors, alarms (Alarmo), Zigbee,
Z-Wave, Matter/Thread, ESPHome devices, Tesla and phone presence. Its config is
kept in git (`jwilleke/mjs-ha`). deby only forwards HTTPS traffic to it.

### Access

| Item | Value |
| --- | --- |
| URL | <https://ha.nerdsbythehour.com> (Traefik on deby → `192.168.68.20:8123`) |
| Direct | Host: `192.168.68.20`, Port: `8123` (HTTP) |
| Reach | LAN (DNS points at deby). No Cloudflare Tunnel route. The Duck DNS app is running; how it is used is Unknown — to fill in |
| Sign-in | HA users, plus Authentik OIDC (`auth_oidc` custom component, provider `ha` in Authentik) |
| Shell | `ssh root@192.168.68.20` (Terminal & SSH app), `ha` CLI |

### Where it runs / where data lives

| Item | Value |
| --- | --- |
| Hardware | Raspberry Pi 4 (`rpi4-64`), host name `ha`, wired `end0`, 228 GB disk |
| OS | Home Assistant OS 18.4, Core 2026.10.4 (as of 2026-11-03) |
| Config | `/config` on the Pi; git copy in `/Volumes/hd2A/workspaces/github/mjs-ha` (`.storage/` is not in git) |
| Apps (add-ons) | File editor, Terminal & SSH, Samba share, Node-RED, Mosquitto broker, Zigbee2MQTT, Z-Wave JS, Duck DNS, ESPHome Device Builder, Matter Server, OpenThread Border Router, Syslog |
| Backups | Daily "Automatic backup" to the Pi and to NAS mount `nas_backups` (CIFS `192.168.68.41`, share `jims/data/archive/ha-backups`). Last seen 2026-11-03. That share is mirrored again to deby's `nas-backup` disk. |
| Proxy on deby | namespace `home-assistant-proxy`, Service + Endpoints `192.168.68.20:8123`, Ingress `home-assistant` |

### Secrets

| Secret | Where |
| --- | --- |
| OIDC client id and secret | HA `/config/secrets.yaml` keys `authentik_client_id`, `authentik_client_secret` |
| Other HA secrets | HA `/config/secrets.yaml` (not in git) |
| HA token for Prometheus | Secret `monitoring/homeassistant-api-token`, key `token` (made by hand) |
| NAS backup login | Stored in HA's mount config (`nas_backups`). Unknown — to fill in which NAS user |

### Dependencies

- Traefik, cert-manager, Authentik (for SSO and the public name)
- HA trusts `X-Forwarded-For` from `10.42.0.0/16`, `10.43.0.0/16`, `192.168.68.71` (set in `.storage/http`, recorded in `configuration.yaml` comments)
- Its own Mosquitto app bridges `teslamate/#` and `owntracks/#` from the cluster broker `mqtt.nerdsbythehour.com:1883` ([messaging](../messaging/README.md))
- Tank NAS for off-Pi backups

### Recovery

(a) Broken. HA core stuck:

```bash
ssh root@192.168.68.20 'ha core check && ha core restart'
ssh root@192.168.68.20 'ha core logs | tail -50'
```

Proxy pod broken on deby:

```bash
kubectl -n home-assistant-proxy get endpoints,ingress
flux reconcile kustomization apps --with-source
```

(b) Data lost (SD card or SSD dies): flash HAOS on a new disk, then in the
onboarding screen choose "Restore from backup" and use the newest file from the
NAS share `jims/data/archive/ha-backups` (or `/nas-backup/tank_nas-to-deby/jims/data/archive/ha-backups` on deby).

(c) deby rebuilt: HA keeps working on the LAN at `192.168.68.20:8123`. The
proxy comes back with Flux. If HA returns 400 "untrusted proxy", check the
trusted proxies above.

### Health checks

```bash
curl -sI https://ha.nerdsbythehour.com/ | head -1
ssh root@192.168.68.20 'ha core info | grep -E "^version|update_available"'
ssh root@192.168.68.20 'ha backups list | grep -c "Automatic backup"'
```

### Known gaps

- The proxy has no Authentik forward-auth (HA does its own login).
- `apps/production/home-assistant-proxy/certificate.yaml` is not listed in its kustomization, and a ServersTransport file there looks unused.
- Two MQTT brokers (cluster and HA) joined by a bridge. If the cluster broker is down, Tesla and phone locations stop reaching HA.
- HA's backup encryption key location is Unknown — to fill in.

## For users: Home Assistant — ha.nerdsbythehour.com

*Moved from homelab `docs/services-provided/home-assistant.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Smart home automation platform. Home Assistant itself runs on a dedicated host at `192.168.68.20`; the k3s cluster provides a Traefik + Authentik front-end proxy so it is reachable by name with SSO.

### How to reach it

__URL:__ <https://ha.nerdsbythehour.com>

LAN only. Public DNS (checked 2026-11-23 with `dig @1.1.1.1`) points this name at deby, `192.168.68.71`, so it is not reachable from the internet. (The older homelab page said it was public via Cloudflare.)

### Authentication

Authentik ForwardAuth is enabled. You will be redirected to `auth.nerdsbythehour.com` to log in. After Authentik authentication your request is forwarded to Home Assistant, which still requires its own HA user account.

Home Assistant is configured to trust proxy headers from the k3s pod network (`10.42.0.0/16`, `10.43.0.0/16`, `192.168.68.71`).

### What Home Assistant integrates with

| Integration | Data flow |
|---|---|
| TeslaMate | Subscribes to `teslamate/#` on the MQTT broker |
| OwnTracks | Subscribes to `owntracks/#` on the MQTT broker |
| MQTT broker | `deby.nerdsbythehour.com:1883` (plain TCP, anonymous) |

### Operator reference

[`mj-infra-flux/apps/production/home-assistant-proxy/README.md`](README.md)
