# Authentik SSO Setup Guide

## Current Status

✅ __Completed:__

- Authentik deployed via Flux at <https://auth.nerdsbythehour.com>
- PostgreSQL and Redis persistence configured
- Let's Encrypt certificate issued
- Traefik ForwardAuth middleware created
- DNS records configured for the `auth` subdomain

> __Note:__ This guide was originally written using Filebrowser as the worked example for an Authentik-protected application. That deployment was removed on 2026-05-05 (the SMB stack it served was orphaned — see the related cleanup commit). The Step 1 / Step 2 / Step 3 instructions below still reference Filebrowser by name; treat them as historical reference for the shape of the setup, and substitute your own application's name and URLs when adapting.

🔧 __Pending Configuration:__

- Complete OAuth2/Proxy Provider setup in Authentik UI (steps below)
- Test authentication flow

## Initial Setup

1. Access Authentik at: <https://auth.nerdsbythehour.com/if/flow/initial-setup/>
2. Set password for the default `akadmin` user
3. Login with `akadmin` credentials

## Configure OAuth2/Proxy Provider for Traefik ForwardAuth

__To access the Admin Interface:__

- Click on your username in the top right corner
- Select __Admin Interface__ from the dropdown
- OR directly access: <https://auth.nerdsbythehour.com/if/admin/>

### Step 1: Create Provider

1. In the Admin Interface, go to __Applications__ → __Providers__
2. Click __Create__ → Select __Proxy Provider__
3. Configure:
   - __Name__: `Filebrowser Forward Auth`
   - __Authorization flow__: `default-provider-authorization-implicit-consent`
   - __Type__: `Forward auth (single application)` or `Proxy` (depending on your version)
   - __External host__: `https://filebrowser.nerdsbythehour.com` ⚠️ __IMPORTANT: Use the protected app domain, NOT auth.nerdsbythehour.com__
   - __Internal host__: Leave empty or use `http://smb-filebrowser.default.svc.cluster.local`
   - __Token validity__: `hours=24` (or your preference)
4. Click __Finish__
5. __IMPORTANT__: Client ID and Client Secret may be displayed
   - __DO NOT commit these to the repository__
   - __DO NOT share these credentials__
   - Store them securely if needed for other integrations
   - For Traefik ForwardAuth, these are NOT required in the middleware configuration

### Step 2: Create Application

1. Go to __Applications__ → __Applications__
2. Click __Create__
3. Configure:
   - __Name__: `Filebrowser`
   - __Slug__: `filebrowser`
   - __Provider__: Select the provider created in Step 1 (`Filebrowser Forward Auth`)
4. Click __Create__

### Step 3: Create Outpost

1. Go to __Admin Interface__ → __Outposts__
2. Click __Create__ (or edit the existing `authentik Embedded Outpost`)
3. Configure:
   - __Name__: `authentik Embedded Outpost` (or create new)
   - __Type__: `Proxy`
   - __Applications__: Select `Filebrowser`
4. Click __Create__ or __Update__
5. ⚠️ __IMPORTANT__: After creating, check if an ingress was auto-created for filebrowser.nerdsbythehour.com
   - If an ingress `ak-outpost-*` appears for filebrowser, __DELETE IT__ - we already have our own ingress configured

## Traefik ForwardAuth Middleware

The ForwardAuth middleware has been created in the cluster. To protect a service:

1. Add the middleware annotation to your Ingress:

   ```yaml
   annotations:
     traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd
   ```

## Protected Services

Other services in the cluster apply the Authentik ForwardAuth middleware directly via their ingress annotation (`traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd`); see the example in `apps/production/jimsmcp/ingress.yaml`. The original Filebrowser worked-example deployment was removed on 2026-05-05.

Unprotected (accessible without login):

- __Whoami__: <https://nerdsbythehour.com> and <https://deby.nerdsbythehour.com>

## Important URLs

- __Authentik Setup__: <https://auth.nerdsbythehour.com/if/flow/initial-setup/>
- __Authentik Admin Portal__: <https://auth.nerdsbythehour.com/if/admin/>

## Default Credentials

- __Authentik Admin__: `akadmin` (set password on first login)

## DNS Configuration

All DNS records are configured in Cloudflare with Proxy enabled (orange cloud):

- auth.nerdsbythehour.com → Cloudflare Proxy → 174.105.183.192 → 192.168.68.71

## Troubleshooting

### "Not Found" Error from Authentik

If you see an Authentik-branded "Not Found" page when accessing a protected service:

- ✅ __Good__: ForwardAuth middleware is working and intercepting requests
- ❌ __Issue__: OAuth2/Proxy Provider configuration is incomplete or missing

__Solution__: Complete the provider, application, and outpost setup in the Admin Interface.

### Version-Specific UI Differences

You're running Authentik __2025.10.1__. The UI and options may differ from older guides:

- Look for "Proxy" or "Forward auth" when creating providers
- Some versions have "Forward auth (single application)" vs "Forward auth (domain level)"
- Use "Forward auth (single application)" if available

## Operations summary

*Moved from homelab `network/apps/authentik.md` (last changed 2026-11-23) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Authentik is the login server for the home network. Most `*.nerdsbythehour.com`
apps send you to it before they let you in.

### What it is and does

Authentik checks who you are (password plus passkey) and then lets you into
other apps. It does this two ways: as a Traefik forward-auth gate in front of
apps that have no login of their own (TeslaMate, Prometheus, NetAlertX, the
Traefik dashboard, YourPHR, jimsmcp), and as an OpenID Connect provider for apps
that can use it directly (Grafana, Home Assistant, OpenBao). Its user library
at `/if/user/#/library` is the "members" page for the site.

### Access

