# Traefik (ingress) and its dashboard

*Moved from homelab `network/apps/traefik.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

## What it is and does

Traefik is the front door for every `*.nerdsbythehour.com` host on the LAN. It
takes HTTPS on deby port 443, picks the app by host name, and applies
middlewares like Authentik forward-auth, the LAN allow-list and basic auth.

## Access

| Item | Value |
| --- | --- |
| Entry | `192.168.68.71:80/443` (LoadBalancer service `kube-system/traefik`) |
| Dashboard | <https://traefik.nerdsbythehour.com> (IngressRoute `traefik-dashboard` in `kube-system`, behind Authentik) |
| Reach | LAN only. Public DNS for the hosts also returns LAN addresses |

## Where it runs / where data lives

deby, k3s bundled Traefik 3.7.13 in `kube-system`. Settings come from
HelmChartConfig `traefik` in `infrastructure/prod/configs` (`--api`,
`externalTrafficPolicy: Local` to keep client IPs, JSON access log for status
400–599). No data. Access logs go to Loki via the monitoring stack.

## Secrets

TLS Secrets are made by cert-manager. None by hand.

## Dependencies

k3s, cert-manager, Authentik (for the dashboard and forward-auth apps).

## Recovery

(a) Pod broken:

```bash
kubectl -n kube-system get pods -l app.kubernetes.io/name=traefik
kubectl -n kube-system logs deploy/traefik --tail=100
kubectl -n kube-system rollout restart deploy/traefik
flux reconcile kustomization infra-configs
```

(b) Data lost: nothing to lose.

(c) deby rebuilt: k3s installs Traefik; Flux `infra-configs` re-applies the
HelmChartConfig.

## Health checks

```bash
curl -sI https://deby.nerdsbythehour.com/ | head -1     # whoami, 200
kubectl get ingress,ingressroute -A
```

## Known gaps

- Traefik version follows k3s; upgrading k3s upgrades Traefik.
- `monitoring/grafana-ingress` has no `ingressClassName`; it works only because Traefik is the default.
