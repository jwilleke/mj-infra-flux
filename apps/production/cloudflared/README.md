# cloudflared

Cloudflare Tunnel connectors for `https://geohazardwatch.com`. Two replicas establish outbound HTTPS connections to the Cloudflare edge; Cloudflare load-balances incoming public requests across both connectors and forwards them through the tunnel to the in-cluster Service `geohazardwatch.geohazardwatch.svc.cluster.local:80`.

This bypasses Traefik on the public path. Internal LAN access still goes through Traefik at `geohazardwatch.nerdsbythehour.com`. See `geohazardwatch#14` for the design rationale.

## Architecture

```
Internet → Cloudflare Edge → Tunnel → cloudflared (2 replicas, this Deployment)
                                          ↓
                                geohazardwatch.geohazardwatch.svc.cluster.local:80
                                          ↓
                                  geohazardwatch pod
```

No inbound firewall ports needed on the UDM Pro. `cloudflared` connects out on TCP 7844 to Cloudflare.

## Tunnel configuration

The tunnel itself is configured in the Cloudflare Zero Trust dashboard, not here. The Public Hostname route on the dashboard side must be:

- Subdomain: blank (apex)
- Domain: `geohazardwatch.com`
- Type: `HTTP`
- URL: `geohazardwatch.geohazardwatch.svc.cluster.local:80`
- HTTP Host Header: `geohazardwatch.com` (under HTTP Settings)

## Secret rotation

The tunnel token lives in `.env.secret.cloudflared.encrypted` (SOPS / age). To rotate:

```bash
# from the repo root, on a machine with the age private key
echo "TUNNEL_TOKEN=<new-token>" > apps/production/cloudflared/.env.secret.cloudflared
./scripts/encrypt-env-files.sh apps/production/cloudflared/
rm apps/production/cloudflared/.env.secret.cloudflared
git add apps/production/cloudflared/.env.secret.cloudflared.encrypted
git commit -m "chore(cloudflared): rotate tunnel token"
git push
```

Flux reconciles → kustomize-controller decrypts → Secret refreshes → Deployment rolls.

To force an immediate roll after rotation:

```bash
flux reconcile kustomization apps --with-source
kubectl -n cloudflared rollout restart deploy/cloudflared
```

## Health checks

`cloudflared` exposes Prometheus metrics + health on `:2000`. The pod readiness probe hits `/ready` — green when the tunnel connector is registered with Cloudflare.

```bash
kubectl -n cloudflared get pods
kubectl -n cloudflared logs -l app=cloudflared --tail=50
flux -n flux-system get kustomizations apps
```

In the Cloudflare Zero Trust dashboard, the tunnel's Connectors tab should show two healthy entries (one per replica) once both pods are Ready.

## Operations summary

*Moved from homelab `network/apps/cloudflared.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

cloudflared is the only way into the network from the internet. Two pods make
outbound connections to Cloudflare, and Cloudflare sends public requests for
certain hostnames down that tunnel to services in the cluster. Traefik on deby
has no public inbound port.

### Access

| Item | Value |
| --- | --- |
| Tunnel name | `tunnel-infra-flux` |
| Routes | Set in Cloudflare Zero Trust dashboard (Published application routes), not in git |
| Sign-in | Cloudflare account. Unknown — to fill in (which account / login) |

Public hostnames found in the app READMEs and blackbox targets:

| Hostname | Goes to |
| --- | --- |
| `geohazardwatch.com` | `geohazardwatch` |
| `demo.yourphr.org`, `demo-relay.yourphr.org` | `demo-yourphr` |
| `relay.nerdsbythehour.com` | `yourphr-relay` |
| `relay-ha.nerdsbythehour.com` | `relay-ha` |
| `ngdpbase-demo.nerdsbythehour.com` | `ngdpbase-demo` |
| `owntracks.nerdsbythehour.com` | Traefik → `owntracks` (basic auth) |

### Where it runs / where data lives

deby, namespace `cloudflared`, Deployment with 2 replicas, image
`cloudflare/cloudflared` (tag kept current by Flux image automation). No data.

### Secrets

| Secret | Where |
| --- | --- |
| Tunnel token | OpenBao `apps/cloudflared/cloudflared-token` → ExternalSecret `cloudflared-token` → Secret `cloudflared/cloudflared-token` |

### Dependencies

- OpenBao and External Secrets (token)
- Cloudflare account and zones `nerdsbythehour.com`, `yourphr.org`, `geohazardwatch.com`

### Recovery

(a) Pod broken:

```bash
kubectl -n cloudflared get pods
kubectl -n cloudflared logs deploy/cloudflared --tail=50
kubectl -n cloudflared rollout restart deploy/cloudflared
```

(b) Data lost: nothing local. If the tunnel itself is deleted in Cloudflare,
create a new one, put its token in OpenBao at the path above, then
`flux reconcile kustomization apps` and re-add every route listed above.

(c) deby rebuilt: comes back with Flux once OpenBao is unsealed.

### Health checks

```bash
kubectl -n cloudflared get pods        # 2/2 Ready (readiness hits :2000/ready)
curl -s -o /dev/null -w "%{http_code}\n" https://geohazardwatch.com/   # from outside the LAN
```

### Known gaps

- Route list lives only in the Cloudflare dashboard. The table above is rebuilt from READMEs and may be incomplete.
- `apps/production/cloudflared/README.md` still says the token is a SOPS `.env` file; it now comes from OpenBao. README is out of date.
