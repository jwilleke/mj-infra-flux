# geohazardwatch

Public site at `https://geohazardwatch.com` (via Cloudflare Tunnel — see follow-up). Internal LAN at `https://geohazardwatch.nerdsbythehour.com` (Traefik + cert-manager).

Built on the [`ngdpbase`](https://github.com/jwilleke/ngdpbase) wiki engine with the [`ve-geology`](https://github.com/jwilleke/geohazardwatch) addon (GVP volcanoes, USGS earthquakes, USGS HANS alerts).

## Architecture

- __Image__: `ghcr.io/jwilleke/geohazardwatch:X.Y.Z` — built and published from the `jwilleke/geohazardwatch` repo. Layered on `ghcr.io/jwilleke/ngdpbase`.
- __Storage__: ngdpbase's two-tier layout, split across two hostPath volumes:
  - __Fast tier__ (`FAST_STORAGE=/app/fast`): `hostPath /mnt/local-k3s-data/geohazardwatch` on deby's local disk (covered by `backup-deby.sh`). Holds config (`config/app-custom-config.json`), the per-instance `.env`, users, persons, roles, sessions, logs, search index, feeds, notifications, and scheduled-job state (`jobs/`). Must be local disk: since ngdpbase#1714 the server refuses to start with job state on NFS.
  - __Slow tier__ (`SLOW_STORAGE=/app/data`): `hostPath /mnt/tank/jims/data/systems/geohazardwatch` on NFS. Holds pages, attachments, backups, comments, footnotes, and the addon's imported data (`geohazardwatch/`, `ve-geology/`).
- __Database__: none (`ngdpbase.database.provider` is `none`); everything is files, so job state uses the file backend.
- __Public path__: Cloudflare Tunnel → cluster Service direct (bypasses Traefik). Wired up separately — see geohazardwatch issues #14-18.
- __Internal path__: Traefik IngressRoute on `geohazardwatch.nerdsbythehour.com` with a cert-manager Let's Encrypt cert. Used to verify the pod independently of the tunnel.

## Auto-update flow

The cluster's Flux already runs `image-reflector-controller` and `image-automation-controller` (see `clusters/production/flux-system/gotk-components.yaml`). The Flux pieces that drive auto-updates for this app live one directory over, in [`../image-automation/`](../image-automation/), because they belong in the `flux-system` namespace and this kustomization stamps `namespace: geohazardwatch` on everything it lists.

Flow once activated:

1. New `ngdpbase` image published → Renovate (in the `geohazardwatch` repo) opens a PR bumping the base image; minor/patch auto-merge.
2. Merge to `master` triggers `publish-image.yml` → new `ghcr.io/jwilleke/geohazardwatch:X.Y.Z` on GHCR.
3. The `ImageRepository` (with `secretRef: ghcr-geohazardwatch`) scans GHCR every 10m and exposes the tag list.
4. The `ImagePolicy` selects the highest tag matching `>=1.0.0 <2.0.0`.
5. The `ImageUpdateAutomation` rewrites the `# {"$imagepolicy": "flux-system:geohazardwatch"}`-marked `image:` line in `deployment.yaml` (and `cronjob-import.yaml` if marked) and commits to `master` as `fluxcdbot`.
6. Flux reconciles → rolling deploy.

Major bumps (e.g., `1.x.x` → `2.0.0`) are NOT auto-deployed — the `ImagePolicy` range must be widened by hand.

## Data refresh

A nightly `CronJob` (`geohazardwatch-data-refresh`) runs the addon's import scripts at 08:00 UTC and writes JSON snapshots into `/app/data/ve-geology/` on the persistent volume. Re-run on demand:

```bash
kubectl -n geohazardwatch create job --from=cronjob/geohazardwatch-data-refresh manual-refresh-$(date +%s)
```

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
- Run an initial data import once before relying on the site:

  ```bash
  kubectl -n geohazardwatch create job --from=cronjob/geohazardwatch-data-refresh initial-import
  ```

## Troubleshooting

```bash
kubectl -n geohazardwatch get pods -o wide
kubectl -n geohazardwatch logs -l app=geohazardwatch --tail=200
kubectl -n geohazardwatch describe pod -l app=geohazardwatch
kubectl -n geohazardwatch get certificate
```

Image automation status:

```bash
flux -n flux-system get image repository geohazardwatch
flux -n flux-system get image policy geohazardwatch
flux -n flux-system get image update geohazardwatch
```
