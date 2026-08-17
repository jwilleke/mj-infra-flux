# demo.yourphr.org — implementation plan

Flux implementation plan for [mj-infra-flux#147](https://github.com/jwilleke/mj-infra-flux/issues/147), infra work for the [yourphr#438](https://github.com/jwilleke/yourphr/issues/438) epic. Standing up a public, throwaway demo of YourPHR for the CMS Blue Button 2.0 production application process ([yourphr#433](https://github.com/jwilleke/yourphr/issues/433)) — CMS reviewers need a live Zoom-demoable URL with no Authentik login wall and no real PHI.

## Why this exists

Production access to CMS's Blue Button 2.0 API requires a Zoom demo of the sign-up → connect-Medicare → view-data → disconnect flow. CMS reviewers can't authenticate through Authentik, so the demo instance has to be genuinely public and separate from the family/ops `yourphr` install — empty database, sandbox Medicare credentials only, never touching the ops PVC.

## Decided (from the issue, not open for reinterpretation)

| Item | Value |
|---|---|
| App public hostname | `demo.yourphr.org` |
| Relay public hostname | `demo-relay.yourphr.org` |
| Authentik on either hostname | None |
| Public path | Existing Cloudflare Tunnel (`apps/production/cloudflared`) |
| Node data path | `/mnt/local-k3s-data/demo-yourphr/` |
| Image | Release-gated `ghcr.io/jwilleke/yourphr` |
| PHI | Empty volume only — never bind ops `yourphr-data` |

## Why this is lower-risk than it looks

Two patterns already prove the hard parts work in this exact cluster, so this is largely a copy-and-adapt job rather than new design:

- __`yourphr-relay`__ is the template for both the demo app and demo relay: Deployment + Service only, no Ingress, no cert-manager — Cloudflare terminates TLS at the edge and the tunnel reaches the Service over plain in-cluster HTTP, which is what bypasses Traefik/Authentik by design. Already live at `relay.nerdsbythehour.com`.
- __`cloudflared`__ already serves two different zones (`nerdsbythehour.com` and `geohazardwatch.com`) off one tunnel. Routing a third zone (`yourphr.org`) through the same tunnel is proven, not novel — as long as `yourphr.org` is confirmed on the same Cloudflare account.
- __`yourphr`'s `image-automation`__ ImagePolicy (release-gated semver, public GHCR scanning) is directly reusable for the demo app's image updates.

## Proposed answers to the issue's "explicitly TBD" list

These are recommendations to confirm with the operator before implementing, not final decisions:

| Open question | Proposed answer | Reasoning |
|---|---|---|
| Namespace name | `demo-yourphr` | Matches the `yourphr`/`yourphr-relay` naming convention |
| App dir location | Sibling dirs `apps/production/demo-yourphr/` + `apps/production/demo-yourphr-relay/` | Mirrors existing `yourphr` / `yourphr-relay` split exactly |
| Storage | hostPath PV (not local-path PVC) | Simpler for a throwaway/wipeable volume; matches the issue's explicit fixed path `/mnt/local-k3s-data/demo-yourphr/` rather than a PVC that could reprovision elsewhere |
| Node affinity | Not needed | Single-node k3s cluster (`deby`) — no scheduling ambiguity |
| CDA converter | Omit for demo | Demo flow is sandbox Medicare FHIR import only, no C-CDA upload in the CMS demo script; cuts scope and one more public-adjacent service |
| Image policy | Share the existing `yourphr` ImagePolicy/ImageRepository, separate ImageUpdateAutomation path | Same release cadence as prod is fine since demo has no persistent state to break; a separate `ImageUpdateAutomation.spec.update.path` keeps the demo deployment's image bump independent of prod's |
| Cloudflare Access | Off | Matches issue default; reconsider only if the public demo sees abuse |
| Separate tunnel | No — reuse existing `cloudflared` | Matches proven multi-zone pattern already in use |
| Prod Blue Button env | No — sandbox only | Matches issue default; production keys stay reserved for the eventual production cutover in yourphr#408 |

## Architecture

```text
Internet → Cloudflare Edge (TLS terminated here)
        → Tunnel → cloudflared (existing, shared with nerdsbythehour.com + geohazardwatch.com)
        → Service demo-yourphr.demo-yourphr.svc.cluster.local:8080       ← demo.yourphr.org
        → Service demo-yourphr-relay.demo-yourphr.svc.cluster.local:8080 ← demo-relay.yourphr.org

In-cluster: demo-yourphr polls demo-yourphr-relay via ClusterIP Service
            (YOURPHR_RELAY_URL), never the public relay hostname —
            same hairpin-avoidance rule as prod.

Storage: demo app pod → /opt/fasten/db (hostPath /mnt/local-k3s-data/demo-yourphr/)
         — empty at first boot, no PHI, never bound to ops yourphr-data PVC.
```

## Implementation phases

### Phase 1 — Namespace + storage — ✅ done 2026-07-31 (`e0aade0`)

1. `apps/production/demo-yourphr/namespace.yaml` — new `demo-yourphr` namespace
2. `/mnt/local-k3s-data/demo-yourphr/` created on node `deby` (root:root, 755 — matches sibling dirs)
3. `apps/production/demo-yourphr/pv.yaml` + `pvc.yaml` — hostPath PV (1Gi, `Retain` reclaim policy, `storageClassName: ""`), mirrors the existing `owntracks-recorder` manual-hostPath-PV pattern rather than `local-path` dynamic provisioning (deliberate: a named, explicitly-bound PV keeps this volume distinct from the ops `yourphr-data` PVC with no chance of cross-binding)

Verified: `kubectl kustomize apps/production/demo-yourphr` builds cleanly. __Not yet wired into `apps/production/kustomization.yaml`__ — that's Phase 5, once the app + relay Deployments/Services exist too. Namespace + empty PV/PVC with no workloads is inert either way, so each phase stays independently reviewable.

### Phase 2 — Demo app — ✅ done 2026-07-31 (`26f9304`)

1. `apps/production/demo-yourphr/configmap.yaml` — mirrors `apps/production/yourphr/configmap.yaml`'s `config.yaml` (HTTP listen on 8080, DB/cache paths under the hostPath mount); no `backup.allowed-roots` needed since demo data is disposable and not backed up
2. `apps/production/demo-yourphr/deployment.yaml` — mirrors `apps/production/yourphr/deployment.yaml` structurally, dropped down to just:
   - Image `ghcr.io/jwilleke/yourphr:1.18.0` with the `# {"$imagepolicy": "flux-system:yourphr"}` setter marker (shares the prod ImagePolicy; Phase 5 adds a separate `ImageUpdateAutomation` path)
   - `YOURPHR_RELAY_URL` → in-cluster demo relay Service (not the public hostname)
   - `YOURPHR_RELAY_PUBLIC_URL` → `https://demo-relay.yourphr.org` — __confirmed__ (not guessed) against `backend/pkg/relay/relay.go`: `relay.public_url` is exactly the public browser-facing origin the provider redirects to, distinct from `relay.url` (the poll URL); env var derivation (`relay.public_url` → `YOURPHR_RELAY_PUBLIC_URL`) is mechanical per `backend/pkg/config`
   - `YOURPHR_RELAY_SECRET` from the demo relay's SOPS secret — `secretKeyRef` with `optional: true`, so this Deployment ships ahead of Phase 3/4 without blocking, same as prod's pattern
   - `YOURPHR_BACKUP_LABEL=demo` (harmless even with no backup destination configured)
   - `YOURPHR_MEDICATIONS_RXTERMS_ENRICH=true` — offline-only, no external calls, kept for demo data readability
   - Sandbox Blue Button client env vars only (`demo-yourphr-sandbox-credentials` secret, also `optional: true` pending Phase 3/4) — no production Blue Button keys, no other sandbox providers
   - No CDA converter env vars (Phase-1 decision above)
   - No Authentik middleware, no Ingress
3. `apps/production/demo-yourphr/service.yaml` — ClusterIP, port 8080 (tunnel origin)

Verified: `kubectl kustomize apps/production/demo-yourphr` builds cleanly. Still not wired into `apps/production/kustomization.yaml` — Phase 5.

### Phase 3 — Demo relay — ✅ done 2026-07-31 (`eb5f3be`)

1. `apps/production/demo-yourphr-relay/deployment.yaml` — mirrors `apps/production/yourphr-relay/deployment.yaml` exactly; same image, same `X-Yourphr-Token`-gated `/pending` design, distinct shared secret from prod
2. `apps/production/demo-yourphr-relay/service.yaml` — ClusterIP, port 8080
3. `apps/production/demo-yourphr-relay/relay-secret.sops.yaml` — freshly generated (`openssl rand -base64 32`), SOPS-encrypted with the repo's standard age recipient + `encrypted_regex: ^(data|stringData)$` convention, decrypt-verified locally before committing. Distinct value, never shared with the prod relay's.

__Scope correction to Phase 4 below:__ this relay secret didn't need operator input — it's a shared secret between two of our own in-cluster services, safe to self-generate like the ops relay's already is. Phase 4 narrows to just the sandbox Blue Button credentials, which genuinely do need operator-supplied (CMS-registered) values.

Verified: `kubectl kustomize apps/production/demo-yourphr-relay` builds cleanly; decrypted the secret locally to confirm it round-trips correctly. Still not wired into `apps/production/kustomization.yaml` — Phase 5.

### Phase 4 — Secrets (sandbox Blue Button credentials only — see Phase 3 correction above) — ✅ done 2026-07-31 (`7c06d28`)

1. ~~Operator supplies: demo relay shared secret value~~ — done in Phase 3, self-generated.
2. Operator supplied sandbox Blue Button `client_id`/`client_secret` (from `private/yphr.md`, gitignored, never committed).
3. `apps/production/demo-yourphr/sandbox-credentials.sops.yaml` — SOPS-encrypted with the repo's standard age recipient + `encrypted_regex` convention, decrypt-verified locally to confirm it round-trips correctly. Distinct values from prod — never reused. Wired into `demo-yourphr`'s `kustomization.yaml`.

### Phase 5 — Wiring + image automation

1. Add both new dirs' `kustomization.yaml` files (labels matching the `app.jimwilleke.com/name` convention used elsewhere)
2. Wire both into `apps/production/kustomization.yaml`
3. `apps/production/image-automation/demo-yourphr-policy.yaml` — either point at the existing `yourphr` `ImageRepository`/`ImagePolicy` with a demo-specific `ImageUpdateAutomation.spec.update.path`, or a full separate policy if independent version pinning turns out to matter before the CMS demo

### Phase 6 — Cloudflare dashboard (manual, not git — mirrors the relay's existing step) — ✅ done 2026-07-31

1. Zero Trust → existing tunnel (`tunnel-infra-flux`) → __Published application routes__ → added:
   - Subdomain `demo`, domain `yourphr.org`, type `HTTP`, URL `demo-yourphr.demo-yourphr.svc.cluster.local:8080`
   - Subdomain `demo-relay`, domain `yourphr.org`, type `HTTP`, URL `demo-yourphr-relay.demo-yourphr.svc.cluster.local:8080`
2. `yourphr.org` zone confirmed on the same Cloudflare account as the tunnel — both routes saved successfully.

__Naming correction found during setup:__ the original plan used `relay.demo.yourphr.org` (a second-level subdomain). Cloudflare's default Universal SSL cert for this zone only covers the apex + one wildcard level (`yourphr.org`, `*.yourphr.org`), confirmed via `openssl s_client`. A second-level subdomain has no matching certificate and fails the TLS handshake before routing even applies — this is a certificate-scope limit, not a tunnel/DNS misconfiguration. Renamed to the single-level `demo-relay.yourphr.org`, which is covered by the existing wildcard.

__Verified live:__

```bash
curl -o /dev/null -w "%{http_code}\n" https://demo.yourphr.org/        # 502 — tunnel/TLS OK, Service not built yet
curl -o /dev/null -w "%{http_code}\n" https://demo-relay.yourphr.org/  # 502 — tunnel/TLS OK, Service not built yet
```

Both hostnames resolve through Cloudflare and reach the tunnel correctly; the `502`s are expected until Phases 2/3 (the Services) exist.

### Phase 7 — README + verification — ✅ done 2026-07-31 (`2422057`)

1. `apps/production/demo-yourphr/README.md` — mirrors `yourphr-relay/README.md`'s structure: architecture diagram, Cloudflare dashboard step (with the TLS cert-scope naming note), secrets summary, wipe procedure, status/verify commands
2. Verified against the acceptance criteria below rather than assumed — see per-item status

## Verification / acceptance criteria

Copied from the issue — this plan doesn't change them, just tracks against them:

- [x] `https://demo.yourphr.org` serves YourPHR via the tunnel, no Authentik login wall — confirmed live (`200`, no `Location` header to Authentik)
- [x] `https://demo-relay.yourphr.org/callback` reachable without Authentik — confirmed live (`400`, not an auth-wall redirect; expected without a real `state`/`code`)
- [x] ClusterIP Services exist for both app and relay (required tunnel origins) — confirmed via `kubectl get svc -n demo-yourphr`
- [x] App data lives under `/mnt/local-k3s-data/demo-yourphr/`, empty of PHI at first boot — confirmed: `demo-yourphr-data` PVC bound to its dedicated PV, real files on disk (`fasten.db`, `.jwt_issuer_key`), sandbox-only data
- [x] Demo app polls the relay in-cluster; the public relay URL is used only for the browser OAuth callback — confirmed via env vars + no relay errors in pod logs
- [x] Ops `yourphr` namespace/PVC completely unchanged by this work — confirmed: `yourphr-data` still bound to its own 5Gi `local-path` PVC, all three ops pods (`yourphr`, `yourphr-relay`, `yourphr-cda-converter`) unaffected
- [x] README documents the wipe procedure, hostnames, and secret keys — done
- [ ] Sandbox Medicare connect flow completes end-to-end — __not curl-verifiable__, needs an operator to actually click through the app in a browser
- [ ] CMS sandbox app's registered callback URL matches `https://demo-relay.yourphr.org/callback` — __operator/CMS-portal action__, tracked in [yourphr#433](https://github.com/jwilleke/yourphr/issues/433), not infra work

All infra-side acceptance criteria are met. The two remaining items are outside what Flux/Kubernetes work can verify — they're the operator's next step, not blocked on anything here.

## Risks (from the issue, plus what's already de-risked)

| Risk | Status |
|---|---|
| `yourphr.org` zone not on the Cloudflare account | __Resolved__ — confirmed same account, both routes saved |
| Second-level subdomain (`relay.demo.yourphr.org`) not covered by Universal SSL | __Resolved__ — renamed to single-level `demo-relay.yourphr.org`, covered by the `*.yourphr.org` wildcard, verified via TLS handshake + `502` from Cloudflare |
| Wrong Service DNS/port in tunnel config → 502 | Low risk — exact pattern already works for `relay.nerdsbythehour.com`; current `502`s on both new hostnames are the expected no-Service-yet state, not a config error |
| Reusing ops PVC by mistake → PHI on public demo | Mitigated by using a dedicated hostPath, never referencing `yourphr-data` anywhere in the demo manifests |
| Relay secret mismatch between demo app and demo relay | Mitigated by generating both from one SOPS-encrypted source of truth in Phase 4 |
| CMS sandbox callback still pointing at `relay.nerdsbythehour.com` after cutover | Operator action, tracked in yourphr#433 — not an infra risk |

## Open questions for the operator before implementation starts

1. ~~Confirm `yourphr.org` is on the same Cloudflare account as the existing tunnel~~ — done, Phase 6 complete.
2. Confirm the proposed answers table above, especially: omitting the CDA converter, hostPath vs PVC, and sharing the prod ImagePolicy.
3. Any CMS-demo-script-specific requirements not yet reflected here (e.g., a specific sandbox provider beyond Blue Button, a specific UI copy/branding change for the public demo).

## References

- [mj-infra-flux#147](https://github.com/jwilleke/mj-infra-flux/issues/147) — this plan's source issue
- [yourphr#438](https://github.com/jwilleke/yourphr/issues/438) — product epic
- [yourphr#433](https://github.com/jwilleke/yourphr/issues/433) — CMS application process
- [yourphr#408](https://github.com/jwilleke/yourphr/issues/408) — eventual production SMART proof, after this demo unblocks the CMS application
- `apps/production/yourphr-relay/README.md` — the pattern this plan mirrors for both new Deployments
- `apps/production/cloudflared/README.md` — existing multi-zone tunnel pattern
