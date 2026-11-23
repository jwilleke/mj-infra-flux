# geohazardwatch

Public site at `https://geohazardwatch.com` (via Cloudflare Tunnel — see follow-up). Internal LAN at `https://geohazardwatch.nerdsbythehour.com` (Traefik + cert-manager).

The stock [`ngdpbase`](https://github.com/jwilleke/ngdpbase) image with the [`geohazardwatch`](https://github.com/jwilleke/geohazardwatch) add-on (GVP volcanoes, USGS earthquakes, USGS HANS alerts) installed by core's add-on installer (ngdpbase#2056).

## Architecture

- __Image__: `ghcr.io/jwilleke/ngdpbase:X.Y.Z`, the stock image. No custom geohazardwatch image is built or deployed.
- __Add-on__: `@jwilleke/geohazardwatch-addon` from npm, named in the site's configuration (`/app/fast/config/app-custom-config.json`, never YAML) under `ngdpbase.addons.install` → `{ "geohazardwatch": { "package": "@jwilleke/geohazardwatch-addon", "version": "<range>", "repository": "github.com/jwilleke/geohazardwatch" } }`, with `ngdpbase.addons.geohazardwatch.enabled: true`. Core installs it at the first start (sha512 + Sigstore provenance checked) into `/app/fast/addons/geohazardwatch/` with a lock file `/app/fast/addons/addons-lock.json`, and verifies it from disk on every later start. A new add-on release is a deliberate config change: widen or move the version range, then restart.
- __Storage__: ngdpbase's two-tier layout, split across two hostPath volumes:
  - __Fast tier__ (`FAST_STORAGE=/app/fast`): `hostPath /mnt/local-k3s-data/geohazardwatch` on deby's local disk (covered by `backup-deby.sh`). Holds config (`config/app-custom-config.json`), the per-instance `.env`, users, persons, roles, sessions, logs, search index, feeds, notifications, and scheduled-job state (`jobs/`). Must be local disk: since ngdpbase#1714 the server refuses to start with job state on NFS.
  - __Slow tier__ (`SLOW_STORAGE=/app/data`): `hostPath /mnt/tank/jims/data/systems/geohazardwatch` on NFS. Holds pages, attachments, backups, comments, footnotes, and the add-on's imported data (`geohazardwatch/`, which the add-on reads and its jobs write). `ve-geology/` is what the retired CronJob wrote; nothing reads it.
- __Database__: none (`ngdpbase.database.provider` is `none`); everything is files, so job state uses the file backend.
- __Public path__: Cloudflare Tunnel → cluster Service direct (bypasses Traefik). Wired up separately — see geohazardwatch issues #14-18.
- __Internal path__: Traefik IngressRoute on `geohazardwatch.nerdsbythehour.com` with a cert-manager Let's Encrypt cert. Used to verify the pod independently of the tunnel.

## Auto-update flow

The Flux pieces live one directory over, in [`../image-automation/geohazardwatch-policy.yaml`](../image-automation/geohazardwatch-policy.yaml), because they belong in the `flux-system` namespace and this kustomization stamps `namespace: geohazardwatch` on everything it lists.

- 1 A new `ngdpbase` release is published to `ghcr.io/jwilleke/ngdpbase`.
- 2 The `geohazardwatch-ngdpbase` `ImageRepository` scans GHCR every 10m; the `ImagePolicy` selects the highest tag in `>=5.32.0 <6.0.0`.
- 3 The `ImageUpdateAutomation` rewrites the `# {"$imagepolicy": "flux-system:geohazardwatch-ngdpbase"}`-marked `image:` line in `deployment.yaml` and commits to `master` as `fluxcdbot`.
- 4 Flux reconciles → the pod restarts on the new core; the installed add-on stays at its locked version.

Major bumps are NOT auto-deployed — the `ImagePolicy` range must be widened by hand.

## Data refresh

The add-on refreshes its data as core scheduled jobs (ngdpbase#2054), written to `/app/data/geohazardwatch/`: `geohazardwatch.import-volcanoes` (daily 08:00 America/New_York), `geohazardwatch.import-earthquakes` (every 20m), `geohazardwatch.import-hans` (every 10m). Schedules are config keys (`ngdpbase.addons.geohazardwatch.*Schedule`); `ngdpbase.jobs.<jobId>.enabled: false` pauses one. Run or pause them from Admin → Jobs. There is no CronJob.

## Secrets

The deployment reads `NGDPBASE_SESSION_SECRET` from `geohazardwatch-secrets` / `session-secret` (optional, same pattern as `ngdpbase-demo`). That Secret does not exist yet, so ngdpbase uses the secret it generated into `/app/fast/.env` on first boot. If you create the Secret, set it to the value already in `/app/fast/.env`; any other value signs everyone out on the next restart.

```bash
kubectl -n geohazardwatch create secret generic geohazardwatch-secrets \
  --from-literal=session-secret="$(kubectl -n geohazardwatch exec deploy/geohazardwatch -c geohazardwatch -- \
    sh -c 'grep ^NGDPBASE_SESSION_SECRET= /app/fast/.env | cut -d= -f2-')"
```

## First deploy notes

- The slow-tier hostPath `/mnt/tank/jims/data/systems/geohazardwatch` is auto-created (`DirectoryOrCreate`). The fast-tier hostPath `/mnt/local-k3s-data/geohazardwatch` is NOT (`type: Directory`): an empty fast tier boots as a fresh install, so the pod stays in `ContainerCreating` with a mount error until the folder exists. Create it (or restore it from backup) owned by `977:988`, the PUID/PGID the container runs as.
- Default credentials `admin` / `admin123` — change immediately after first access.
- The add-on's jobs fill `/app/data/geohazardwatch/` on their first runs; run `geohazardwatch.import-volcanoes` from Admin → Jobs to fill it at once.

## Troubleshooting

```bash
kubectl -n geohazardwatch get pods -o wide
kubectl -n geohazardwatch logs -l app=geohazardwatch --tail=200
kubectl -n geohazardwatch describe pod -l app=geohazardwatch
kubectl -n geohazardwatch get certificate
```

Image automation status:

```bash
flux -n flux-system get image repository geohazardwatch-ngdpbase
flux -n flux-system get image policy geohazardwatch-ngdpbase
flux -n flux-system get image update geohazardwatch-ngdpbase
```

## Operations summary

*Moved from homelab `network/apps/geohazardwatch.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

GeoHazardWatch is a public website built on ngdpbase (Jim's wiki/page engine).
It publishes geohazard pages at `geohazardwatch.com`. Content is added through
the ngdpbase ingest API.

### Access

| Item | Value |
| --- | --- |
| Public | <https://geohazardwatch.com> (Cloudflare Tunnel, bypasses Traefik) |
| LAN | <https://geohazardwatch.nerdsbythehour.com> (Traefik) |
| Sign-in | Public read. ngdpbase's own login for editing; ingest uses client credentials |

### Where it runs / where data lives

| Item | Value |
| --- | --- |
| Host | deby, namespace `geohazardwatch`, Deployment `geohazardwatch` (ngdpbase 5.42.0, image-automated), `hostNetwork`, port 3000 |
| Main data | NAS hostPath `/mnt/tank/jims/data/systems/geohazardwatch` |
| Fast data | hostPath `/mnt/local-k3s-data/geohazardwatch` |
| Backup | NAS copy pulled nightly to `/nas-backup/tank_nas-to-deby/jims/` (20:00); fast folder in the deby-backup rsync (21:01) |

### Secrets

| Secret | Where |
| --- | --- |
| Ingest client | OpenBao `apps/geohazardwatch/ngdpbase-ingest-creds` → Secret `ngdpbase-ingest-creds`, keys `client-id`, `client-secret` |
| Session secret | Secret `geohazardwatch-secrets`, key `session-secret` (optional; does not exist today) |

### Dependencies

- Tank NAS mounted at `/mnt/tank/jims`
- [cloudflared](../cloudflared/README.md) route for `geohazardwatch.com`
- Traefik for the LAN host

### Recovery

(a) Pod broken:

```bash
kubectl -n geohazardwatch get pods
kubectl -n geohazardwatch logs deploy/geohazardwatch --tail=100
kubectl -n geohazardwatch rollout restart deploy/geohazardwatch
```

(b) Data lost: copy back from the NAS mirror or deby-backup, then restart.

```bash
rsync -a /nas-backup/tank_nas-to-deby/jims/data/systems/geohazardwatch/ /mnt/tank/jims/data/systems/geohazardwatch/
rsync -a /deby-backup/host/daily/latest/rootfs/mnt/local-k3s-data/geohazardwatch/ /mnt/local-k3s-data/geohazardwatch/
kubectl -n geohazardwatch rollout restart deploy/geohazardwatch
```

(c) deby rebuilt: the fast folder must exist (`type: Directory`, the pod will
not start without it). Restore `/mnt/local-k3s-data`, mount the NAS, then
`flux reconcile kustomization apps --with-source`.

### Health checks

```bash
curl -o /dev/null -w "%{http_code}\n" https://geohazardwatch.com/
curl -o /dev/null -w "%{http_code}\n" https://geohazardwatch.nerdsbythehour.com/
```

### Known gaps

- `certificate.yaml` in the app folder is not listed in its kustomization.
- No `geohazardwatch-secrets` Secret exists, so the session secret is whatever the app picks by default. Unknown — to fill in whether that is intended.
- `hostNetwork` means port 3000 on deby itself is used by this pod.
- The `nas-backup` mirror has no version history (deletes sync over).

## For users: GeoHazardWatch — geohazardwatch.com

*Moved from homelab `docs/services-provided/geohazardwatch.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Public geological hazard tracker showing real-time volcano activity, earthquake data, and USGS HANS alerts worldwide.

### How to reach it

| From | URL | Auth |
|---|---|---|
| Anywhere (internet) | <https://geohazardwatch.com> | None — public |
| LAN / internal | <https://geohazardwatch.nerdsbythehour.com> | None — public |

### What it provides

- __Volcano activity__ — data from the Global Volcanism Program (GVP)
- __Earthquakes__ — USGS earthquake feed, updated continuously
- __USGS HANS alerts__ — Hazard Notification System feed
- __Wiki pages__ — supporting articles and background content

Data is refreshed nightly via an automated import job. The underlying wiki engine is `ngdpbase` with the `ve-geology` addon.

### Data freshness

The nightly import job runs at 08:00 UTC. To force an immediate refresh (operator):

```bash
kubectl -n geohazardwatch create job --from=cronjob/geohazardwatch-data-refresh manual-refresh-$(date +%s)
```

### Operator reference

[`mj-infra-flux/apps/production/geohazardwatch/README.md`](README.md)
