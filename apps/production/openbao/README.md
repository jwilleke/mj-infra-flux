# OpenBao

Secrets store for programs: apps, scripts, and agents. Human passwords stay
in a password manager. Apps keep reading Kubernetes env and config. OpenBao
only supplies those values, later, through External Secrets. Turning OpenBao
off leaves the apps as they are.

This change installs OpenBao and External Secrets Operator. It does not
migrate any secret. SOPS stays, including Authentik and the age key used to
start the cluster.

- __URL__: `https://stuff.nerdsbythehour.com` (LAN and VPN only)
- __Namespace__: `openbao`
- __Chart__: official `openbao` chart `0.30.6`, app image `quay.io/openbao/openbao:2.7.2`
- __In-cluster API__ (ESO): `http://openbao.openbao.svc.cluster.local:8200`
- __Run as__: uid/gid 3003

## Data paths

| What | Where |
| --- | --- |
| Raft | hostPath PV `/mnt/local-k3s-data/openbao` (`storageClassName: ""`, Retain) |
| Audit log | hostPath PV `/mnt/local-k3s-data/openbao-audit` |
| Raft snapshots | `/mnt/local-k3s-data/openbao-snapshots` (CronJob, swept by `backup-deby.sh`) |
| Unseal key file | `/mnt/tank/jims/data/systems/deby/openbao/unseal.key` (NAS `jims` share, mounted read-only) |

`backup-deby.sh` also rsyncs the live raft directory because it lives under
`/mnt/local-k3s-data`. That copy can be torn. Restore from a snapshot file,
not from the live directory.

The unseal key is not under `/mnt/local-k3s-data`. The host script
`/usr/local/bin/nas-backup-rsync.sh` excludes `/data/systems/deby/openbao/`
so the key is not copied onto deby's backup pool. The same exclude still
needs to land in the `jwilleke/deby` copy of that script. This repo does
not contain that script.

## Dependencies

- cert-manager ClusterIssuer `letsencrypt-production` (Cloudflare DNS-01)
- Traefik 3.7 with `externalTrafficPolicy: Local`
- The NAS export already mounted on deby at `/mnt/tank/jims`
- Authentik at `https://auth.nerdsbythehour.com` for human login, after init
- External Secrets Operator (chart 2.14.0), installed beside this app

Flux order. `apps` depends on none of these:

```text
openbao
external-secrets ──► openbao-secret-store (wait: false)
apps   (unchanged; does not wait on OpenBao)
```

`clusters/deby/openbao-secret-store.yaml` sets `wait: false`. A sealed
OpenBao makes the `ClusterSecretStore` NotReady and does not stall `apps`.

## Configuration

Single raft node. The chart's standalone mode uses pebbledb, which cannot
`bao operator raft snapshot`. The release sets `server.ha.raft` with
`replicas: 1`.

TLS ends at Traefik. The pod listens on HTTP. ESO uses that in-cluster
address. The IngressRoute allows `192.168.68.0/24` and `192.168.11.0/24`
(`ipAllowList`). There is no Cloudflare tunnel route and no public DNS.

Prometheus scrapes `http://openbao.openbao.svc.cluster.local:8200/v1/sys/metrics?format=prometheus`.
Rules `OpenBaoSealed` and `OpenBaoScrapeDown` live in
`apps/production/monitoring/prometheus/config/`.

## Seal

OpenBao 2.7.2 unseals from a key file with the built-in __static__ seal
(`seal "static"`, `current_key = "file:///..."`). No plugin. Shamir would
wait for an operator. Transit, PKCS#11, and cloud KMS need a second trust
service this homelab does not have. `env://` would put the key in the
process environment, which on Kubernetes means a Secret. k3s encryption at
rest is off, so the key stays a file on the NAS mount.

The key id in `helmrelease.yaml` is `deby-2026-11`. That id is permanent
for this key. The ConfigMap stores the path and the id, not the key bytes.

Accepted costs: if the NAS is down when the pod starts, the hostPath is
`type: Directory` and the pod stays Pending. Root on a running deby can
read the key file. The `jims` mount is read-write and shared with the rest
of that export.

## Secrets

