# OpenBao (stuff.nerdsbythehour.com)

Central secrets store for the deby cluster. External Secrets Operator copies
secrets into Kubernetes Secrets. Git holds no secret values, encrypted or
otherwise.

- URL: `https://stuff.nerdsbythehour.com` (LAN/VPN only)
- Login: Authentik OIDC, group `mj`
- In-cluster API, used by ESO: `http://openbao.openbao.svc.cluster.local:8200`
- Data: raft on `/mnt/local-k3s-data/openbao/data` (hostPath PV, Retain, prune disabled)
- Snapshots: CronJob `openbao-snapshot` to `/mnt/tank/jims/data/systems/openbao-snapshots`
- Unseal: static key in Secret `openbao-unseal-key`, created by hand, never in Git

Flux order, so a sealed store does not stop apps:

```text
infra-configs ──────────────► openbao
infra-controllers (ESO) ─► secret-stores (wait: false) ─► apps
```

`apps` depends on `infra-controllers` and `secret-stores`. It does not depend
on `openbao`. `secret-stores` does not wait for OpenBao to be healthy.
Every ExternalSecret uses `deletionPolicy: Retain`. An outage freezes
refreshes. It does not delete the last good Secret.

## Apply in order

Do not point Flux at the tip of this change and walk away. Phase 2 removes
the Secrets apps are running with. ESO can recreate them only after the
values are in OpenBao.

1. Suspend `apps` and `infra-configs` so a later commit cannot prune Secrets
   while you are still loading OpenBao:

   ```sh
   flux suspend kustomization apps
   flux suspend kustomization infra-configs
   ```

2. Create the unseal Secret (next section) before reconciling `openbao`.
   The pod mounts that Secret. Without it the StatefulSet never becomes Ready.

3. Reconcile Phase 1 (`infra-controllers`, `openbao`, `secret-stores`, and the
   Prometheus rules that ride in with `apps` only after you resume it).
   `infra-controllers` first. Then `openbao`.

4. Run `scripts/openbao-bootstrap.sh` from a workstation with cluster-admin.
   It inits OpenBao, configures Kubernetes auth and Authentik OIDC, generates
   new database passwords, and copies every other live Secret into OpenBao.

5. Resume and reconcile Phase 2. ExternalSecrets replace the git Secrets.
   Then Phase 3, which deletes SOPS decryption. Decryption has to stay until
   every encrypted file is gone, or Flux applies ciphertext.

   ```sh
   flux resume kustomization infra-configs
   flux resume kustomization apps
   flux reconcile kustomization apps --with-source
   ```

Rollback before Phase 2: revert the Phase 1 commit and delete the namespace
`openbao` plus the ESO install if you want it gone. App Secrets are untouched.
Rollback after Phase 2: ExternalSecrets own the Secrets. Reverting the git
objects makes Flux prune them unless you have already removed the
ExternalSecrets and kept `deletionPolicy: Retain` long enough to copy the
live Secret aside. Take `kubectl get secret -o yaml` copies before Phase 2
if you want a local rollback that does not depend on OpenBao.

## The unseal key

This is the only bootstrap secret. Lose it and the raft data and every
snapshot are unreadable. There is no second share.

1. It is never in Git. No SOPS object, no ExternalSecret. It cannot come
   from the store it unlocks.
2. Keep one break-glass record named "deby OpenBao break-glass". It holds
   the base64 key, the key id `deby-2026-10`, and the recovery key printed
   once by `bao operator init`.
3. Two offline copies of that record:
   - Jim's password manager. It must be one that is not hosted on this
     cluster.
   - A paper copy (base64 and a QR of the same line) in the safe.
4. In the cluster it is only Secret `openbao/openbao-unseal-key`. Only the
   OpenBao pod mounts it. Turn on k3s encryption at rest so etcd is not a
   second plaintext copy: `k3s secrets-encrypt enable`. k3s keeps that key
   on the node. There is no new human key.

Create it once, from the laptop, before the first OpenBao reconcile:

