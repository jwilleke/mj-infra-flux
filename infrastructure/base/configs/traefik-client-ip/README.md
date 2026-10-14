# traefik-client-ip

Preserves the real client IP address through the Traefik ingress.

## Why

k3s exposes Traefik with its bundled ServiceLB (klipper-lb). Under the default
`externalTrafficPolicy: Cluster`, inbound traffic is source-NATed before it reaches Traefik, so
Traefik sees the pod-network gateway `10.42.0.1` as the client for every request and writes that
address into `X-Forwarded-For`.

Every origin behind the ingress therefore receives the same forged client address. Home Assistant at
`ha.nerdsbythehour.com` is the case that surfaced it — see
[jwilleke/mjs-ha#82](https://github.com/jwilleke/mjs-ha/issues/82) — where it defeated
`trusted_networks`, made per-user `local_only` restrictions fail __open__, aimed IP banning at the
gateway address so one user's failed logins would lock out everyone, and left the access log unable
to attribute any request. Any other origin behind this ingress has the same blind spot.

Setting `externalTrafficPolicy: Local` skips the SNAT and preserves the source address.

## Trade-off

`Local` only serves traffic on nodes that are running a Traefik pod. On a multi-node cluster that
requires attention to scheduling. `deby` is single-node, so the constraint is not binding.

## Why a HelmChartConfig

Traefik here is installed by k3s' bundled Helm controller, not by a Flux `HelmRelease`, so values are
overridden through a `HelmChartConfig` in `kube-system`. That object already existed in the cluster
as a hand-applied `kubectl apply` carrying `--api.dashboard=true` and `--api.insecure=true`, which
served the Traefik API and dashboard with no authentication to any pod in the cluster. Those two
arguments were dropped in a follow-up fix — see
[jwilleke/mj-infra-flux#177](https://github.com/jwilleke/mj-infra-flux/issues/177).

## Verifying

A LAN browser loading an ingress-served host should appear in the origin's log with its real
`192.168.68.x` address rather than `10.42.0.1`.

## Access logs

The same `HelmChartConfig` turns on Traefik access logs ([jwilleke/mj-infra-flux#237](https://github.com/jwilleke/mj-infra-flux/issues/237)):

- JSON, to stdout. The host fluent-bit on `deby` ships `/var/log/containers/*.log` to Loki, so they are queryable in Grafana for Loki's 30-day retention — no volume needed.
- __Filtered to problem requests:__ status 400–599, retried requests, or anything slower than 2s. The request path includes the query string and YourPHR's search endpoints carry the user's search text there, so fast, successful requests are deliberately not logged.
- Headers are always dropped (no cookies, no `Authorization`). Client IP is real because of `externalTrafficPolicy: Local` above.

Query in Grafana/Loki: `{namespace="kube-system", container="traefik"} | json | line_format "{{.log}}" | json` (fluent-bit wraps each container line in a `log` field).
