# yourphr-relay

The YourPHR **SMART on FHIR OAuth store-and-poll relay** — EPIC #20, [yourphr#50](https://github.com/jwilleke/yourphr/issues/50).

A small, stateless public bouncer for the SMART authorization `code`. A provider redirects
the user's browser to `https://relay.nerdsbythehour.com/callback?code&state`; the relay stores
`{state -> code}` in memory with a ~60s TTL; the (internal/LAN) YourPHR instance polls
`/pending?state=` (gated by the `X-Yourphr-Token` shared secret) to retrieve the `code` and
completes the token exchange itself. **The relay never sees access/refresh tokens** and holds
**no provider app registration** (per-user / BYO `client_id`).

Source + design: [`yourphr/backend/cmd/relay`](https://github.com/jwilleke/yourphr/tree/main/backend/cmd/relay)
and `docs/planning/smart-on-fhir/oauth-gateway.md`.

## Why its own ingress (public, no Authentik)

The YourPHR app (`yourphr.nerdsbythehour.com`) is internal-only behind Authentik forward-auth.
The relay is the **one public piece**: `/callback` must be reachable by the provider
unauthenticated, so `ingress.yaml` deliberately omits the `authentik-forwardauth` middleware.
`/pending` is protected instead by the shared secret.

The YourPHR pod polls the relay over the in-cluster Service (`yourphr-relay.yourphr.svc.cluster.local:8080`),
so no public path is needed for `/pending`.

## Activation checklist

This directory is staged but **not yet wired into Flux** (`- ./yourphr-relay` is commented in
`apps/production/kustomization.yaml`). Before enabling:

1. **Image** — merge [yourphr#71](https://github.com/jwilleke/yourphr/pull/71) so
   `ghcr.io/jwilleke/yourphr-relay:main` exists.
2. **Secret** — create `relay-secret.sops.yaml` from `relay-secret.sops.yaml.example`
   (see that file for the `sops` command) and uncomment it in `kustomization.yaml`.
3. **Public DNS** — add a public DNS record for `relay.nerdsbythehour.com` pointing at the
   cluster ingress (the app domain is intentionally LAN-only, so this record is relay-specific).
4. **Enable** — uncomment `- ./yourphr-relay` in `apps/production/kustomization.yaml`.

Then `flux reconcile kustomization apps --with-source`; cert-manager issues the TLS cert and the
relay comes up. Verify: `curl https://relay.nerdsbythehour.com/healthz`.

## Future

For the distributed product, a brand-consistent `relay.yourphr.org` on a managed runtime
(Fly.io / Cloud Run) is reserved — trivial to move since the relay is stateless.
