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
