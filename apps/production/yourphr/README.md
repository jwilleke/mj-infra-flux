# YourPHR (family install)

*Moved from homelab `network/apps/yourphr.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

## What it is and does

YourPHR is Jim's personal health record app. It pulls records from health
providers (SMART on FHIR) and keeps them for the family. A public relay
catches the OAuth callback, and a converter turns CDA documents into FHIR.

## Access

| Item | Value |
| --- | --- |
| App | <https://yourphr.nerdsbythehour.com> (Authentik on `/`; `/assets/favicon` public) |
| Relay | <https://relay.nerdsbythehour.com> (public, Cloudflare Tunnel, no Authentik) |
| CDA converter | In cluster only |
| Sign-in | Authentik, then YourPHR's own login |

## Where it runs / where data lives

| Item | Value |
| --- | --- |
| Host | deby, namespace `yourphr` |
| Workloads | `yourphr-ts` (3.21.0, image-automated), `yourphr-relay` (`main-N`), `yourphr-cda-converter` |
| Data | local-path PVC `yourphr-ts-data` (5Gi, under `/var/lib/rancher/k3s/storage`) |
| App backups | NAS `/mnt/tank/jims/data/archive/yourphr-backup` mounted into the pod |

## Secrets

| Secret | Where |
| --- | --- |
| Relay shared secret | OpenBao `apps/yourphr/yourphr-relay` → Secret `yourphr/yourphr-relay` |

## Dependencies

Authentik, Traefik, [cloudflared](../cloudflared/README.md), Tank NAS, provider app
registrations with callback `https://relay.nerdsbythehour.com/callback`.

## Recovery

(a) Pod broken:

```bash
kubectl -n yourphr get pods
kubectl -n yourphr rollout restart deploy/yourphr-ts deploy/yourphr-relay deploy/yourphr-cda-converter
```

(b) Data lost: restore the newest file from
`/mnt/tank/jims/data/archive/yourphr-backup` with YourPHR's restore feature,
or copy the PVC folder back from
`/deby-backup/host/daily/latest/rootfs/var/lib/rancher/k3s/storage/` with the
pod scaled to 0. Exact restore steps are Unknown — to fill in.

(c) deby rebuilt: the PVC is recreated empty (new name). Restore from the NAS
backup as in (b).

## Health checks

```bash
curl -sI https://yourphr.nerdsbythehour.com/ | head -3     # redirect to Authentik
curl -o /dev/null -w "%{http_code}\n" https://relay.nerdsbythehour.com/healthz   # 200
```

## Known gaps

- Real health data on a local-path PVC with reclaim policy `Delete`: deleting the PVC deletes the data.
- The rootfs rsync copies the live SQLite file; it may be torn. The NAS backup is the safer copy.

## For users: yourphr — personal health records

*Moved from homelab `docs/services-provided/yourphr.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Fasten is a self-hosted health record aggregator that stores and displays your medical records, lab results, prescriptions, and immunizations in one private place.

> __Note:__ We run a customised fork (`jwilleke/yourphr`) that fixes display of Veradigm/FollowMyHealth FHIR exports, which the upstream version does not handle correctly. Encounters and conditions now show their names rather than raw IDs.

### How to reach it

__URL:__ <https://yourphr.nerdsbythehour.com>

__LAN only__ — only reachable from the home network. Not accessible from the internet.

### Authentication

Login is through __Authentik__. You'll be redirected to the Authentik login page the first time; once you authenticate, the session carries over until it expires (24 hours).

### Importing health records

The self-hosted (onprem) version of Fasten __does not support automatic provider sync__. Direct SMART-on-FHIR connections to healthcare portals are a commercial Fasten Connect feature only.

To get records in, export from your provider first, then import the file:

#### Step 1 — export from your provider

| Source | How to export |
|---|---|
| FollowMyHealth / any portal with "Download my health record" | Portal UI → Health Record → Download → C-CDA XML or FHIR JSON bundle |
| Epic MyChart | MyChart → Health → Download My Record → FHIR R4 JSON |
| Veradigm / Allscripts (developer path) | Register a SMART app at developer.veradigm.com, call the FHIR R4 patient endpoint, save the Bundle JSON |

#### Step 2 — import into yourphr

1. Log in at <https://yourphr.nerdsbythehour.com>
2. __Sources → Add Source → Manual / File Upload__
3. Upload the exported FHIR Bundle JSON or C-CDA XML file

There is no ongoing sync — repeat when you want updated records.

> __After a software update to the fork:__ the database must be cleared and data re-imported to pick up display improvements. The operator handles this. Contact Jim if records look blank or show only IDs after an update.

### Your data

- All records are stored __only on the home server__ — nothing leaves the LAN except the OAuth handshake with your provider during the connect step.
- Records are kept in a SQLite database, backed up automatically to NAS on a schedule (with automatic pruning of older backups).

### Operator reference

this README

## Operator notes: yourphr — operator reference

*Moved from homelab `docs/apps/yourphr.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

