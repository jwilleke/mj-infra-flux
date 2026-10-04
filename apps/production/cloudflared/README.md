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

The tunnel token is OpenBao path `kv/deby/cloudflared/cloudflared-token`, key `TUNNEL_TOKEN`. ExternalSecret `cloudflared-token` refreshes the Kubernetes Secret. Write the new value with the procedure in `infrastructure/prod/openbao/README.md`. Do not commit the token.

To force an immediate roll after ESO has refreshed the Secret:

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
