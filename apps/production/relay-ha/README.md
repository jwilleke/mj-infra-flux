# relay-ha

Public relay endpoint for Home Assistant at `https://relay-ha.nerdsbythehour.com`.

Currently serves exactly one file: the Tesla Fleet API third-party application
public key. Everything else returns 404 by design.

## Why this exists

Tesla will only issue vehicle commands to an application whose public key is
reachable over HTTPS at a fixed well-known path on the domain registered with
that application:

```text
https://relay-ha.nerdsbythehour.com/.well-known/appspecific/com.tesla.3p.public-key.pem
```

Tesla fetches this from their own infrastructure, so it cannot sit behind the
VPN, behind Authentik, or on any host that resolves to a private address. Every
existing `*.nerdsbythehour.com` Traefik host resolves to `192.168.68.71` and is
unreachable from the internet, which is why this needs its own tunnel route.

Tesla's developer console also requires that the domain be *"registered with a
certificate authority"*. The Cloudflare edge terminates TLS with a CA-issued
certificate, so that condition is met by the tunnel path.

## Architecture

```text
Internet → Cloudflare Edge → Tunnel → cloudflared (apps/production/cloudflared)
                                          ↓
                                relay-ha.relay-ha.svc.cluster.local:80
                                          ↓
                                    nginx (2 replicas)
                                          ↓
                       /.well-known/appspecific/com.tesla.3p.public-key.pem
```

No inbound firewall ports. `cloudflared` dials out on TCP 7844, exactly as it
already does for `geohazardwatch.com`.

## Tunnel configuration

The tunnel route is configured in the Cloudflare Zero Trust dashboard, not
here. Add a Public Hostname to the existing tunnel:

| Field | Value |
| --- | --- |
| Subdomain | `relay-ha` |
| Domain | `nerdsbythehour.com` |
| Path | leave blank |
| Type | `HTTP` |
| URL | `relay-ha.relay-ha.svc.cluster.local:80` |
| HTTP Host Header (HTTP Settings) | `relay-ha.nerdsbythehour.com` |

## The key pair

The ConfigMap holds the __public__ key. Publishing it is the entire point —
there is nothing secret in this repository.

The matching __private__ key is held on the Home Assistant side and must never
be committed. It was generated as EC prime256v1 (P-256) on 2026-08-11:

```bash
openssl ecparam -name prime256v1 -genkey -noout -out tesla-fleet-private.pem
openssl ec -in tesla-fleet-private.pem -pubout -out tesla-fleet-public.pem
```

To rotate, regenerate the pair, replace the ConfigMap contents with the new
public key, and re-pair the virtual key with the vehicle. The old key stops
working the moment the served file changes.

## Verification

From __outside__ the network — a LAN check proves nothing here, because the
whole point is public reachability:

```bash
curl -sSI https://relay-ha.nerdsbythehour.com/.well-known/appspecific/com.tesla.3p.public-key.pem
```

Expect `200`, no redirect, and no authentication challenge. Then confirm the
body matches the ConfigMap:

```bash
curl -sS https://relay-ha.nerdsbythehour.com/.well-known/appspecific/com.tesla.3p.public-key.pem
```

A `404` from the root path is correct and expected.

## Adding more to this relay later

The name is deliberately generic. If Home Assistant needs another public
endpoint, add a `location` block to the nginx ConfigMap rather than creating a
second tunnel route. Keep the default `return 404` — this host should expose
only what is explicitly listed.

## Operations summary

*Moved from homelab `network/apps/relay-ha.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

A tiny nginx site that publishes the Tesla Fleet API public key at the
well-known path Tesla checks. Tesla only sends car commands to an app whose key
is reachable there. Every other path returns 404.

### Access

| Item | Value |
| --- | --- |
| URL | <https://relay-ha.nerdsbythehour.com/.well-known/appspecific/com.tesla.3p.public-key.pem> |
| Reach | Public through Cloudflare Tunnel |
| Sign-in | None (public key only) |

### Where it runs / where data lives

deby, namespace `relay-ha`, nginx 1.29, 2 replicas. The public key is in a
ConfigMap in git. No data.

### Secrets

The matching private key is not in the cluster. Where it is kept is Unknown — to
fill in (likely with the Home Assistant Tesla setup).

### Dependencies

[cloudflared](../cloudflared/README.md) route; Home Assistant Tesla integration.

### Recovery

(a) Pod broken: `kubectl -n relay-ha rollout restart deploy/relay-ha`

(b) Data lost: nothing local; the key is in git.

(c) deby rebuilt: Flux redeploys.

### Health checks

From outside the LAN:

```bash
curl -sSI https://relay-ha.nerdsbythehour.com/.well-known/appspecific/com.tesla.3p.public-key.pem
```

### Known gaps

- Private key location unknown.
