# yourphr-relay

The YourPHR **SMART on FHIR OAuth store-and-poll relay** — EPIC #20, [yourphr#50](https://github.com/jwilleke/yourphr/issues/50).

A small, stateless public bouncer for the SMART authorization `code`. A provider redirects
the user's browser to `https://relay.nerdsbythehour.com/callback?code&state`; the relay stores
`{state -> code}` in memory with a ~60s TTL; the (internal/LAN) YourPHR instance polls
`/pending?state=` (gated by the `X-Yourphr-Token` shared secret) to retrieve the `code` and
completes the token exchange itself. **The relay never sees access/refresh tokens** and holds
**no provider app registration** (per-user / BYO `client_id`).

Source + design: [`yourphr/backend/cmd/relay`](https://github.com/jwilleke/yourphr/tree/main/backend/cmd/relay)
and `docs/planning/smart-on-fhir/oauth-gateway.md`.

## How it's exposed publicly — Cloudflare Tunnel (not Traefik)

This cluster has **no public inbound to Traefik**; everything at `*.nerdsbythehour.com` is
LAN-only. The only public path is the **Cloudflare Tunnel** (`apps/production/cloudflared`),
exactly like `geohazardwatch.com`. So the relay is exposed by adding a **Public Hostname** to
that tunnel — which bypasses Traefik (and therefore Authentik, which is what we want: `/callback`
must be reachable unauthenticated; `/pending` is protected by the shared secret instead).

```
Internet → Cloudflare Edge (TLS terminated here) → Tunnel → cloudflared
                                                              ↓
                                  yourphr-relay.yourphr.svc.cluster.local:8080
                                                              ↓
                                                     yourphr-relay pod
```

These manifests therefore provide only a **Deployment + Service** (plus the Secret). There is no
Ingress and no cert-manager TLS — Cloudflare terminates TLS at the edge and the tunnel reaches the
Service over plain in-cluster HTTP. The YourPHR app also polls `/pending` over that same in-cluster
Service, so nothing internal depends on the public hostname.

### Cloudflare dashboard step (manual, not in git)

The tunnel is token/dashboard-managed (`cloudflared tunnel run`, no in-git routing). In the
Cloudflare Zero Trust dashboard → the existing tunnel → **Public Hostnames**, add:

- **Subdomain:** `relay`
- **Domain:** `nerdsbythehour.com`
- **Type:** `HTTP`
- **URL:** `yourphr-relay.yourphr.svc.cluster.local:8080`

Saving this auto-creates the `relay.nerdsbythehour.com` DNS record (a proxied CNAME to the tunnel).
No DNS record needs to be created by hand, and no firewall port is opened.

> Note: `nerdsbythehour.com` must be in the same Cloudflare account as the tunnel (it is — the zone
> is already used for cert-manager DNS-01). A single tunnel can serve hostnames across zones.

## Activation checklist

This directory is staged but **not yet wired into Flux** (`- ./yourphr-relay` is commented in
`apps/production/kustomization.yaml`). To enable:

1. **Image** — `ghcr.io/jwilleke/yourphr-relay:main` exists (built by yourphr#71). ✅
2. **Secret** — create `relay-secret.sops.yaml` from `relay-secret.sops.yaml.example` (see that file
   for the `sops` command) and uncomment it in `kustomization.yaml`. See mj-infra-flux#105.
3. **Tunnel hostname** — add the Cloudflare Public Hostname above.
4. **Enable** — uncomment `- ./yourphr-relay` in `apps/production/kustomization.yaml`, commit, push.

Then `flux reconcile kustomization apps --with-source` and verify:

```bash
kubectl -n yourphr get pods -l app=yourphr-relay
curl https://relay.nerdsbythehour.com/healthz   # 200 once the tunnel hostname is live
```

## Future

For the distributed product, a brand-consistent `relay.yourphr.org` on a managed runtime
(Fly.io / Cloud Run) is reserved — trivial to move since the relay is stateless.
