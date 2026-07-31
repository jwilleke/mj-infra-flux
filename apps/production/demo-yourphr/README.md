# demo-yourphr

Public, throwaway demo of [YourPHR](https://github.com/jwilleke/yourphr) at `https://demo.yourphr.org`, built for the CMS Blue Button 2.0 production application process ([yourphr#433](https://github.com/jwilleke/yourphr/issues/433), epic [yourphr#438](https://github.com/jwilleke/yourphr/issues/438)). CMS reviewers need a live, Zoom-demoable URL they can reach without authenticating through Authentik — this is a completely separate namespace, database, and PVC from the family/ops `yourphr` install. **Never contains real PHI.**

Full implementation plan (why each decision was made, phase-by-phase build log): [`docs/demo-yourphr-org/implementation-plan.md`](../../../docs/demo-yourphr-org/implementation-plan.md). Source issue: [mj-infra-flux#147](https://github.com/jwilleke/mj-infra-flux/issues/147).

## How it's exposed publicly — Cloudflare Tunnel (not Traefik)

Same pattern as `yourphr-relay` and `geohazardwatch.com`: no Traefik Ingress, no cert-manager TLS. Cloudflare terminates TLS at the edge and the existing `tunnel-infra-flux` tunnel (`apps/production/cloudflared`) reaches these Services directly over plain in-cluster HTTP — which is what bypasses Authentik by design, since `/callback` and the demo app itself both need to be reachable unauthenticated.

```text
Internet → Cloudflare Edge (TLS terminated here)
        → Tunnel → cloudflared (existing, shared with nerdsbythehour.com + geohazardwatch.com)
        → Service demo-yourphr.demo-yourphr.svc.cluster.local:8080       ← demo.yourphr.org
        → Service demo-yourphr-relay.demo-yourphr.svc.cluster.local:8080 ← demo-relay.yourphr.org

In-cluster: demo-yourphr polls demo-yourphr-relay via ClusterIP Service
            (YOURPHR_RELAY_URL), never the public relay hostname.

Storage: demo-yourphr pod → /opt/fasten/db (hostPath /mnt/local-k3s-data/demo-yourphr/)
         — empty at first boot, no PHI, never bound to ops yourphr-data PVC.
```

### Cloudflare dashboard step (manual, not in git) — done 2026-07-31

Zero Trust → existing tunnel (`tunnel-infra-flux`) → **Published application routes** → added:

| Subdomain | Domain | Type | Service |
|---|---|---|---|
| `demo` | `yourphr.org` | `HTTP` | `demo-yourphr.demo-yourphr.svc.cluster.local:8080` |
| `demo-relay` | `yourphr.org` | `HTTP` | `demo-yourphr-relay.demo-yourphr.svc.cluster.local:8080` |

> **Naming note:** the relay hostname is `demo-relay.yourphr.org`, a single-level subdomain — **not** `relay.demo.yourphr.org`. That two-level form failed the TLS handshake at the Cloudflare edge because this zone's Universal SSL cert only covers `yourphr.org` + `*.yourphr.org` (one wildcard level), confirmed via `openssl s_client`. If either route is ever recreated, keep it single-level or the same certificate-scope failure recurs.

Saving these hostnames auto-creates the DNS records (proxied CNAMEs to the tunnel) — no manual DNS entry needed, no firewall port opened. `yourphr.org` is confirmed on the same Cloudflare account as the tunnel.

## Secrets

Two SOPS-encrypted secrets, both distinct from and never shared with the ops `yourphr`/`yourphr-relay` values:

- `relay-secret.sops.yaml` (in `../demo-yourphr-relay/`) — `YOURPHR_RELAY_SECRET`, gates the relay's `/pending` endpoint. Self-generated (`openssl rand -base64 32`) — purely internal, no operator/CMS involvement needed.
- `sandbox-credentials.sops.yaml` — `YOURPHR_SANDBOX_BLUEBUTTON_CLIENT_ID` / `YOURPHR_SANDBOX_BLUEBUTTON_CLIENT_SECRET`. Operator-supplied, CMS-registered sandbox app credentials — **sandbox only, never production Blue Button keys**.

## Wiping the demo database

The demo is meant to be reset between rehearsals/demos so it never accumulates real user data:

```bash
kubectl scale deploy/demo-yourphr -n demo-yourphr --replicas=0
kubectl run demo-yourphr-db-reset -n demo-yourphr --rm --restart=Never --image=alpine \
  --overrides='{"spec":{"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"demo-yourphr-data"}}],"containers":[{"name":"demo-yourphr-db-reset","image":"alpine","command":["/bin/sh","-c","rm -f /data/fasten.db /data/fasten.cache.db && echo done"],"volumeMounts":[{"name":"d","mountPath":"/data"}]}]}}' \
  -- /bin/sh -c "rm -f /data/fasten.db /data/fasten.cache.db && echo done"
kubectl scale deploy/demo-yourphr -n demo-yourphr --replicas=1
```

(Same pattern as the ops `yourphr` DB-reset runbook in `docs/apps/yourphr.md` on the `thishost` workspace — just pointed at the demo's own PVC.)

## Status — live ✅

All phases from the implementation plan completed 2026-07-31:

1. Namespace + hostPath storage ✅
2. Demo app (ConfigMap/Deployment/Service) ✅
3. Demo relay (Deployment/Service/secret) ✅
4. Sandbox Blue Button credentials ✅
5. Wired into `apps/production/kustomization.yaml` + image automation ✅
6. Cloudflare Tunnel routes ✅
7. This README ✅

Verify:

```bash
kubectl -n demo-yourphr get pods
curl -o /dev/null -w "%{http_code}\n" https://demo.yourphr.org/         # 200
curl -o /dev/null -w "%{http_code}\n" https://demo-relay.yourphr.org/  # 200
curl -o /dev/null -w "%{http_code}\n" https://demo-relay.yourphr.org/callback  # 400 — reachable, no Authentik intercept; 400 because no state/code supplied
```

All confirmed live 2026-07-31: both pods `1/1 Running` with no errors, `demo.yourphr.org` returns `200` with no Authentik `Location` redirect, `/callback` reaches the relay (`400`, not an auth wall), the `demo-yourphr-data` PVC is bound to its own PV with real files (`fasten.db`, `.jwt_issuer_key`) at `/mnt/local-k3s-data/demo-yourphr/`, and the ops `yourphr` namespace/PVC (`yourphr-data`, 5Gi `local-path`) is untouched.

### Remaining acceptance criteria — need a browser, not curl

- [ ] Sandbox Medicare connect flow completes end-to-end (Sources → Connect → Blue Button sandbox → authorize → data appears) — the OAuth round-trip needs a live `state`/`code` from an actual provider redirect, not reproducible via curl
- [ ] CMS sandbox app's registered callback URL matches `https://demo-relay.yourphr.org/callback` exactly (registered in the CMS developer portal — [yourphr#433](https://github.com/jwilleke/yourphr/issues/433), operator action)
