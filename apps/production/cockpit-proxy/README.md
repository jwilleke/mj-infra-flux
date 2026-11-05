# cockpit-proxy

Traefik + Authentik front-end for __Cockpit__ on the deby host (`192.168.68.71:9091`, HTTPS). Same pattern as `netalertx-proxy`, plus an `insecureSkipVerify` ServersTransport (like `home-assistant-proxy`) because Traefik dials Cockpit's TLS by IP.

- Direct access unchanged: deby.nerdsbythehour.com port 9091 (LE cert from `host-certs/`).
- Proxied: `https://cockpit.nerdsbythehour.com` (internal-only, → 192.168.68.71).

## Host config (deby, not in Flux)

`/etc/cockpit/cockpit.conf`:

```ini
[WebService]
Origins = https://cockpit.nerdsbythehour.com wss://cockpit.nerdsbythehour.com <plus https+wss origins for deby.nerdsbythehour.com, 192.168.68.71 and deby, each on port 9091>
ProtocolHeader = X-Forwarded-Proto
ForwardedForHeader = X-Forwarded-For
```

Then `sudo systemctl restart cockpit`. Cockpit stays on TLS, so `AllowUnencrypted` is not needed.

## Manual steps

1. __Authentik:__ ✅ done 2026-11-05 via `../jimsmcp/setup-cockpit.mjs` — forward_domain provider __pk 19__, app slug `cockpit`, bound to embedded outpost. No policy bindings yet (any Authentik user passes; Cockpit PAM login still required).
2. __DNS (UDM Local DNS Records UI):__ `cockpit.nerdsbythehour.com` CNAME → `deby.nerdsbythehour.com`, same as `netalertx`.

Setting Origins replaces Cockpit's default same-origin check, so the direct port-9091 origins must be listed too.
