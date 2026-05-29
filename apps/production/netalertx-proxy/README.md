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

## Status

- ✅ Flux manifests applied; TLS cert `Ready`.
- ✅ **Authentik app provisioned** (2026-05-29) via `../jimsmcp/setup-netalertx.mjs` — forward_domain proxy provider **pk 12**, application slug `netalertx`, bound to the embedded outpost. Forward-auth verified: requests redirect to `auth.nerdsbythehour.com/application/o/authorize/...`.
- ⏳ **DNS pending** — see step 1 below.

## Remaining manual steps (not in Flux)

1. **DNS (UDM) — last step:** add `netalertx.nerdsbythehour.com` → `deby.nerdsbythehour.com` (CNAME) via the UniFi **Local DNS Records** UI — same place/way the `grafana`/`prometheus` CNAMEs were added. (Done via UI, not hand-edited on the UDM: local DNS affects the whole LAN and is a human-review item.) DNS-01 cert issues regardless via the Cloudflare TXT challenge.
2. **Authentik access policy (optional):** the `netalertx` app currently has no policy bindings → any authenticated Authentik user can access. Bind a user/group in Authentik to restrict.
3. **Optional (strict SSO):** an nft rule on deby restricting direct `:20211` to localhost/cluster so the raw port can't bypass Authentik. Until then, the NetAlertX `SETPWD` password remains the gate on the direct port. **Firewall change requires operator sign-off.**