[Fasten on-prem](https://github.com/fastenhealth/fasten-onprem) is a self-hosted personal health record aggregator. It stores and visualizes health records imported from healthcare providers.

> __Limitation:__ the open-source onprem build does __not__ include provider connectors. Automatic SMART-on-FHIR sync is a commercial Fasten Connect feature. Records must be exported manually from each provider (FHIR Bundle JSON or C-CDA XML) and imported via file upload. See the user doc for the import workflow.

__Deployed as:__ mj-infra-flux#99 (renamed fasten→yourphr via mj-infra-flux#103)
__Image:__ `ghcr.io/jwilleke/yourphr:main` (fork — see below)
__Manifests:__ [`mj-infra-flux/apps/production/yourphr/`](./)

### Fork

We run [`jwilleke/yourphr`](https://github.com/jwilleke/yourphr), a fork of `fastenhealth/fasten-onprem` (GPL v3). The fork adds display compatibility for non-US-Core FHIR R4 exports (specifically Veradigm/FollowMyHealth), which upstream does not handle.

__Key changes vs upstream:__

| Area | Change |
|---|---|
| `generate.go` | Added `resourceSortConfig` — per-resource JS expressions that populate `sort_title` and `sort_date` at import time. Without this, every resource displayed only its raw FHIR ID. Covers: Encounter, Condition, Procedure, Observation, DiagnosticReport, DocumentReference, MedicationRequest, Immunization, AllergyIntolerance. |
| `encounter-model.ts` | R4 `resource_class` falls back to `class.code` when `class.display` absent (Veradigm exports class with system URI only). `encounter_type` synthesised from location display when `type[]` absent. |
| CI | Upstream `docker.yaml` (depot.dev) disabled; replaced with `docker-jwilleke.yaml` using standard `docker/build-push-action`, `linux/amd64` only. |

The GitHub Actions build pushes `ghcr.io/jwilleke/yourphr:main` on every push to `main`. __After any code change to the fork, the existing database must be cleared and data re-imported__ — `sort_title`/`sort_date` are set at import time and not retroactively updated.

__Resetting the database:__

```bash
kubectl scale deploy/yourphr -n yourphr --replicas=0
kubectl run yourphr-db-reset -n yourphr --rm --restart=Never --image=alpine \
  --overrides='{"spec":{"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"yourphr-data"}}],"containers":[{"name":"yourphr-db-reset","image":"alpine","command":["/bin/sh","-c","rm -f /data/fasten.db /data/fasten.cache.db && echo done"],"volumeMounts":[{"name":"d","mountPath":"/data"}]}]}}' \
  -- /bin/sh -c "rm -f /data/fasten.db /data/fasten.cache.db && echo done"
kubectl scale deploy/yourphr -n yourphr --replicas=1
```

Then re-import via Sources → Add Source → Manual / File Upload.

### Access

| | |
|---|---|
| URL | <https://yourphr.nerdsbythehour.com> |
| Auth | Authentik forward-auth (LAN-only — no public Cloudflare DNS) |
| User doc | the "For users" section of this README |

### Architecture

```
Browser → Traefik (websecure) → Authentik forward-auth middleware
                                       ↓ (authenticated)
                              yourphr pod :8080 → /opt/fasten/db/fasten.db (PVC)
```

- __Image:__ `ghcr.io/jwilleke/yourphr:main` (fork — built by GitHub Actions on push to `jwilleke/yourphr:main`)
- __Namespace:__ `yourphr`
- __Port:__ 8080 (HTTP — required by explicit config; the container defaults to HTTPS on 9090 with no config, which causes CrashLoopBackOff)
- __Storage:__ 5 Gi PVC (`local-path`), mounted at `/opt/fasten/db/`
- __Resources:__ 100m/256Mi requests · 1 CPU/1 Gi limits

### Configuration

Fasten requires an explicit config file at `/opt/fasten/config/config.yaml` to run on HTTP. Without it the container starts HTTPS on port 9090, liveness probes fail, and the pod crash-loops.

The config is embedded in the `yourphr-config` ConfigMap (`configmap.yaml`):

```yaml
web:
  listen_type: http
  listen_addr: "0.0.0.0"
  listen_port: 8080
  jwt_expiry_hours: 24
database:
  location: /opt/fasten/db/fasten.db
cache:
  location: /opt/fasten/db/fasten.cache.db
log:
  level: INFO
```

To update the config: edit `apps/production/yourphr/configmap.yaml` directly, commit, and let Flux reconcile. The deployment uses `Recreate` strategy so the pod is replaced cleanly.

### Authentik integration

Provisioned by `apps/production/jimsmcp/setup-fasten.mjs` (idempotent).

- __Provider type:__ Proxy — `forward_single`
- __External host:__ `https://yourphr.nerdsbythehour.com`
- __Outpost:__ embedded
- __Middleware:__ `yourphr-authentik-forwardauth@kubernetescrd` (defined in `authentik-middleware.yaml`)

The ingress is LAN-only — there is no public Cloudflare DNS record for `yourphr.nerdsbythehour.com`. The cert is issued via Let's Encrypt (`letsencrypt-production`).

To re-provision Authentik after an accidental deletion:

```bash
cd ~/Documents/mj-infra-flux
node apps/production/jimsmcp/setup-fasten.mjs
```

### Backup

The hourly `backup-cronjob.yaml` (raw `cp` of the live SQLite DB) was removed 2026-06-21
(mj-infra-flux `c4d167a`), superseded by the app's own in-app scheduled backup (Admin → Database),
which uses `VACUUM INTO` + gzip for a consistent online snapshot instead of a raw file copy.

- __Where:__ Admin → Database, in the running app — enable/time-of-day/days (daily|weekly),
  destination folder, and retention (`max_backups`) are all admin-configurable there, persisted in
  `.backup_settings.json` next to the DB.
- __Destination:__ point it at `/nas-backup` — mounted in the pod (`nas-archive` volume) from the
  NAS at `192.168.68.41:/var/nfs/shared/jims` → host path `/mnt/tank/jims/data/archive/yourphr-backup/`.
- __Filenames:__ `<iso-timestamp>Z-yourphr-<label>-<version>-backup.db.gz` — `<label>` comes from
  `YOURPHR_BACKUP_LABEL` (`prod` here), so prod/dev backups are distinguishable in the shared folder.

__Known outage (2026-06-25 → 2026-07-31):__ upstream shipped a path-injection fix in v1.11.2
(`jwilleke/yourphr#383`) that confines backup destinations to an allowlist (`AllowedBackupRoots`).
A destination chosen only via the Admin UI is *not* automatically re-added to that allowlist after
an app upgrade, so every scheduled backup failed silently (`destination "/nas-backup" is outside
the allowed backup roots`, logged every ~60s, no UI-visible indication) — no backup succeeded for
over five weeks until this was noticed by reading raw pod logs. __Fix:__ the `yourphr-config`
ConfigMap now statically allowlists it:

```yaml
backup:
  allowed-roots:
    - /nas-backup
```

This survives future DB resets (the persisted Admin-UI destination does not — see above). Filed
upstream as [`jwilleke/yourphr#434`](https://github.com/jwilleke/yourphr/issues/434), asking for a
surfaced backup-health status and log-level escalation so a future regression like this doesn't
require manually reading logs to notice.

__After any config or app change touching backups:__ confirm a fresh backup actually lands —
`kubectl -n yourphr logs deploy/yourphr | grep "scheduled backup"` should show `written`, not
`failed`, and a new dated file should appear in `/mnt/tank/jims/data/archive/yourphr-backup/`.

### Health probes

- __Liveness:__ `GET /healthz :8080` — 30 s initial delay, 30 s period, 3 failures → restart
- __Readiness:__ `GET /healthz :8080` — 10 s initial delay, 10 s period

Note: `/api/v1/metadata/heartbeat` returns 404 (not a valid probe path).

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| CrashLoopBackOff on fresh deploy | Missing config file — container defaults to HTTPS on 9090 | Ensure `yourphr-config` ConfigMap is in `kustomization.yaml` and the `yourphr-config` volume/mount is in the deployment |
| 401 on every request | Authentik provider or outpost binding missing | Re-run `setup-fasten.mjs`; verify embedded outpost includes provider pk |
| `scheduled backup failed: destination ... outside the allowed backup roots` | Destination isn't in `AllowedBackupRoots` — either the static `backup.allowed-roots` config is missing it, or an Admin-UI-only destination didn't survive an app upgrade | Add the path under `backup.allowed-roots` in the `yourphr-config` ConfigMap (static, upgrade-proof) rather than relying solely on the Admin UI selection |
| Scheduled backup not writing at all | NAS mount not present on the node | Check `hostPath` `/mnt/tank/jims/data/archive/yourphr-backup` exists; NFS mount (`192.168.68.41:/var/nfs/shared/jims`) may have dropped |
| `/healthz` 5xx | Pod started but DB not yet writeable | Wait for readiness; check PVC is bound (`kubectl -n yourphr get pvc`) |

Logs: `kubectl -n yourphr logs deploy/yourphr`
