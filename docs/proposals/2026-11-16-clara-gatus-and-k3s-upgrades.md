# Proposal: outside watcher on clara (Gatus) and k3s patch upgrades

Status: proposal (2026-11-16, [deby#69](https://github.com/jwilleke/deby/issues/69)). The system-upgrade-controller half ships in this PR, gated off; the Gatus half needs host changes on clara and Jim's decision first.

## 1. Gatus on clara: who watches deby?

__Problem.__ Prometheus, Alertmanager, Loki and Grafana all run on deby. If deby hangs, loses power or drops off the network, nothing alerts: the alerting stack is down with it. `zfs-health-watch` mails directly from deby, so it shares the same failure. clara (Intel NUC, Debian 13, 192.168.68.24) is the only other always-on Linux host.

__Proposal.__ Run [Gatus](https://github.com/TwiN/gatus) v5.38.0 on clara as a small, independent status checker:

| Check | Target | Condition |
|---|---|---|
| deby ping | `icmp://192.168.68.71` | `[CONNECTED] == true` |
| k3s API | `tcp://192.168.68.71:6443` | `[CONNECTED] == true` |
| Traefik / Grafana | `https://grafana.nerdsbythehour.com/api/health` | `[STATUS] == 200` |
| Prometheus (via Traefik) | `https://prometheus.nerdsbythehour.com` | `[STATUS] < 500` (Authentik redirect counts as up) |
| UDM Pro | `icmp://192.168.68.1` | `[CONNECTED] == true` |
| Home Assistant | `http://192.168.68.20:8123` | `[STATUS] < 500` |

Alert after 3 failures (~3 min) by email to `mjsservers@willeke.com`.

__Why Gatus over Uptime Kuma.__ One small Go binary and one YAML file (config in Git), no database or web-UI setup, and it can expose `/metrics` for Prometheus to scrape back. Uptime Kuma needs Node, SQLite and configuration by hand in its UI.

__What it needs on clara (host changes; not done):__

- A runtime: either Debian's `docker.io` package and a compose file, or the Gatus binary under systemd. clara has no Docker today.
- Mail: clara has no MTA. Gatus would send through `smtp.resend.com:587` itself, which needs a credential on clara. Use a __separate Resend API key__, so revoking one host's key doesn't silence the other path.
  - OpenBao (stuff): `kv/hosts/clara/gatus`, key `smtp-password` (the new Resend API key). Optional key `smtp-username` = `resend`.
  - clara has no ESO; copy the value once into `/etc/gatus/gatus.env` (root, mode 0600) and reference it as `${SMTP_PASSWORD}` in the config.
- Where it lives: a new `gatus/` directory in the `jwilleke/clara` repo (now `hosts/clara/` in `jwilleke/homelab`, #85).

The failure this leaves: if Resend is down, both deby's and clara's mail paths fail together. A second transport (e.g. ntfy or Pushover) would close it.

## 2. k3s patch upgrades with system-upgrade-controller

Shipped in this PR as `apps/production/system-upgrade/`, safe to merge:

- Controller v0.21.1 (released 2026-11-14), CRDs and manifest vendored from the release assets, not modified.
- Plan `k3s-server`: channel `v1.36` (patch-only; v1.36.6+k3s1 is out, deby runs v1.36.5+k3s1), cordon without drain, window 22:30-23:59 ET.
- __Gated by the node label `k3s-upgrade=enabled`, which deby does not have__, so merging installs the controller and changes nothing on the node. Jim opts in per upgrade.

Minor upgrades (1.36 → 1.37) stay manual: change `channel` after checking API removals, in line with `docs/planning/k3s-upgrade-1.33-to-1.36.md` in the deby repo.