```sh
umask 077
openssl rand -out /dev/shm/openbao-unseal.key 32
base64 < /dev/shm/openbao-unseal.key
kubectl create namespace openbao --dry-run=client -o yaml | kubectl apply -f -
kubectl -n openbao create secret generic openbao-unseal-key \
  --from-file=key=/dev/shm/openbao-unseal.key
shred -u /dev/shm/openbao-unseal.key
```

Put the base64 line into both offline copies, then close the terminal.

### Break-glass

OIDC down, or Authentik down, and you still need an admin token:

1. Read the recovery key from the password manager or the paper copy.
2. `bao operator generate-root` with that recovery key. This needs the
   unseal key only in the sense that OpenBao must already be unsealed.
   A reboot unseals itself from `openbao-unseal-key`.
3. Fix OIDC. Revoke the generated root token.

Unseal key lost: the data is gone. Build an empty store only if you also
have every app secret somewhere else. You do not, if the offline copies
are gone. That is the whole risk.

Restore onto a rebuilt node:

1. `flux bootstrap` this repo.
2. Recreate `openbao-unseal-key` from the break-glass record
   (`base64 -d` into `--from-file=key=`).
3. Flux starts OpenBao. The static seal unseals it. The raft directory is
   empty, so it is a new cluster until the next step.
4. `bao operator raft snapshot restore -force` the newest
   `openbao-*.snap` from the NAS directory.
5. ESO refreshes app Secrets. No second human secret.

## LAN DNS and the allowlist

Do not publish `stuff.nerdsbythehour.com` in Cloudflare or any public DNS.
Add it on the UDM (or whichever resolver the LAN and the VPN use) to
`192.168.68.71`.

Traefik middleware `openbao/lan-only` allows `192.168.68.0/24` plus the
placeholder `TODO-VPN-SUBNET`. Replace that placeholder with the VPN client
subnet before this is applied. Traefik rejects the Middleware until you do,
and this hostname stays closed. Other Ingresses do not use the Middleware.

The field is `ipAllowList` (Traefik v3). This repo does not pin the k3s
version. The bundled chart is what serves traffic
(`infrastructure/base/configs/traefik-client-ip/helmchartconfig.yaml` sets
`externalTrafficPolicy: Local` and no chart version). The unused
`apps/base/traefik-ingress` chart pin `v23.0.1` is Traefik 2.10 and is not
Flux-reconciled. k3s 1.32.2 and later bundle Traefik v3. If `deby` is older
than 1.32, rename the field to `ipWhiteList` before apply.

## Trust the internal CA

cert-manager is already installed by hand (it is not a Flux Kustomization).
This path adds a self-signed Issuer, a root CA Certificate, ClusterIssuer
`deby-internal-ca`, and the leaf for `stuff.nerdsbythehour.com`. The leaf
is what Traefik serves. ESO does not need the CA. Browsers and `bao` on a
laptop do.

Export the root (the secret lives in `cert-manager`, which is where a
ClusterIssuer looks):

```sh
kubectl -n cert-manager get secret deby-internal-root-ca \
  -o jsonpath='{.data.ca\.crt}' | base64 -d > deby-internal-root-ca.crt
```

macOS, system trust so Safari and `bao` both see it:

```sh
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain deby-internal-root-ca.crt
```

Or Keychain Access: import the file into the System keychain, open it, set
Secure Sockets Layer to Always Trust.

iPhone:

1. AirDrop `deby-internal-root-ca.crt`, or mail it to yourself, and open it.
2. Settings, General, VPN & Device Management. Install the profile.
3. Settings, General, About, Certificate Trust Settings. Enable full trust
   for `deby-internal-root-ca`. Installing the profile is not enough. iOS
   will not use it for TLS until that switch is on.

Android:

1. Settings, Security, Encryption & credentials, Install a certificate,
   CA certificate. Confirm the warning and pick the file.
2. User-installed CAs are trusted by Chrome. Many other apps ignore user
   CAs and only trust the system store. A root pushed by a device policy
   is the way those apps will trust this host. The OpenBao UI in Chrome
   works after the user CA install.