| Item | Value |
| --- | --- |
| URL | <https://auth.nerdsbythehour.com> |
| Reach | LAN only (DNS points at deby, `192.168.68.71`; no tunnel route) |
| Sign-in | Authentik user and password, passkey (blueprint `authentik-blueprint-passkeys`) |
| Shortcut | <https://nerdsbythehour.com/members> redirects to the user library |

### Where it runs / where data lives

| Item | Value |
| --- | --- |
| Host | deby, k3s namespace `authentik` |
| Deploy | Flux HelmRelease `authentik` (chart 2026.8.3), repo path `apps/production/authentik` |
| Database | Bundled PostgreSQL 17 StatefulSet `authentik-postgresql`, PVC `data-authentik-postgresql-0` (local-path 8Gi, under `/var/lib/rancher/k3s/storage/`) |
| Cache | Redis, PVC `redis-data-authentik-redis-master-0` (local-path 2Gi) |
| Backup | Nightly `pg_dumpall` by `backup-deby.sh` to `/deby-backup/host/daily/<date>/dumps/authentik-postgres-all.sql.gz` (21:01 ET) |

The forward-auth Middleware `authentik-forwardauth` is copied into the
`authentik`, `monitoring`, `netalertx-proxy`, `teslamate`, `kube-system` and
`yourphr` namespaces.

### Secrets

| Secret | Where |
| --- | --- |
| Authentik secret key, Postgres password | SOPS file `apps/production/authentik/authentik-secrets.sops.yaml` → Secret `authentik/authentik-secrets`, keys `secret_key`, `postgresql_password` |
| SOPS key that decrypts it | See [docs/secrets.md](https://github.com/jwilleke/homelab/blob/master/docs/secrets.md) |
| OIDC client secrets for Grafana / HA | Stored in Authentik itself; copies in OpenBao `apps/monitoring/grafana-oauth` and HA `/config/secrets.yaml` |

### Dependencies

- Traefik and cert-manager (TLS for `auth.nerdsbythehour.com`)
- SOPS age key in `flux-system/sops-age` (Authentik is deliberately not on OpenBao, so it can come up first)
- Everything behind forward-auth or OIDC depends on Authentik

### Recovery

Run on deby: `ssh deby`, then `export KUBECONFIG=$HOME/.kube/config`.

(a) Pod broken:

```bash
kubectl -n authentik get pods
kubectl -n authentik logs deploy/authentik-server --tail=100
flux reconcile helmrelease authentik -n authentik
kubectl -n authentik rollout restart deploy/authentik-server deploy/authentik-worker
```

(b) Data lost (database gone or corrupt):

```bash
B=/deby-backup/host/daily/latest/dumps
zcat $B/authentik-postgres-all.sql.gz | \
  kubectl -n authentik exec -i authentik-postgresql-0 -- \
  sh -c 'PGPASSWORD=$(cat /opt/bitnami/postgresql/secrets/password) psql -U authentik -d postgres'
kubectl -n authentik rollout restart deploy/authentik-server deploy/authentik-worker
```

(c) deby rebuilt: follow [docs/restores/deby-backup.md](https://github.com/jwilleke/homelab/blob/master/docs/restores/deby-backup.md). Put
the age key back as `flux-system/sops-age` before `flux bootstrap`, let Flux
create the release, then restore the dump as in (b).

### Health checks

```bash
curl -sI https://auth.nerdsbythehour.com/ | head -3     # 302 to /flows/-/default/authentication/
kubectl -n authentik get helmrelease,pods
```

### Known gaps

- If Authentik is down you cannot sign in to any forward-auth app. There is no break-glass path documented here. Unknown — to fill in.
- The Postgres PVC is excluded from the file backup on purpose; only the logical dump protects it.
- Which users, groups and applications exist lives only in the database, not in git (apart from the passkeys blueprint).

## For users: SSO — auth.nerdsbythehour.com

*Moved from homelab `docs/services-provided/authentik.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Authentik is the single sign-on (SSO) portal for all protected services. Log in here once and all Authentik-protected services share your session.

### How to reach it

__URL:__ <https://auth.nerdsbythehour.com>

LAN only. Public DNS (checked 2026-11-23 with `dig @1.1.1.1`) points this name at deby, `192.168.68.71`, so it is not reachable from the internet. (The older homelab page said it was public via Cloudflare.)

### Authentication

| What | Detail |
|---|---|
| Admin account | `akadmin` (set password on first login at `/if/flow/initial-setup/`) |
| User library | <https://auth.nerdsbythehour.com/if/user/#/library> — lists every app you have access to |
| Admin portal | <https://auth.nerdsbythehour.com/if/admin/> — create providers, apps, users, outposts |

### Protected services

The following services require an Authentik session before you can reach them:

- Home Assistant (`ha.nerdsbythehour.com`)
- Grafana (`grafana.nerdsbythehour.com`)
- TeslaMate (`teslamate.nerdsbythehour.com`)
- JimsWiki (`nerdsbythehour.com/jimswiki`)
- NetAlertX (`netalertx.nerdsbythehour.com`)
- MCP Server (`jimsmcp.nerdsbythehour.com`)

### Unprotected (public) services

- `nerdsbythehour.com` / `deby.nerdsbythehour.com` (landing + whoami)
- `nerdsbythehour.com/speed` (speed test)
- `geohazardwatch.com`
- `owntracks.nerdsbythehour.com` (uses its own HTTP Basic Auth, not Authentik)
- `prometheus.nerdsbythehour.com` is LAN-only and, as of 2026-11-23, behind Authentik forward-auth (`monitoring-authentik-forwardauth` on its Ingress), so it belongs in the protected list above

### Operator reference

[`mj-infra-flux/apps/production/authentik/README.md`](README.md)
