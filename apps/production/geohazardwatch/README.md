# geohazardwatch

Public site at `https://geohazardwatch.com` (via Cloudflare Tunnel — see follow-up). Internal LAN at `https://geohazardwatch.nerdsbythehour.com` (Traefik + cert-manager).

Built on the [`ngdpbase`](https://github.com/jwilleke/ngdpbase) wiki engine with the [`ve-geology`](https://github.com/jwilleke/geohazardwatch) addon (GVP volcanoes, USGS earthquakes, USGS HANS alerts).

## Architecture

- **Image**: `ghcr.io/jwilleke/geohazardwatch:X.Y.Z` — built and published from the `jwilleke/geohazardwatch` repo. Layered on `ghcr.io/jwilleke/ngdpbase`.
- **Data volume**: `hostPath /mnt/tank/jims/data/systems/geohazardwatch` mounted at `/app/data`. Holds wiki pages, users, sessions, search index, and the imported geology data.
- **Public path**: Cloudflare Tunnel → cluster Service direct (bypasses Traefik). Wired up separately — see geohazardwatch issues #14-18.
- **Internal path**: Traefik IngressRoute on `geohazardwatch.nerdsbythehour.com` with a cert-manager Let's Encrypt cert. Used to verify the pod independently of the tunnel.

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

A session secret can be created out-of-band (not yet required — image runs in headless install mode with default admin/admin123, change via web UI on first login):

```bash
kubectl -n geohazardwatch create secret generic geohazardwatch-secrets \
  --from-literal=session-secret=$(openssl rand -base64 32)
```

## First deploy notes

- The hostPath `/mnt/tank/jims/data/systems/geohazardwatch` is auto-created (`DirectoryOrCreate`). Confirm permissions allow uid/gid 1000 to write.
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
