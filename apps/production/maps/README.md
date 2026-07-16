# Maps — maps.nerdsbythehour.com

Self-hosted location history / "personal Google Timeline", running the [Dawarich](https://dawarich.app) software under the internal name **`maps`** (namespace, resource names, and public hostname all use `maps` rather than `dawarich`). Phones publish location points (OwnTracks-compatible, or Dawarich's own iOS/Android app) over HTTPS to its API; Dawarich stores and visualizes tracks (map, stats, trips, photo/place matching) entirely on `deby`. This is a **separate service from [OwnTracks](../owntracks/README.md)** — they can run side by side; nothing here depends on the OwnTracks Recorder or the shared Mosquitto broker.

Status: **drafted, not yet applied**. This directory is not referenced by the top-level `apps/production/kustomization.yaml` yet, so Flux will not reconcile it until it's added there.

## Components

Mirrors upstream Dawarich's `docker/docker-compose.yml` (four containers), each mapped to its own Deployment:

| Component | Image | Purpose |
|---|---|---|
| `maps-db` | `postgis/postgis:17-3.5-alpine` | PostgreSQL + PostGIS — primary data store. ARM64 nodes should swap to `imresamu/postgis:17-3.5-alpine`. |
| `maps-redis` | `redis:7.4-alpine` | Cache + Sidekiq job queue. |
| `maps-app` | `freikin/dawarich:latest` | Rails web app + API (port 3000). Image name stays `dawarich` — that's upstream's actual Docker Hub repo, unrelated to our `maps` naming. |
| `maps-sidekiq` | `freikin/dawarich:latest` | Background job worker (imports, geocoding, stats). |

## Storage

Three hostPath PVs under `/mnt/local-k3s-data/maps/` (same pattern as `owntracks/`):

- `maps-db-pv` (10Gi) → Postgres data directory.
- `maps-shared-pv` (1Gi) → the `dawarich_shared` volume upstream mounts into **both** `db` (`/var/shared`) and `redis` (`/data`).
- `maps-app-data-pv` (10Gi) → holds `public/`, `tmp/imports/watched/`, and `storage/` via subPath, mounted into **both** `app` and `sidekiq` (matches upstream's shared volumes across those two containers).

Sizes are a starting guess, not a hard ceiling — bump `spec.capacity.storage` (PV) and `spec.resources.requests.storage` (PVC) together if imports/exports grow. `pg_isready`/`redis-cli ping` probes are exec-based since there's no separate `psql`/`redis-cli` sidecar.

## Resource sizing

Requests/limits are deliberately conservative for a household single-user instance (deby has ~15 free CPU cores / ~45Gi free RAM at time of drafting — see `docs/snapshots/host-service-health.md`), well under upstream's default suggested 4G/0.5cpu app limit:

| Container | Requests | Limits |
|---|---|---|
| db | 100m / 128Mi | 500m / 768Mi |
| redis | 50m / 32Mi | 200m / 128Mi |
| app | 150m / 256Mi | 500m / 1536Mi |
| sidekiq | 100m / 128Mi | 250m / 512Mi |

Upstream's own docs warn some releases ship resource-heavy migrations — bump `app`/`sidekiq` limits temporarily around an upgrade if a migration OOMs.

## Access tier

**Tier 2 — public, app-auth** (same tier as OwnTracks, see `docs/access/access.md`): exposed directly via the existing Cloudflare Tunnel → Traefik path, **no** Authentik forward-auth middleware. Dawarich has its own user accounts (login page) and per-device API keys for the mobile app, so — like OwnTracks — an interactive SSO redirect in front would break unattended location POSTs.

## `APPLICATION_PROTOCOL` must stay `http`

`maps-configmap.yaml` sets `APPLICATION_PROTOCOL: "http"` even though the public URL is HTTPS. This is intentional, not an oversight — TLS is terminated upstream (Cloudflare + Traefik/cert-manager), and Dawarich's `config/environments/production.rb` does `config.force_ssl = ENV.fetch('APPLICATION_PROTOCOL', 'http').downcase == 'https'`. Setting it to `https` makes Rails redirect any plain-HTTP request to HTTPS at the same host — including the liveness/readiness probes, which hit the pod's plain-HTTP port directly and have no way to follow that redirect over TLS, causing a permanent crash loop (`http: server gave HTTP response to HTTPS client`). Matches upstream's own compose default.

## Secrets

`maps-secret.sops.yaml` is **encrypted** (`postgres-password` and `secret-key-base`, both freshly random — `openssl rand -base64 32` / `-hex 64`), using the same age recipient as `owntracks/recorder-basic-auth.sops.yaml` and `authentik/authentik-secrets.sops.yaml` (`age1sr8j9p87wuuqfnmharzqqnwj76yyc6mu5j3r5t7sr3j88wzn8exqwy6jhj` — verified against `home-infra-private.agekey`, the same key `sops-age`/Flux decrypts with on `deby`). To rotate either value later:

```bash
# from apps/production/maps/
sops maps-secret.sops.yaml   # opens decrypted in $EDITOR, re-encrypts on save
```

## Manual steps still needed (outside this repo / outside GitOps)

1. **Add this directory to `apps/production/kustomization.yaml`** — not done yet, deliberately, since this is a draft.
2. **Cloudflare Tunnel Public Hostname**: add `maps.nerdsbythehour.com` → `traefik.kube-system.svc.cluster.local:80` (HTTP Host Header `maps.nerdsbythehour.com`) in the Cloudflare dashboard, same as the existing `owntracks.nerdsbythehour.com` entry. Not tracked in this repo.
3. **LAN DNS**: confirm `maps.nerdsbythehour.com` resolves from inside the LAN too (UDM Pro), same consideration as OwnTracks' on-LAN troubleshooting note.
4. Decide `APPLICATION_HOSTS` / `DOMAIN` env values once the hostname is live — `DOMAIN` isn't set here yet (only needed for outgoing email links; add if SMTP is configured later).
5. First-run: create the initial Dawarich user account via the app's sign-up page (or `RAILS_ENV=production bin/rails runner ...` exec into the `maps-app` pod, per upstream docs) — no seed user is created by these manifests.

## Not carried over from upstream compose

- The upstream compose also bind-mounts `dawarich_db_data` (the Postgres data volume) *read-write into the app container* at `/dawarich_db_data`, apparently for backup/admin convenience. Omitted here to avoid two workloads writing the same PV — use `kubectl exec` into `maps-db` for `pg_dump`/`pg_restore` instead.
- SMTP, OIDC, and Prometheus exporter env vars are left unset (all optional per upstream docs — see `/docs/self-hosting/environment-variables/`). Add to `maps-configmap.yaml` (or the secret, for OIDC client secret) if needed later.

## Upstream references

- Self-hosting intro: <https://dawarich.app/docs/self-hosting/introduction/>
- Environment variables: <https://dawarich.app/docs/self-hosting/environment-variables/>
- Hardware requirements: <https://dawarich.app/docs/self-hosting/hardware-requirements/>
- Reference compose file: `docker/docker-compose.yml` in `github.com/Freika/dawarich`