`bao` on a laptop:

```sh
export BAO_ADDR=https://stuff.nerdsbythehour.com
export BAO_CACERT="$HOME/deby-internal-root-ca.crt"
bao login -method=oidc role=mj
```

## Snapshots and what is not backed up

No manifest in this repo copies `/mnt/local-k3s-data`. The OpenBao PV lives
there. `apps/production/messaging/README.md` says the host script
`backup-deby.sh` rsyncs that tree (it cites `jwilleke/deby` issue 16). That
script is not in this repo, so this repo cannot show that the path is
actually included. Treat the local raft directory as not backed up.

The CronJob writes raft snapshots to
`/mnt/tank/jims/data/systems/openbao-snapshots`. That is the NAS tree the
host job `nas-backup-rsync` is documented to copy onto the `nas-backup` pool
(`apps/production/monitoring/prometheus/config/alerting-rules.nas-backup-rsync.yaml`).
The job itself is not in this repo. Jim has to:

1. Create the directory before the first run. The volume type is `Directory`,
   so a missing path fails the Job instead of creating a root-owned folder.

   ```sh
   sudo mkdir -p /mnt/tank/jims/data/systems/openbao-snapshots
   sudo chown 3003:3003 /mnt/tank/jims/data/systems/openbao-snapshots
   sudo chmod 0700 /mnt/tank/jims/data/systems/openbao-snapshots
   ```

2. Confirm `nas-backup-rsync` really copies that directory, and note what
   time it runs. The CronJob is `17 2 * * *` UTC. A snapshot file still
   being written at rsync time is a partial file.

Snapshots are sealed with the same unseal key. A snapshot without the
break-glass record is useless.

## Authentik

Provider slug `openbao`. Redirect URIs:

- `https://stuff.nerdsbythehour.com/ui/vault/auth/oidc/oidc/callback`
- `http://localhost:8250/oidc/callback` (the CLI listener)

Include the `groups` scope, and a groups claim named `groups`. The role `mj`
requires group `mj`. The client secret is typed into `openbao-bootstrap.sh`
and stored in OpenBao's OIDC config. It is not a Kubernetes Secret.

## What moved, and what was already broken

`apps/production/database/postgresql-secret.yaml` and
`apps/production/teslamate/teslamate-secret.yaml` were plaintext `changeme`
values in Git. Flux re-applied them. The bootstrap script generates new
passwords, writes them to OpenBao, and runs `ALTER USER` for `postgres` and
`teslamate`. The TeslaMate `encryption-key` is also new. TeslaMate data
encrypted with the old key will not open. Re-link the Tesla account after
Phase 2. Those `changeme` strings stay in git history. Rotating the live
value does not erase them.

`infrastructure/base/configs/image-scanning-webhook-receiver/.env.secret.webhook-token.encrypted`
is SOPS dotenv sealed to age recipient `age1nur86…`, which this repo already
treats as unavailable. `clusters/deby/infra.yaml` has no `decryption` block.
Kustomize `secretGenerator` therefore stores the `token` value as the
`ENC[...]` ciphertext, plus the `sops_*` metadata lines as extra keys. The
Flux Receiver is checking GitHub against ciphertext. The bootstrap script
writes a new token. Paste it into the GitHub webhook. There is no old
plaintext to recover from here.

Every other SOPS file and encrypted env under the Flux paths is copied by
the same script, then replaced by an ExternalSecret. Copying is not
rotation. Re-issue those values. The age key can be destroyed after that,
not before.

Left as cluster-only Secrets, still not in Git: `netalertx-api-token`,
`homeassistant-api-token`, and the optional `geohazardwatch-secrets`.

## Workstation MCP token

`/.env.secret.mcp-authentik.encrypted` is a laptop secret, not a cluster
one. The bootstrap loads it into `kv/deby/workstation/mcp-authentik` when
`sops` and the file are both present. After that, `scripts/update-mcp-config.sh`
reads OpenBao. Log in with OIDC first (`BAO_ADDR`, `BAO_CACERT`).