Nothing in git is a secret value. The unseal key is not a Kubernetes Secret
and not SOPS. The Authentik OIDC client secret is typed into
`scripts/openbao-bootstrap.sh` at init and stored in OpenBao's OIDC config.

Bootstrap policies, written by that script, not by a manifest:

| Who | Auth | Policy |
| --- | --- | --- |
| Jim (UI and `bao`) | OIDC via Authentik, group `mj` | `admin` |
| External Secrets | Kubernetes auth, role `external-secrets` | read `kv/data/apps/*` and `kv/data/ngdpbase/*` |
| Snapshot CronJob | Kubernetes auth, role `raft-snapshot` | read `sys/storage/raft/snapshot` |
| One agent | AppRole, token TTL 1h | read one logical path |

The ESO policy is broad on purpose until the first migration. No
`ExternalSecret` exists yet. When one is added, narrow the role to that
app and set `deletionPolicy: Retain` on the ExternalSecret. Copying a
value into OpenBao is not rotation. Do not put the Flux bootstrap token
in OpenBao. Do not rotate TeslaMate's `encryption-key` as part of a copy:
existing Tesla data would become unreadable.

## One-time init on deby

Do this after the merge is on `master` and Flux has applied it. Until the
key file exists the pod crash-loops. Readiness treats sealed and
uninitialized as healthy, so a pod that can read the key becomes Ready
before `bao operator init`.

### 1. Key file and snapshot directory

On deby, as `jim` (no sudo for the NAS part). The same folder on a Mac is
`/Volumes/jims/data/systems/deby/openbao/`.

The NAS squashes every client user (files show as `977:988`), so `chown` on
the share fails with "Operation not permitted" (tested 2026-11-01). That is
fine: the pod (uid 3003) can still read the file. The trade-off is that
anyone who can mount the `jims` share can also read the key. Accepted for a
one-person LAN.

```bash
mkdir -p /mnt/tank/jims/data/systems/deby/openbao
chmod 0750 /mnt/tank/jims/data/systems/deby/openbao
umask 077
openssl rand -out /mnt/tank/jims/data/systems/deby/openbao/unseal.key 32
chmod 0440 /mnt/tank/jims/data/systems/deby/openbao/unseal.key
sudo mkdir -p /mnt/local-k3s-data/openbao-snapshots
sudo chown 3003:3003 /mnt/local-k3s-data/openbao-snapshots
sudo chmod 0700 /mnt/local-k3s-data/openbao-snapshots
base64 /mnt/tank/jims/data/systems/deby/openbao/unseal.key
```

### 2. LastPass secure note

Create a secure note named `deby OpenBao break-glass`. Put in it:

- key id `deby-2026-11`
- the base64 line from the command above (the unseal key, not a password)
- the recovery key the bootstrap script prints on first init
- the root token, unless you revoked it at the end of that same session after an OIDC login worked

Clear the terminal scrollback after the note is saved. Losing both copies
of the unseal key loses the data. The recovery key is how you mint a root
token when Authentik is down. It does not unseal the store.

### 3. LAN DNS

On the UDM, `stuff.nerdsbythehour.com` to `192.168.68.71`. Do not publish
that name in Cloudflare or any public DNS. Certificate issuance is DNS-01
and does not need an A record. The name still shows up in public
certificate logs.

### 4. Bootstrap

From a machine with kubectl to the cluster, after `openbao-0` is Running:

```bash
kubectl -n openbao rollout status statefulset/openbao
scripts/openbao-bootstrap.sh
```

The script enables `kv` v2, kubernetes auth, AppRole, and the file audit
device. It prompts for the Authentik client id and secret. It does not
copy any existing secret. Re-running it leaves an initialized store and
an existing OIDC mount alone. Export `BAO_TOKEN` for that second run.

Create the Authentik provider before answering the prompt:

- Application slug `openbao` (discovery URL `https://auth.nerdsbythehour.com/application/o/openbao/`)
- Confidential OAuth2/OIDC client
- Redirect URIs `https://stuff.nerdsbythehour.com/ui/vault/auth/oidc/oidc/callback` and `http://localhost:8250/oidc/callback`
- Scopes include Authentik's groups scope, claim name `groups`
- Your user is in group `mj` (override with `OPENBAO_OIDC_GROUP`)

