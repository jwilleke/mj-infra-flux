# ngdpbase-demo

Public, throwaway demo of [ngdpbase](https://github.com/jwilleke/ngdpbase) at `https://ngdpbase-demo.nerdsbythehour.com`. Anyone evaluating the project can click rather than clone. Source issue: [ngdpbase#1026](https://github.com/jwilleke/ngdpbase/issues/1026).

Runs the **stock base image** — no addons, no domain config. `geohazardwatch` layers its own image on the same base but tracks its own tag, so the two never move together.

**Never contains anything worth keeping.** Anything a visitor writes here is disposable and is not backed up.

There is **no scheduled wipe** — no CronJob, nothing automatic. The volume is only ever reset by an operator deliberately running the commands under [Resetting the demo](#resetting-the-demo).

## How it's exposed publicly — Cloudflare Tunnel (not Traefik)

Same pattern as `demo-yourphr` and `geohazardwatch.com`: no Traefik Ingress, no cert-manager TLS. Cloudflare terminates TLS at the edge and the existing `tunnel-infra-flux` tunnel (`apps/production/cloudflared`) reaches the Service directly over plain in-cluster HTTP — which is what bypasses Authentik by design, since the whole point is that strangers can read it without an account.

```text
Internet → Cloudflare Edge (TLS terminated here)
        → Tunnel → cloudflared (shared with nerdsbythehour.com + geohazardwatch.com)
        → Service ngdpbase-demo.ngdpbase-demo.svc.cluster.local:80 → pod :3000

Storage: hostPath /mnt/local-k3s-data/ngdpbase-demo → /app/data
         Deliberately NOT under /mnt/tank/jims/data/systems/ where the real
         instances live.
```

### Cloudflare dashboard step (manual, not in git)

Zero Trust → existing tunnel (`tunnel-infra-flux`) → **Published application routes** → add:

| Subdomain | Domain | Type | Service |
|---|---|---|---|
| `ngdpbase-demo` | `nerdsbythehour.com` | `HTTP` | `ngdpbase-demo.ngdpbase-demo.svc.cluster.local:80` |

Saving auto-creates the proxied CNAME — no manual DNS entry, no firewall port.

> **Keep the hostname single-level.** `demo-yourphr`'s README records a TLS handshake failure at the Cloudflare edge from a two-level subdomain, because the zone's Universal SSL cert covers one wildcard level only.

## Access model

| Who | Can |
|---|---|
| Anonymous | Read every page, and nothing else |
| Signed in | Read, edit, create, upload — **not** delete or rename |

Accounts come from **magic link only** (ngdpbase#1026). The password `/register` form is off (`application.registration.password: false`), and accounts created by a magic link are `isExternal` — they hold an empty password hash that no password input can match, so there is no password to guess or leak.

`admin` still has a password and `/login` still accepts it — but it is **never** the shipped `admin123`. `ngdpbase.user.security.defaultpassword` is fed from the `admin-password` Secret key, and that is what the account is created with on first boot.

This matters most **after a wipe**. `createDefaultAdmin()` only runs when no admin exists, so resetting the volume recreates the account from that config value. Without this wiring, every reset would put `admin`/`admin123` back on a permanently-live public URL — and unlike a private install there is no window in which to fix it before the internet can reach it.

### `/admin/configuration` cannot save here

The dashboard itself works normally — users, roles, trash, backup, logs, required-pages and the rest. The one exception is **saving** on `/admin/configuration`: `ConfigurationManager.saveCustomConfiguration()` writes `app-custom-config.json`, which on this instance is a read-only `subPath` ConfigMap mount, so the write throws. Viewing is fine.

That is the intended trade — config belongs in this repo, not in a volume that gets wiped. Change settings by editing `configmap.yaml` here and letting Flux roll the pod.

## Secrets

> **Not in git.** Unlike `demo-yourphr` and `geohazardwatch`, this app ships **no SOPS-encrypted secret file**. Both Secrets below were created by hand with `kubectl` and exist only in the cluster.
>
> They survive pod restarts, image bumps and node reboots — ordinary Kubernetes state. They do **not** survive deleting the namespace or rebuilding the cluster, and `flux bootstrap` alone will not restore them: the pod fails to start until they are recreated by hand.
>
> That is a deliberate trade for a disposable demo — recovery is the two commands below — but it means this app is **not** self-contained in git the way its neighbours are. If that stops being acceptable, encrypt them into `resend-smtp.sops.yaml` and `secrets.sops.yaml` here and list both in `kustomization.yaml`, matching `../demo-yourphr/sandbox-credentials.sops.yaml`.

Two, both distinct from every other instance. Create them **before** this app first reconciles: `ngdpbase-demo-resend` and the `admin-password` key are deliberately not `optional`, so the pod will not start without them.

- `ngdpbase-demo-resend` — `api-key` (Resend send-only API key) and `from` (a sender on a Resend-verified domain). Consumed by the `$NGDPBASE_SMTP_PASS` / `$NGDPBASE_MAIL_FROM` env-refs in `configmap.yaml`. **Not optional**: an unset ref throws at startup naming the key, which is what we want — magic link is the only way in, so silently having no mail would leave the demo unauthenticatable with nothing in the logs explaining why.
- `ngdpbase-demo-secrets` — `admin-password` (required, see above) and `session-secret` (optional).

```bash
kubectl -n ngdpbase-demo create secret generic ngdpbase-demo-resend \
  --from-literal=api-key='re_...' \
  --from-literal=from='ngdpbase demo <demo@nerdsbythehour.com>'

kubectl -n ngdpbase-demo create secret generic ngdpbase-demo-secrets \
  --from-literal=admin-password="$(openssl rand -base64 24)" \
  --from-literal=session-secret="$(openssl rand -base64 32)"
```

Read the admin password back when you need it:

```bash
kubectl -n ngdpbase-demo get secret ngdpbase-demo-secrets -o jsonpath='{.data.admin-password}' | base64 -d; echo
```

Resend's free tier is roughly **100 sends/day** and every sign-in request spends one. The per-IP budget in `ngdpbase.mail.rate-limit.*` is enabled in the ConfigMap for exactly that reason — do not turn it off here.

## Resetting the demo

**Manual only, and not on any schedule.** Nothing resets this instance automatically — no CronJob, no timer. Run this when you actually want a clean slate (accumulated spam, a mangled demo, or testing the reseed path), not as routine maintenance.

```bash
kubectl scale deploy/ngdpbase-demo -n ngdpbase-demo --replicas=0
# on deby:
sudo rm -rf /mnt/local-k3s-data/ngdpbase-demo/*
kubectl scale deploy/ngdpbase-demo -n ngdpbase-demo --replicas=1
```

Deletes all 16 directories on the volume: `pages`, `users`, `sessions`, `attachments`, `comments`, `footnotes`, `shares`, `tokens`, `notifications`, `persons`, `roles`, `organizations`, `backups`, `logs`, `search-index`, `config`.

The pod reseeds `required-pages/` from the image on next boot (`HEADLESS_INSTALL=true`), so the shipped documentation plus the Welcome / Sandbox / Feature Tour pages come back automatically. Visitor accounts and edits do not — and neither does any admin password set through the UI, which is why `admin-password` in the Secret is what governs the account after a reset.

## Auto-update

`../image-automation/ngdpbase-demo-policy.yaml` scans `ghcr.io/jwilleke/ngdpbase` every 10m and rewrites the `# {"$imagepolicy": …}`-marked line in `deployment.yaml` for any `>=4.0.0 <5.0.0` tag. Scoped to this directory, so a demo bump never touches geohazardwatch.

## Known behaviour

- **Magic-link tokens are held in memory.** A pod restart — including an image bump — invalidates every outstanding link. Not a bug; request another.
- **The ConfigMap mount is read-only.** Admin UI screens that write back to `app-custom-config.json` will fail here. Change config in this repo instead.

## Verify

```bash
kubectl -n ngdpbase-demo get pods                                                        # 1/1 Running
kubectl -n ngdpbase-demo logs deploy/ngdpbase-demo | head -50                            # seeded pages, no config errors
curl -o /dev/null -w "%{http_code}\n" https://ngdpbase-demo.nerdsbythehour.com/          # 200
curl -sI https://ngdpbase-demo.nerdsbythehour.com/ | grep -i location                    # empty — no Authentik redirect
curl -o /dev/null -w "%{http_code}\n" https://ngdpbase-demo.nerdsbythehour.com/register  # 404 — password signup off
```

Then, in a browser with a real mailbox: request a link for an address with no account, confirm it arrives, click it, confirm you can edit but not delete.
