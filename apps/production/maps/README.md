# Maps — maps.nerdsbythehour.com

Self-hosted location history / "personal Google Timeline", running the [Dawarich](https://dawarich.app) software under the internal name __`maps`__ (namespace, resource names, and public hostname all use `maps` rather than `dawarich`). Phones publish location points (OwnTracks-compatible, or Dawarich's own iOS/Android app) over HTTPS to its API; Dawarich stores and visualizes tracks (map, stats, trips, photo/place matching) entirely on `deby`. This is a __separate service from [OwnTracks](../owntracks/README.md)__ — they can run side by side; nothing here depends on the OwnTracks Recorder or the shared Mosquitto broker.

Status: __drafted, not yet applied__. This directory is not referenced by the top-level `apps/production/kustomization.yaml` yet, so Flux will not reconcile it until it's added there.

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
- `maps-shared-pv` (1Gi) → the `dawarich_shared` volume upstream mounts into __both__ `db` (`/var/shared`) and `redis` (`/data`).
- `maps-app-data-pv` (10Gi) → holds `public/`, `tmp/imports/watched/`, and `storage/` via subPath, mounted into __both__ `app` and `sidekiq` (matches upstream's shared volumes across those two containers).

Sizes are a starting guess, not a hard ceiling — bump `spec.capacity.storage` (PV) and `spec.resources.requests.storage` (PVC) together if imports/exports grow. `pg_isready`/`redis-cli ping` probes are exec-based since there's no separate `psql`/`redis-cli` sidecar.

## Resource sizing

Requests/limits are deliberately conservative for a household single-user instance (deby has ~15 free CPU cores / ~45Gi free RAM at time of drafting — see `docs/snapshots/host-service-health.md`), well under upstream's default suggested 4G/0.5cpu app limit:

| Container | Requests | Limits |
|---|---|---|
| db | 100m / 512Mi | 1000m / 4Gi |
| redis | 50m / 32Mi | 200m / 128Mi |
| app | 150m / 256Mi | 500m / 1536Mi |
| sidekiq | 100m / 256Mi | 1000m / 6Gi |

Upstream's own docs warn some releases ship resource-heavy migrations — bump `app`/`sidekiq` limits temporarily around an upgrade if a migration OOMs.

`sidekiq`'s memory limit was raised twice (512Mi → 3Gi → 6Gi), and `db`'s twice (768Mi → 2Gi → 4Gi), during and after one-time bulk imports of historical location data (OwnTracks `.rec` files, then a Google Timeline JSON export) that brought the dataset to 1.3M+ points:

- `sidekiq` OOMKilled almost immediately on the `.rec` import — `OwnTracks::RecParser`/`OwnTracks::Importer` load the entire file into memory at once (not streamed), so multi-hundred-MB `.rec` files need real headroom, especially with `BACKGROUND_PROCESSING_CONCURRENCY: 3` potentially parsing several large files concurrently. __Large `.rec` files should be pre-split into ~35MB chunks__ (`split -l 97000 --numeric-suffixes=1 --suffix-length=2 --additional-suffix=.rec`) before dropping into the watched-imports folder — a single 211MB file never got past initial parsing within Dawarich's 6-hour stuck-import watchdog (`StaleJobsRecoveryJob::IMPORT_TIMEOUT`) even after the memory fix, while the same data split into ~35MB chunks completed cleanly and processed ~99.5% of its lines into points.
- `db` (Postgres) then OOMKilled once bulk-upserting ~600K+ point rows with PostGIS geometry indexing started outpacing its 768Mi limit — collateral `maps-app` restarts (clean `SIGINT`, not its own OOM) followed from losing the DB connection mid-crash-loop. Raised to 2Gi.
- `sidekiq` OOMKilled *again* at 3Gi during a Google Timeline JSON import (`GoogleMaps::PhoneTakeoutImporter`), even with chunks pre-split down to ~20-27MB each — nested JSON parsing (`JSON.parse`/`Oj.load` into deep Hash/Array graphs) has substantially higher per-byte memory overhead than the `.rec` format's simple tab-separated lines, and 3 concurrent chunk-parses compounded it. Raised to 6Gi to give real headroom.
- `db` OOMKilled *again* at 2Gi, this time in ordinary steady-state operation (no bulk import running) once the dataset reached ~1.3M rows — heavy WAL/checkpoint churn from ongoing writes (live tracking + PostGIS index maintenance) at that row count outpaced 2Gi; `checkpoints are occurring too frequently` warnings preceded the crash. Raised to 4Gi. Unlike the sidekiq bumps (safe to dial back after a one-time import finishes), __this one reflects genuine steady-state need at the current data volume__ — don't lower it without confirming row-count growth hasn't made it necessary again.
- __A sidekiq restart mid-import silently drops whatever job was executing at that moment__ — Sidekiq OSS has no reliability queue for jobs killed by a hard process exit (OOM, pod restart), only for jobs that raise a catchable Ruby exception. An import stuck at `status: processing` forever, with an empty `imports` Sidekiq queue and no matching `Import::ProcessJob` in `Sidekiq::Workers.new`, means the job was lost, not slow — just re-run it: `Import::ProcessJob.perform_later(id)` (safe/idempotent — `Point.upsert_all(unique_by: [:lonlat, :timestamp, :user_id], on_duplicate: :skip)`).

`sidekiq`'s 6Gi is safe to dial back down for normal day-to-day operation if tighter bin-packing is ever needed — live-tracking payloads need only a fraction of it, that ceiling exists for bulk-import bursts. `db`'s 4Gi is different: the second OOM happened with *no* import running, purely from steady-state write/checkpoint load at ~1.3M rows, so don't lower it without confirming the row count hasn't grown further since.

## Access tier

__Tier 2 — public, app-auth__ (same tier as OwnTracks, see `docs/access/access.md`): exposed directly via the existing Cloudflare Tunnel → Traefik path, __no__ Authentik forward-auth middleware. Dawarich has its own user accounts (login page) and per-device API keys for the mobile app, so — like OwnTracks — an interactive SSO redirect in front would break unattended location POSTs.

## `APPLICATION_PROTOCOL`, `force_ssl`, and why there's a forwarded-proto Middleware

`maps-configmap.yaml` sets `APPLICATION_PROTOCOL: "https"`. Dawarich's `config/environments/production.rb` does `config.force_ssl = ENV.fetch('APPLICATION_PROTOCOL', 'http').downcase == 'https'`, so this turns on Rails' `force_ssl` (needed so Rails perceives itself as HTTPS — otherwise Rails computes its own request origin as `http://...`, which mismatches the browser's real `Origin: https://...` header on every form POST and gets rejected by Rails' CSRF/Origin check with a silent 422, before Devise even checks the password).

This creates two problems that both needed a fix, since our TLS is terminated upstream (Cloudflare edge + the Cloudflare Tunnel), and the tunnel's Public Hostname connects to Traefik in __HTTP__ mode (`traefik.kube-system.svc.cluster.local:80`, matching owntracks) — so nothing downstream of Cloudflare ever sees a real TLS handshake:

1. __Real traffic via Traefik__ — without `X-Forwarded-Proto: https`, Rails would treat every request (even the legitimate HTTPS ones from users) as insecure and force_ssl would redirect them, breaking cookies/CSRF. Fixed by `maps-forwarded-proto-middleware.yaml`, a Traefik `Middleware` that stamps `X-Forwarded-Proto: https` on every request before it reaches `maps-app`, referenced from `maps-ingress.yaml` via the `traefik.ingress.kubernetes.io/router.middlewares` annotation.
2. __Kubernetes' own liveness/readiness probes__ — these hit the pod's port 3000 directly, bypassing Traefik (and the Middleware above) entirely. Fixed by adding the same `X-Forwarded-Proto: https` as an explicit `httpHeaders` entry on both probes in `maps-app-deployment.yaml`. Rails trusts this header by default because the probe's source IP (kubelet, same node) falls within Rails' default trusted-proxy ranges (`10.0.0.0/8` / `192.168.0.0/16` / loopback) — no extra `trusted_proxies` config needed.

__Do not set `APPLICATION_PROTOCOL` back to `http`__ — that was an earlier, incomplete fix for a *different* symptom (a crash loop from the probes hitting a force_ssl redirect they couldn't follow) that in turn broke login (Origin/CSRF mismatch) for every real user. Both pieces — the Middleware and the probe headers — must stay in place together.

## Secrets

`maps-secret.sops.yaml` is __encrypted__ (`postgres-password` and `secret-key-base`, both freshly random — `openssl rand -base64 32` / `-hex 64`), using the same age recipient as `owntracks/recorder-basic-auth.sops.yaml` and `authentik/authentik-secrets.sops.yaml` (`age1sr8j9p87wuuqfnmharzqqnwj76yyc6mu5j3r5t7sr3j88wzn8exqwy6jhj` — verified against `home-infra-private.agekey`, the same key `sops-age`/Flux decrypts with on `deby`). To rotate either value later:

```bash
# from apps/production/maps/
sops maps-secret.sops.yaml   # opens decrypted in $EDITOR, re-encrypts on save
```

## Manual steps still needed (outside this repo / outside GitOps)

1. __Add this directory to `apps/production/kustomization.yaml`__ — not done yet, deliberately, since this is a draft.
2. __Cloudflare Tunnel Public Hostname__: add `maps.nerdsbythehour.com` → `traefik.kube-system.svc.cluster.local:80` (HTTP Host Header `maps.nerdsbythehour.com`) in the Cloudflare dashboard, same as the existing `owntracks.nerdsbythehour.com` entry. Not tracked in this repo.
3. __LAN DNS__: confirm `maps.nerdsbythehour.com` resolves from inside the LAN too (UDM Pro), same consideration as OwnTracks' on-LAN troubleshooting note.
4. __`APPLICATION_HOSTS` and `DOMAIN` are not interchangeable.__ `APPLICATION_HOSTS` feeds only Rails host authorization; the mailer host comes from `DOMAIN` alone (`SmtpConfig.mailer_url_options`), which is unset here. Mailer templates raise `Missing host to link to!` without it. Never set `DOMAIN` on its own: with no `SMTP_*` configured, delivery then fails instead, with 25 retries per user. Set both together or neither.
5. First-run: create the initial Dawarich user account via the app's sign-up page (or `RAILS_ENV=production bin/rails runner ...` exec into the `maps-app` pod, per upstream docs) — no seed user is created by these manifests.

## Not carried over from upstream compose

- The upstream compose also bind-mounts `dawarich_db_data` (the Postgres data volume) *read-write into the app container* at `/dawarich_db_data`, apparently for backup/admin convenience. Omitted here to avoid two workloads writing the same PV — use `kubectl exec` into `maps-db` for `pg_dump`/`pg_restore` instead.
- SMTP, OIDC, and Prometheus exporter env vars are left unset (all optional per upstream docs — see `/docs/self-hosting/environment-variables/`). Add to `maps-configmap.yaml` (or the secret, for OIDC client secret) if needed later.
- Digest emails are off: `monthly_digest_scheduling_job` and `yearly_digest_scheduling_job` are disabled in sidekiq-cron (mj-infra-flux#211). The status lives in Redis, not in any manifest, and survives pod restarts and image upgrades. Re-enable from the Sidekiq Web UI's Cron tab only after SMTP is configured.

## Upstream references

- Self-hosting intro: <https://dawarich.app/docs/self-hosting/introduction/>
- Environment variables: <https://dawarich.app/docs/self-hosting/environment-variables/>
- Hardware requirements: <https://dawarich.app/docs/self-hosting/hardware-requirements/>
- Reference compose file: `docker/docker-compose.yml` in `github.com/Freika/dawarich`

## Operations summary

*Moved from homelab `network/apps/maps.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

Dawarich keeps a private history of where family phones have been and shows it
on a map. It is like Google Timeline, self-hosted. A weekly job thins old
points to keep the database small.

### Access

| Item | Value |
| --- | --- |
| URL | <https://maps.nerdsbythehour.com> |
| Reach | Public through the Cloudflare Tunnel (`tunnel-infra-flux`) → Traefik, and LAN. Public DNS resolves to Cloudflare (checked 2026-11-23) |
| Sign-in | Dawarich's own login (no Authentik in front) |

### Where it runs / where data lives

| Item | Value |
| --- | --- |
| Host | deby, namespace `maps` |
| Workloads | `maps-app` and `maps-sidekiq` (Dawarich 1.20.1, image-automated 1.x), `maps-db` (PostGIS 17-3.5), `maps-redis` (7.4) |
| Data | hostPath `/mnt/local-k3s-data/maps/app-data`, `/maps/db`, `/maps/shared` |
| Jobs | CronJob `maps-points-thin`, Sundays 03:30 ET |
| Backup | Nightly `maps-postgres-all.sql.gz` in deby-backup dumps; `app-data` and `shared` in the rsync; the `db` folder is excluded on purpose |

### Secrets

| Secret | Where |
| --- | --- |
| DB password, Rails secret | OpenBao `apps/maps/maps-secret` → Secret `maps/maps-secret`, keys `postgres-password`, `secret-key-base` |

### Dependencies

OpenBao / External Secrets, Traefik, cert-manager. Location input from phones
(Dawarich API) — whether it also reads OwnTracks is Unknown — to fill in.

### Recovery

(a) Pod broken:

```bash
kubectl -n maps get pods
kubectl -n maps rollout restart deploy/maps-app deploy/maps-sidekiq
```

(b) Data lost:

```bash
kubectl -n maps scale deploy/maps-app deploy/maps-sidekiq --replicas=0
zcat /deby-backup/host/daily/latest/dumps/maps-postgres-all.sql.gz | \
  kubectl -n maps exec -i deploy/maps-db -- psql -U postgres -d postgres
kubectl -n maps scale deploy/maps-app deploy/maps-sidekiq --replicas=1
```

(c) deby rebuilt: restore `/mnt/local-k3s-data/maps` (except `db`), let Flux
start it with an empty `db` folder, then restore the dump as in (b).

### Health checks

```bash
kubectl -n maps get pods,cronjob
curl -o /dev/null -w "%{http_code}\n" https://maps.nerdsbythehour.com/
```

### Known gaps

- Location history is sensitive; it is only protected by Dawarich's login.

## For users: Maps — maps.nerdsbythehour.com

*Moved from homelab `docs/services-provided/maps.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Self-hosted location history ("personal Google Timeline"), running the [Dawarich](https://dawarich.app) software under the internal name `maps`. Phones publish location points over HTTPS; Dawarich stores and visualizes tracks — map, stats, trips, photo/place matching — entirely on `deby`. Separate from [OwnTracks](../owntracks/README.md); the two run side by side and don't depend on each other.

### How to reach it

__URL:__ <https://maps.nerdsbythehour.com>

Available from anywhere (LAN + internet) via Cloudflare Tunnel → Traefik.

### Authentication — corrected model

__Self-registration is closed.__ `/users/sign_up` redirects back to the homepage (`ALLOW_EMAIL_PASSWORD_REGISTRATION` defaults `false`, and no OIDC is configured). There is no sign-up page in practice.

__What actually creates accounts:__

- __Seed account__, created automatically on first boot by Dawarich's own `db/seeds.rb`: `demo@dawarich.app` / `safepassword`, admin. __Change this password immediately after first login__ — it's a public, well-known default baked into Dawarich's source, and this instance has no Basic Auth/SSO in front of it by design (phones need to publish unattended).
- __Additional users__ (e.g. Jim's and Molly's real accounts) are created by an admin at __Settings → Users__ (`/settings/users`), not via self-signup. Admin-created accounts on a self-hosted instance automatically get full `pro` plan access with a ~1000-year expiry — no payment involved server-side (see the payment note below).
- Each account's __API key__ — the credential phones actually use, not the account password — lives at __Settings → Account__. It's a 64-character hex string.

There's no Traefik Basic Auth or Authentik forward-auth in front of this app (same Tier 2 pattern as OwnTracks) — an interactive SSO redirect would break unattended phone publishes.

### "Do I have to pay for Dawarich?" — no

Your self-hosted server never asks for payment. Verified directly in the database: admin-created accounts get `status: active`, `plan: pro`, `active_until` a thousand years out, automatically.

The payment prompt some people hit is in Dawarich's __official App Store/Play Store client app__, which has its own in-app-purchase plumbing (`subscription_source: apple_iap/google_play`, `trial/upgrade` routes) independent of the self-hosted backend. You don't need that app — see below for free clients that work just as well against this server.

### Mobile app setup — what actually works

| Client | Platform | Status | Notes |
|---|---|---|---|
| __OwnTracks__ | iOS / Android | ✅ __Works, verified__ | Repoint at Dawarich instead of (or in addition to, on a different phone from) the existing Recorder. See below. |
| __Traccar Client__ (`com.traccar.client`, Google Play/F-Droid) | Android | ❌ __Does not work__ | Silent no-op — see "Known issue" below. Despite Dawarich's own changelog claiming support, don't use it. |
| __Overland__ ([aaronpk/Overland-iOS](https://github.com/aaronpk/Overland-iOS)) | iOS | Untested, believed to work | Matches Dawarich's `/api/v1/overland/batches` endpoint. Free, open-source, iOS-only. |
| Dawarich's own app | iOS / Android | Not needed | Has its own paywall (see above) unrelated to server access. The free clients above cover the same ground. |

#### OwnTracks setup (the one that's confirmed working end-to-end)

1. Get your account's API key from __Settings → Account__ on the web UI.
2. In the OwnTracks app: __Mode: HTTP__, __URL:__

   ```
   https://maps.nerdsbythehour.com/api/v1/owntracks/points?api_key=<your_api_key>
   ```

   Leave Username/Password blank — auth here is the `api_key` query param, not HTTP Basic Auth like the existing OwnTracks Recorder setup.
3. __Copy-paste the URL — do not hand-type it.__ This was the actual root cause of an extended false "not working" diagnosis: the URL + 64-char API key is >100 characters, and a single mistyped/autocorrected character fails __silently__ (the server never even sees the request, no error shown anywhere). Text/email the URL to yourself, or use Notes sync, then paste it into the app.
4. One app instance can only publish to one HTTP endpoint at a time — a phone already feeding the OwnTracks Recorder needs either a second install, or to fully switch over (giving up that phone's feed to the original Recorder/Home Assistant).
5. Verify from the operator side: check the `points` table / `points_count` per user, or watch `kubectl -n maps logs deploy/maps-app` for `POST /api/v1/owntracks/points` — a working publish shows `status: 200` *and* new rows land in `points`. A response of `200` in the app's own status screen is __not sufficient proof__ — see the Traccar issue below where `200` and total silence coexisted.

#### Known issue — Traccar Client silently fails (unresolved, don't use it)

The official Traccar Client Android app was tried and produces `200 OK` responses with __zero points ever stored__, no error surfaced anywhere. Root cause, confirmed by reading both sides' source:

- The __real app__ (`traccar/traccar-client-android`, `ProtocolFormatter.kt`) sends everything as __URL query parameters__ (`?id=&lat=&lon=&timestamp=&batt=...`) with an __empty POST body__ — a fixed, non-configurable wire format.
- __Dawarich's__ `/api/v1/traccar/points` endpoint only reads a __nested JSON body__ (`location.coords.latitude`, etc.) and never looks at query-string params.
- Since Dawarich's `render json: [], status: :ok` fires unconditionally regardless of whether parsing actually succeeded, every request looks identical to a success from the client's perspective.

This contradicts Dawarich's own changelog, which claims "the official Traccar client app is now supported directly." Worth filing upstream (`Freika/dawarich` on GitHub) if not already reported. Until/unless that's fixed, Android users should use OwnTracks instead (see above), or GPSLogger with a custom JSON template matching the shape Dawarich actually expects.

### Known issue — login 422'd silently until two things were fixed together (resolved)

Early on, every real browser login attempt failed with a silent redisplay of the sign-in form (no error message) — `Users::SessionsController#create` was returning `422` on every attempt, and `failed_attempts` never incremented, meaning Devise never even checked the password. Root cause and fix (full technical detail in the [operator README](README.md#applicationprotocol-forcessl-and-why-theres-a-forwarded-proto-middleware)):

- Dawarich's `force_ssl` (driven by `APPLICATION_PROTOCOL`) needs to be `https` so Rails' CSRF/Origin check accepts real browser requests — but naively doing that alone broke Kubernetes' own health probes (which bypass Traefik and hit the pod directly over plain HTTP), causing a crash loop.
- Fixed by adding a Traefik Middleware that stamps `X-Forwarded-Proto: https` on real traffic, __and__ adding the same header directly to the liveness/readiness probes so they're unaffected by force_ssl even though they never go through Traefik.

This is resolved and stable now — noted here in case login ever silently breaks again after a future change to this app.

### Bulk historical import (one-time, done)

Jim's full location history was backfilled in one session: 3 months of OwnTracks `.rec` files from the Recorder's on-disk store (May–July 2026, ~346MB) and a Google Timeline JSON export from the Pixel 9 (2011–2026, 316MB). Final total: __1,322,093 points__, verified against the real `points` table (the account's `points_count` counter is denormalized and doesn't update from bulk imports — don't trust it as a source of truth without cross-checking).

__Google Timeline import specifically__ — yes, Dawarich supports this natively (`GoogleMaps::PhoneTakeoutImporter`, first-class built-in feature, not a workaround). Two infra issues came up during the actual import, not gaps in Dawarich's Google support:

- The 316MB file needed splitting into ~9 chunks (~20-27MB each) to avoid OOMing `maps-sidekiq` — nested JSON parsing has much higher per-byte memory overhead than OwnTracks' `.rec` line format, so even 6Gi wasn't quite enough at 3 concurrent chunks until raised further (see operator README for the full memory-tuning history).
- __The chunks were split by array index (evenly dividing `semanticSegments`/`rawSignals` by count), not chronologically.__ A Timeline export isn't strictly date-ordered across both arrays, so each resulting chunk file ended up spanning a wide, non-contiguous date range — e.g. one chunk covered 2017-07-21 through 2026-06-30 in a single file. If you need to know what date range a specific import/chunk covers, query it directly rather than assuming from the chunk number or processing order:

  ```sql
  SELECT min(to_timestamp(p.timestamp)), max(to_timestamp(p.timestamp)), count(*)
  FROM points p WHERE p.import_id = <id>;
  ```

Full technical write-up (OOM history, the Sidekiq-queue-silently-drops-completed-imports bug, exact commands used) is in the [operator README](README.md).

### What it does

- `maps-app` (Rails) serves the web UI and API on port 3000.
- `maps-sidekiq` runs background jobs — imports (GPX/KML/GeoJSON/Google Timeline exports), reverse geocoding, stats.
- `maps-db` (PostgreSQL + PostGIS) is the primary data store.
- `maps-redis` backs the cache and Sidekiq job queue.

### Operator reference

[`mj-infra-flux/apps/production/maps/README.md`](README.md)

## Operator notes: Maps — location history (OwnTracks + Dawarich)

*Moved from homelab `docs/apps/maps.md` (last changed 2026-10-14) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

__Maps__ is the household's self-hosted location history — a private "Google Timeline". It is two pieces of software working together:

| Part | Runs on | Does |
| --- | --- | --- |
| __[OwnTracks](https://owntracks.org/)__ | each person's __phone__ | Reads the phone's location and sends it over HTTPS. Stores nothing long-term. |
| __[Dawarich](https://dawarich.app/)__ | the home __k3s cluster__ (namespace `maps`) | Receives the points, stores them in PostGIS (`maps-db`), builds tracks, visits and stats, and serves the map at `https://maps.example.com`. |

This guide covers setting up OwnTracks on a phone and how the data is kept. Operator detail (Kubernetes manifests, storage) is in `mj-infra-flux/apps/production/maps/`; the retired Recorder path is in [`mj-infra-flux/apps/production/owntracks/README.md`](../owntracks/README.md).

Hostnames and email addresses in this guide use `example.com` placeholders — substitute the real domain and accounts.

### How a location point gets onto the map

1. OwnTracks on the phone (HTTP mode) posts `{lat, lon, …}` over HTTPS to Dawarich's OwnTracks endpoint, `POST /api/v1/owntracks/points`.
2. Cloudflare's edge terminates TLS and forwards through the Cloudflare Tunnel to Traefik in the cluster, which routes `maps.example.com` to the `maps-app` Service.
3. Dawarich authenticates the request by __your personal Dawarich API key__ and stores the point in its PostGIS database (`maps-db`); background jobs (`maps-sidekiq`) filter anomalies and build tracks.

__Your tracks never sit in a third-party cloud.__ Cloudflare's edge proxies the request but does not retain it. Dawarich's database in the cluster is the only persistent store.

#### The old Recorder path (no longer used)

Until mid-July 2026 the phones posted to the __OwnTracks Recorder__ at `https://owntracks.example.com/pub` (HTTP Basic auth), which stored points in LMDB and republished them to MQTT as `owntracks/<user>/<device>` for Home Assistant. Both phones now post to Dawarich instead: the Recorder's newest point is from July, and it holds nothing for Molly's phone. The Recorder is still deployed but receives nothing, so __nothing publishes OwnTracks locations to MQTT any more__ — a Home Assistant `device_tracker` fed by the OwnTracks/MQTT integration is stale. Retiring the Recorder (or re-feeding Home Assistant) is an operator decision.

### Before you start — get your API key

Each person has their own Dawarich account (`jim@example.com`, `molly@example.com`). Sign in at `https://maps.example.com`, open your __account settings__, and copy your __API key__. The key alone identifies you — the OwnTracks Username/Password fields are not used.

__Treat the API key like a password.__ Anyone holding it can write points to your map and read your data through the API. If a phone is lost, regenerate the key in Dawarich's account settings and enter the new one on your remaining phones.

### iPhone / iPad setup (OwnTracks for iOS)

1. App Store → install __OwnTracks__ (publisher: OwnTracks).
2. Open the app → tap the gear icon (bottom right) → __Settings__.
3. __Mode:__ `HTTP`.
4. __URL:__ `https://maps.example.com/api/v1/owntracks/points?api_key=<your API key>`
5. __TrackerID:__ two letters identifying you on a map, e.g. `JW`.
6. __DeviceID:__ unique per phone, e.g. `phoneJSW`.
7. Leave Username, Password and the HTTP Headers section empty.
8. __Monitoring__ (top of Settings): `Significant` is battery-friendly (updates every few hundred metres of movement); `Move` is much more frequent and uses more battery; `Manual` only publishes when you tap the upload arrow.
9. Back out of Settings and tap the __↑ upload__ icon to force a publish.

### Android setup (OwnTracks for Android)

1. Play Store → install __OwnTracks__ (publisher: OwnTracks).
2. Open the app → __⋮ menu → Preferences → Connection → Mode__ → choose __HTTP__.
3. __Preferences → Connection → Host →__ `https://maps.example.com/api/v1/owntracks/points?api_key=<your API key>`
4. __Preferences → Connection → Identification:__ Device ID (e.g. `phoneMEW`) and Tracker ID (two letters). Leave Username and Password empty.
5. Leave __Preferences → Connection → Advanced → HTTP Headers__ empty.
6. __Preferences → Reporting → Locator interval / displacement:__ the defaults (~5 min / ~500 m) are sensible. Lower = more frequent + more battery.
7. Back out and tap __publish now__ to force a publish.

### Current phones

| Person | Dawarich account | DeviceID | TrackerID | Topic Dawarich records |
| --- | --- | --- | --- | --- |
| Jim | `jim@example.com` (user 2) | `phoneJSW` | `JW` | `owntracks/user/phoneJSW` |
| Molly | `molly@example.com` (user 3) | `phoneMEW` | `mw` | `owntracks/user/phoneMEW` |

The topic's middle segment is `user` because no OwnTracks Username is set; identity comes from the API key, not the topic. Reporting rate, measured 2026-10-14 over the previous 7 days: `phoneJSW` ~17,000 points a day with a median of __3 s__ between points (`Move` monitoring); `phoneMEW` ~2,300 a day. That density is what grows the database (~60 MB a day); `Significant` monitoring, or `Move` with a 30–60 s / 50–100 m minimum, cuts it 10–20× while keeping region enter/exit events. `phoneJSW` was switched to __Significant__ on 2026-10-14 04:50: the rate went from ~30 points a minute to 1 in the following 5 minutes.

### Keeping reporting reliable

The server accepts every well-formed request; when a phone goes quiet, the phone stopped sending. Phones pause background apps to save power, which shows up as gaps on the map that start at random times and recover on their own. To prevent it:

- __iPhone:__ Settings → OwnTracks → Location __Always__ with __Precise__ on; Background App Refresh on. Low Power Mode pauses background location.
- __Android:__ Settings → Apps → OwnTracks → Battery __Unrestricted__ (not "Optimized"); Location __Allow all the time__; background data allowed.
- In the app, a growing count of queued messages means it is recording but cannot send — check the URL/API key and connectivity.

### Verifying it works

1. __In the phone app:__ after a publish, the status indicator turns green; iOS shows the last server response under *Settings → Status*. HTTP `200` means Dawarich accepted the point.
2. __On the map:__ sign in at `https://maps.example.com` — your latest point and today's track should appear.
3. __Operator check__ — last report and today's count per phone:

   ```bash
   kubectl exec -n maps deploy/maps-db -- sh -c 'psql -U "$POSTGRES_USER" -d maps_production -c "select user_id, tracker_id, count(*), to_timestamp(max(timestamp)) from points where timestamp > extract(epoch from now()-interval '\''1 day'\'') group by 1,2;"'
   ```

### Battery and data usage

- __Significant / standard monitoring:__ a handful of publishes per hour while moving, near-zero when stationary.
- __Move monitoring:__ publishes every few seconds to ~30 s while in motion; the current phones report at this kind of rate. Battery cost is noticeable on long drives.
- __Data per publish:__ ~500 bytes.

### Data retention — older points are thinned

Points older than __60 days__ are thinned to __one point per minute per person__: in each minute the most accurate point is kept and the rest are deleted. A weekly job does this (`maps-points-thin` CronJob, Sunday 03:30, in `mj-infra-flux/apps/production/maps/`), so full detail is kept for the last two months and older history stays at minute resolution. Sparse history (the 2011–2025 imports) is untouched — those points are already more than a minute apart.

What changes on the map: tracks older than 60 days are slightly less smooth at street level; routes, visits and places are unchanged. After a large thinning run, recalculate stats in Dawarich. Why: [mj-infra-flux#208](https://github.com/jwilleke/mj-infra-flux/issues/208) (database size and memory).

### Privacy notes

- All track data lives on `deby`, in Dawarich's PostGIS database (`/mnt/local-k3s-data/maps/db`). It is __not__ synced to any cloud service, Apple Maps, Google Timeline, etc. The Recorder's old LMDB store (`/mnt/local-k3s-data/owntracks/store/`) still holds the pre-July history.
- Cloudflare's edge sees request metadata (your IP, the destination domain, request size). The API key travels in the URL inside TLS; Cloudflare's edge can see full URLs, so treat the key as known to that hop.
- If a phone is lost: regenerate that person's API key in Dawarich; the lost phone's key stops working immediately.

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| App shows "401 Unauthorized" | Missing or wrong `api_key` in the URL, or the key was regenerated | Copy the current API key from Dawarich account settings into the URL. |
| Gaps on the map, app looks fine later | Phone paused OwnTracks in the background | See [Keeping reporting reliable](#keeping-reporting-reliable). |
| Queued messages pile up in the app | No connectivity, or the URL is wrong | Check the URL (`/api/v1/owntracks/points?api_key=…`) and that `https://maps.example.com` loads on the phone. |
| "404 Not Found" | URL path wrong, or the Cloudflare/Traefik route is down | Operator: check `kubectl -n maps logs deploy/maps-app` and the `maps-app` Ingress. |
| Battery drain noticeable | Monitoring set to `Move` | Switch to `Significant` (iOS) or raise the displacement threshold (Android). |

Operator starting points: `kubectl -n maps logs deploy/maps-app` (JSON request log — every OwnTracks post appears as `"path":"/api/v1/owntracks/points"` with its status), `kubectl -n maps logs deploy/maps-sidekiq`, `kubectl -n kube-system logs deploy/traefik`, and `kubectl -n cloudflared logs -l app=cloudflared`.

### App documentation

Upstream OwnTracks docs are the authoritative reference for app behaviour and settings: <https://owntracks.org/booklet/>. Dawarich's OwnTracks integration: <https://dawarich.app/docs/>. Anything in this doc that contradicts upstream should be treated as out-of-date and corrected here.
