# netalertx-proxy

Traefik + Authentik front-end for **NetAlertX**, which runs as a Docker container on the **deby host** (`192.168.68.71:20211`, `network_mode: host`) — not in the cluster. Mirrors the `home-assistant-proxy` / `prometheus` external-service + forward-auth pattern.

- **Host runbook for the NetAlertX app itself:** `~/thishost/docs/dockers/netalertx.md` (deby#22).
- **This ingress work:** deby#24.
- **Access:** internal-only. `netalertx.nerdsbythehour.com` → `192.168.68.71` (private). No UDM port-forward, so it is reachable only from the LAN / VPN — unlike `ha.nerdsbythehour.com`, which is intentionally inside **and** outside.

## Request flow

```
LAN/VPN browser → https://netalertx.nerdsbythehour.com (→ 192.168.68.71)
  → Traefik (TLS, host route)
  → authentik-forwardauth middleware → Authentik outpost (SSO login)
  → Service netalertx-external → Endpoints 192.168.68.71:20211
  → NetAlertX on deby
```

## Manifests

- `namespace.yaml` — `netalertx-proxy`
- `external-service.yaml` — selector-less `Service` + manual `Endpoints` → `192.168.68.71:20211`
- `authentik-middleware.yaml` — local copy of the `authentik-forwardauth` Middleware (same-namespace ref)
- `ingress.yaml` — host `netalertx.nerdsbythehour.com`, cert-manager DNS-01 cert, forward-auth middleware
- wired in `apps/production/kustomization.yaml`

## Remaining manual steps (not in Flux)

1. **DNS (UDM):** add `netalertx.nerdsbythehour.com` → `deby.nerdsbythehour.com` (CNAME) — same as `grafana`/`prometheus`. UDM-local keeps it off public DNS entirely (strongest inside-only); the DNS-01 cert still issues via the Cloudflare TXT challenge regardless.
2. **Authentik (https://auth.nerdsbythehour.com → admin):** Applications → **Create with Provider** → **Proxy**:
   - Name: `NetAlertX`; slug `netalertx`
   - Authorization flow: default implicit-consent
   - External host: `https://netalertx.nerdsbythehour.com`
   - **Forward auth (domain level / single application):** as used by the other apps
   - Bind the authorized users/groups
3. **Optional (strict SSO):** an nft rule on deby restricting direct `:20211` to localhost/cluster so the raw port can't bypass Authentik. Until then, the NetAlertX `SETPWD` password remains the gate on the direct port. **Firewall change requires operator sign-off.**