Skip the prompt with `OPENBAO_SKIP_OIDC=1`. The script then prints the
root token once so you can put it in the LastPass note.

### 5. Check

- From the LAN or the VPN, open `https://stuff.nerdsbythehour.com` and log in with Authentik.
- CLI: `BAO_ADDR=https://stuff.nerdsbythehour.com bao login -method=oidc role=mj`
- `kubectl -n openbao create job --from=cronjob/openbao-snapshot openbao-snapshot-once` and confirm a file under `/mnt/local-k3s-data/openbao-snapshots`.
- Prometheus target `openbao` is up. `OpenBaoScrapeDown` fires if the process stays down for 15 minutes. That is expected until the pod is actually up.

### AppRole for an agent

After init, still with `BAO_TOKEN` set:

```bash
scripts/openbao-bootstrap.sh approle ngdp-autoupdate ngdpbase/jimstest/page-token
```

The first run prints `role_id` and one `secret_id`. A later run prints
`role_id` only. `--mint` adds another `secret_id`. Token TTL is 1 hour,
max 4 hours. Store the ids with the agent, not in git.

## Break-glass

OIDC down, or Authentik down, and you still need an admin token:

1. The store must already be unsealed. A restart unseals from the NAS key file. The recovery key does not unseal.
2. Read the recovery key from the LastPass note.
3. `bao operator generate-root` with that recovery key.
4. Fix OIDC. Revoke the generated root token.

Unseal key file lost, LastPass copy still there: decode it back to the NAS path, restart the pod. See recovery case 1.

## Recovery

### NAS key lost, LastPass copy OK

Restore the file to `/mnt/tank/jims/data/systems/deby/openbao/unseal.key` (mode `0440`, group 988 as the NAS assigns; the pod reads it via supplementalGroups 988) and restart the pod. It auto-unseals. No data is lost.

```bash
umask 077
base64 -d > /tmp/unseal.key
mv /tmp/unseal.key /mnt/tank/jims/data/systems/deby/openbao/unseal.key
chmod 0440 /mnt/tank/jims/data/systems/deby/openbao/unseal.key
kubectl -n openbao delete pod openbao-0
```

`base64 -d` reads the LastPass line from stdin. Do not write that line into a file you keep.

### deby lost, snapshots OK

Rebuild the host, mount `jims` at `/mnt/tank/jims`, and restore `/mnt/local-k3s-data/openbao-snapshots` from the `backup-deby` pool. Flux reinstalls OpenBao. The new raft directory is empty, so init once (the script prints a new recovery key; you will throw it away), then restore the newest snapshot. The snapshot is sealed with the NAS key, so that key must be the same file. After restore, the fresh init is gone: use the original recovery key from LastPass, not the one from the throwaway init.

```bash
SNAP=/mnt/local-k3s-data/openbao-snapshots/openbao-YYYYMMDDTHHMMSSZ.snap
kubectl -n openbao cp "$SNAP" openbao-0:/tmp/restore.snap
kubectl -n openbao exec openbao-0 -- env BAO_TOKEN="$BAO_TOKEN" bao operator raft snapshot restore -force /tmp/restore.snap
```

### Both key copies lost, or deby and its snapshots lost

The data is unrecoverable. Start a fresh OpenBao (new key file, new init) and re-issue every secret from its source. The inventory below is that list. It never holds values.

## Secret inventory

Name, source, and how to re-issue. Never the value. Empty until a later
change loads something. Add a row in the same commit that puts the value
in OpenBao.

