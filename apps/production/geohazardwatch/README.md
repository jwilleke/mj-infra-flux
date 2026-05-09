# geohazardwatch

Public site at `https://geohazardwatch.com` (via Cloudflare Tunnel — see follow-up). Internal LAN at `https://geohazardwatch.nerdsbythehour.com` (Traefik + cert-manager).

Built on the [`ngdpbase`](https://github.com/jwilleke/ngdpbase) wiki engine with the [`ve-geology`](https://github.com/jwilleke/geohazardwatch) addon (GVP volcanoes, USGS earthquakes, USGS HANS alerts).

## Architecture

- **Image**: `ghcr.io/jwilleke/geohazardwatch:X.Y.Z` — built and published from the `jwilleke/geohazardwatch` repo. Layered on `ghcr.io/jwilleke/ngdpbase`.
- **Data volume**: `hostPath /mnt/tank/jims/data/systems/geohazardwatch` mounted at `/app/data`. Holds wiki pages, users, sessions, search index, and the imported geology data.
- **Public path**: Cloudflare Tunnel → cluster Service direct (bypasses Traefik). Wired up separately — see geohazardwatch issues #14-18.
- **Internal path**: Traefik IngressRoute on `geohazardwatch.nerdsbythehour.com` with a cert-manager Let's Encrypt cert. Used to verify the pod independently of the tunnel.

## Auto-update flow (requires one-time bootstrap step)

The production cluster's Flux currently runs with only the four core controllers (`source`, `kustomize`, `helm`, `notification`). Image automation is **not yet enabled** — `image-reflector-controller` and `image-automation-controller` need to be added before `image-policy.yaml` can be activated.

### One-time bootstrap

Re-run `flux bootstrap` with the extra components, e.g.:

```bash
flux bootstrap github \
  --owner=jwilleke \
  --repository=mj-infra-flux \
  --branch=master \
  --path=clusters/production \
  --components-extra=image-reflector-controller,image-automation-controller
```

(Or hand-edit `clusters/production/flux-system/gotk-components.yaml` and add the two controllers + their CRDs.)

### Once bootstrapped

1. Add `- image-policy.yaml` to `kustomization.yaml` here.
2. New `ngdpbase` image published → Renovate (in the `geohazardwatch` repo) opens a PR bumping the base image; minor/patch auto-merge.
3. Merge to `master` triggers `publish-image.yml` → new `ghcr.io/jwilleke/geohazardwatch:X.Y.Z`.
4. Flux `ImageRepository` + `ImagePolicy` detect the new tag (semver range `>=1.0.0 <2.0.0`).
5. `ImageUpdateAutomation` rewrites the `image:` line in `deployment.yaml` and `cronjob-import.yaml` and commits to `master`.
6. Flux reconciles → rolling deploy.

Major bumps (e.g., `1.x.x` → `2.0.0`) are NOT auto-deployed — the `ImagePolicy` range must be widened by hand.

Until image automation is bootstrapped, image bumps are entirely manual: edit the `image:` lines in `deployment.yaml` and `cronjob-import.yaml`, commit, and let Flux roll out.

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
