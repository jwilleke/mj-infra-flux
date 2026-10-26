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