| Name | Source | How to re-issue |
| --- | --- | --- |
| `kv/apps/<app>/<name>` | the system that issued it | re-issue there, then `bao kv put kv/apps/<app>/<name>` |
| `kv/ngdpbase/<path>` | the system that issued it | re-issue there, then `bao kv put` |
| `kv/apps/database/postgresql` (`postgres-password`, `teslamate-password`) | PostgreSQL roles `postgres`, `teslamate` | `ALTER ROLE ... PASSWORD`, then `bao kv put` |
| `kv/apps/teslamate/teslamate` (`encryption-key`, `database-password`) | TeslaMate; `database-password` = `teslamate-password` | DB pw as above; never rotate `encryption-key` casually |
| `kv/apps/yourphr/yourphr-relay` (`YOURPHR_RELAY_SECRET`) | copied from the live Secret | re-issue at the source, then `bao kv put` |
| `kv/apps/monitoring/grafana-oauth` (`client-secret`) | copied from the live Secret | re-issue at the source, then `bao kv put` |
| `kv/apps/cert-manager/cloudflare-api-token` (`api-token`) | copied from the live Secret | re-issue at the source, then `bao kv put` |

## Snapshots

CronJob `openbao-snapshot` at 17:17 UTC writes
`/mnt/local-k3s-data/openbao-snapshots/openbao-<utc>.snap` and deletes
files older than 30 days. `backup-deby.sh` runs at 21:01 local and sweeps
that directory. Kubernetes CronJobs use UTC. If 17:17 UTC is after 21:01
on the host clock, move `schedule` in `snapshot-cronjob.yaml` so the file
is closed before the rsync.

The Job logs in with its ServiceAccount. It fails until
`scripts/openbao-bootstrap.sh` has created the `raft-snapshot` role.
`CronJobNoRecentSuccess` may fire until the first success. The snapshot
directory must exist before the first run (`type: Directory`).

## Audit log

File device at `/openbao/audit/audit.log` on the audit PV. Bootstrap
enables it. If that file cannot be written (disk full), OpenBao refuses
requests. Free space on `/mnt/local-k3s-data/openbao-audit` from the host.
The audit log can contain request paths. It is on the disk `backup-deby.sh`
sweeps.

## Turn OpenBao off

Apps do not read OpenBao. No ExternalSecret is installed. SOPS still
feeds startup secrets. To stop the store:

```bash
flux suspend kustomization openbao
flux suspend kustomization openbao-secret-store
flux suspend kustomization external-secrets
```

`apps` keeps reconciling. The ESO webhook validates ExternalSecret and
SecretStore objects only. Suspending the operator does not block ordinary
Secrets. Resume with `flux resume kustomization <name>`.

The data and audit PVs are marked prune disabled. Deleting the manifests
does not delete those volumes. Remove the PVCs yourself only when you
mean to wipe the raft data.

## Deployment

Flux applies `clusters/deby/openbao.yaml` from `master`. There is no
separate apply step. Useful checks:

```bash
flux get kustomization openbao external-secrets openbao-secret-store
kubectl -n openbao get pods,pvc
kubectl -n external-secrets get pods
kubectl get clustersecretstore openbao
```

The ClusterSecretStore stays NotReady until bootstrap has created the
kubernetes role. That is expected, and `wait: false` keeps it from
failing the Flux object.

## Troubleshooting

- Pod Pending, event mentions the unseal hostPath. The directory
  `/mnt/tank/jims/data/systems/deby/openbao` is missing or the NAS mount
  is down. Create the directory, or wait for NFS, then the pod starts.
- Pod CrashLoop, log says it cannot read the seal key. The file is
  missing, not 32 bytes, or not readable by uid 3003.
- `OpenBaoSealed` for 5 minutes. The process is up and sealed. The key
  id or the key bytes do not match the data. Restore the LastPass copy
  if the file was replaced. If both copies are gone, the data is gone.
- UI certificate missing. DNS-01 needs the Cloudflare token that cert-manager
  already uses. The LAN A record is not what issues the certificate.
- Middleware blocks you. Your address is outside `192.168.68.0/24` and
  `192.168.11.0/24`. Traefik must see the real client IP
  (`externalTrafficPolicy: Local`).
- Snapshot Job cannot log in. Run the bootstrap script so role
  `raft-snapshot` exists.

## Note: minting a root token from the recovery key

OpenBao 2.5.3+ disables the unauthenticated `sys/generate-root` endpoints by
default (`disable_unauthed_generate_root_endpoints = true` on the listener),
so `bao operator generate-root` with only the recovery key returns 403. To use
the recovery key: temporarily set that listener option to `false` in
`helmrelease.yaml`, reconcile, generate the root token, then revert.
