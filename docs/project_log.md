# Project Log — FROZEN as of 2026-05-22

> **Operational history for `mj-infra-flux` is now consolidated** at [`jwilleke/deby:docs/project_log.md`](https://github.com/jwilleke/deby/blob/master/docs/project_log.md). New session entries for work touching this repo are recorded there, referencing `mj-infra-flux@<sha>` for the affected commits. The entries below are preserved as a historical archive — do not append.
>
> See also `jwilleke/deby:TODO.md` for the curated cross-repo issue digest, and [`CHANGELOG.md`](../CHANGELOG.md) for version history of this repo's artifacts.

This file (entries below) was the AI-agent session log for this repo through 2026-05-22.

## Format

```
## yyyy-MM-dd-##

- Agent: [Claude/Gemini/Other]
- Subject: [Brief description]
- Key Decision: [decision]
- Current Issue: [issue]
- Work Done:
  - [task 1]
  - [task 2]
- Commits: [hash]
- Files Modified:
  - [file1.js]
  - [file2.md]
```

## Work Completed

- 2026-05-09-02 - Followup: alertmanager Gmail fix (#46 unblocker), fold cloudflared+image-automation back into apps, migrate hand-applied Secrets (#46), file #69 (v1beta2 deprecation)
- 2026-05-09-01 - End-to-end image automation for geohazardwatch (#64): controllers installed, scoped image-automation Flux Kustomization, GHCR PAT rotated, fluxcdbot push live
- 2026-05-08-01 - Disable self-registration on geohazardwatch.com (set `ngdpbase.application.registration: false`, image bump to 1.1.6)
- 2026-05-07-11 - Cloudflare Tunnel live for geohazardwatch.com (carved into its own Flux Kustomization with SOPS)
- 2026-05-07-10 - Bump geohazardwatch image to 1.1.5 (ngdpbase 3.10.2 ships themes/)
- 2026-05-07-01 - Add geohazardwatch app with Flux image automation
- 2026-01-29-01 - Fix Flux reconciliation and Home Assistant authentication
- 2026-01-22-05 - Attempt amdwiki fix, created upstream issue
- 2026-01-22-04 - Fix Dependabot security vulnerabilities in jimsmcp
- 2026-01-22-03 - Implement service failure monitoring alerts
- 2026-01-22-02 - Verify Home Assistant trusted proxies for k3s
- 2026-01-22-01 - Fix JimsWiki subdomain migration and certificate issuer
- 2026-01-21-01 - Fix Prometheus CrashLoopBackOff and expose MQTT externally
- 2026-01-01-03 - Remove home assistant and hoarder
- 2026-01-01-25 - Added patch to disable node-exporter systemd collector - "Prevented D-Bus connection errors"
- 2025-12-01-01 - Fixed amdwiki service connectivity - "Rebuild amdwiki image and config"
- 2025-12-10-01 - Fixed Home Assistant proxy DNS and WebSocket - "Diagnose and fix ha.nerdsbythehour.com connectivity"
- 2025-12-11-01 - Added zero-threat.html static page - "Create unprotected zero-threat.html page on landing page"
- 2025-12-11-02 - Security vulnerability analysis and remediation plan - "Analyze ZeroThreat security scan and create SECURITY.md"

## 2026-05-09-01

- Agent: Claude Opus 4.7
- Subject: End-to-end image automation for geohazardwatch (#64) — controllers installed, scoped Flux Kustomization, fluxcdbot push live
- Key Decisions:
  - Image automation manifests live in `apps/production/image-automation/`, NOT under per-app dir (per-app kustomization stamps `namespace: <app>` over everything; image-reflector resources need `flux-system`)
  - Dedicated Flux Kustomization at `clusters/deby/image-automation.yaml` with `decryption: sops`, scoped narrowly to that one dir (mirrors cloudflared pattern; intentionally sidesteps the apps Kustomization which can't enable decryption while two legacy prometheus encrypted files use the unavailable `age1nur86…` recipient)
  - Out-of-band kubectl-applied Secret `flux-system-git-auth` for git push creds (matches `sops-age` pattern; not in repo)
  - Single fine-grained PAT (Contents: R/W, Packages: Read) — covers both git push and GHCR pull. **Correction (2026-05-16):** this originally read "scoped to mj-infra-flux only" — that is wrong. The GHCR package `ghcr.io/jwilleke/geohazardwatch` is owned by repo `jwilleke/geohazardwatch`, so the PAT had to be scoped there (fine-grained `Packages: Read` requires the package's owning repo). The same token was additionally reused as the `jwilleke/geohazardwatch` repo's `RELEASE_PAT` / `RENOVATE_TOKEN` Actions secrets, so it is **not** orphaned even after the deby GHCR-pull use ended in #69 — see the P2 item in the consolidated `deby` digest at `~/thishost/TODO.md` (the former repo-root `TODO.md` was merged there and removed 2026-05-16) for the correct rotation sequence.
- Current Issue: None — #64 closed end-to-end
- Tests: ImageRepository scans 12 tags; ImagePolicy resolves to 1.2.2 (highest in `>=1.0.0 <2.0.0`); ImageUpdateAutomation `Ready: True repository up-to-date`; fluxcdbot push verified (commit `aa1e944` chore(image-automation): bump geohazardwatch to 1.2.2); pod running `1.2.2`
- Work Done:
  - Investigated #64 → surfaced three latent blockers: missing `secretRef` on ImageRepository, image-reflector/image-automation controllers not actually running on the cluster (only RBAC subjects in `gotk-components.yaml`, no Deployment manifests), SOPS decryption stripped from apps Kustomization in #59 revert
  - First-attempt PRs #65 + #66 reverted via #67 after surfacing that two prometheus SOPS files (`apps/production/monitoring/prometheus/.env.secret.prometheus-self-scrape.encrypted`, `apps/production/monitoring/prometheus-alertmanager/.env.secret.alertmanager.encrypted`) are encrypted to `age1nur86…` — a recipient the cluster's `sops-age` Secret has no key for. Enabling decryption on the apps Kustomization failed the entire build on those files
  - Final solution PR #68: regenerated `clusters/deby/flux-system/gotk-components.yaml` via `flux install --components=...,image-reflector-controller,image-automation-controller --version=v2.7.3 --export`; restored `apps/production/image-automation/`; added new dedicated Flux Kustomization at `clusters/deby/image-automation.yaml`
  - Follow-up commits to fix CRD/template drift: `3df6e58` (ImageUpdateAutomation `v1beta1` → `v1beta2` — CRD no longer serves v1beta1), `16cdfe8` (template `.Updated` → `.Changed.Changes`)
  - `8f32556` — manual one-shot bump of `deployment.yaml` from 1.1.6 → 1.2.2 to match policy resolution (couldn't be auto-pushed yet because GitRepository was anonymous-HTTPS-read with no write creds)
  - `4837ef8` — rotated GHCR PAT (old one exposed in chat session) to a fine-grained PAT, re-encrypted ghcr-geohazardwatch SOPS Secret, kubectl-applied `flux-system-git-auth` Secret on cluster, patched `gotk-sync.yaml` to add `secretRef`. After the user enabled `Contents: Read and write` on the PAT, fluxcdbot's push succeeded immediately
- Commits: 9aed87d (#68 squash), 3df6e58, 16cdfe8, 8f32556, 4837ef8, aa1e944 (fluxcdbot)
- PRs: #65 (reverted), #66 (reverted), #67 (revert), #68 (final)
- Files Modified:
  - `clusters/deby/flux-system/gotk-components.yaml` (regenerated to v2.7.3 with image controllers)
  - `clusters/deby/flux-system/gotk-sync.yaml` (added `secretRef.name: flux-system-git-auth`)
  - `clusters/deby/image-automation.yaml` (created — dedicated Flux Kustomization with `decryption: sops`)
  - `apps/production/image-automation/kustomization.yaml` (created)
  - `apps/production/image-automation/geohazardwatch-policy.yaml` (created — ImageRepository with secretRef, ImagePolicy, ImageUpdateAutomation v1beta2)
  - `apps/production/image-automation/geohazardwatch-ghcr.sops.yaml` (created, then re-encrypted with new PAT)
  - `apps/production/geohazardwatch/deployment.yaml` (1.1.6 → 1.2.2, manual one-shot)
  - `apps/production/geohazardwatch/kustomization.yaml` (drop stale comment about image-policy.yaml)
  - `apps/production/geohazardwatch/README.md` (drop stale "controllers not installed" section, document new flow)
  - `apps/production/geohazardwatch/image-policy.yaml` (deleted; moved to `apps/production/image-automation/`)
  - `private/encrypt-ghcr-secret.sh`, `private/rotate-and-wire-pat.sh` (gitignored helper scripts)
- Follow-ups (not in this session):
  - Revoke the old exposed GHCR PAT (`ghp_dUUY1T9N…`) at https://github.com/settings/tokens
  - Re-encrypt the two prometheus SOPS files to `age1sr8j…` (needs the legacy private key or cleartext) so the apps Kustomization can enable decryption in the future

## 2026-05-09-02

- Agent: Claude Opus 4.7
- Subject: Followup work to 2026-05-09-01 — alertmanager Gmail fix, scoped-Kustomization consolidation, in-repo Secrets migration (#46)
- Key Decisions:
  - The 2026-05-09-01 follow-up to "re-encrypt prometheus SOPS files" turned out to be two distinct cleanups: the prometheus-self-scrape file held unused basic-auth credentials (replaced by Authentik ForwardAuth long ago — file deleted, not re-encrypted), and the alertmanager file was stale-since-`fd8922a` (held only `telegram_bot_token` while alertmanager.yaml expected `gmail_app_password` — re-encrypted with the actual Gmail app password)
  - With all encrypted files under `apps/production/` now unified to `age1sr8j…`, re-enabled `decryption: { provider: sops, secretRef: { name: sops-age } }` on the apps Flux Kustomization (originally added in #58, reverted in #59 because of legacy recipient mismatch). This is what *actually* unbroke alertmanager Gmail SMTP — the file alone wasn't enough; without decryption the Secret applied with ciphertext as the password value
  - The cloudflared and image-automation dedicated Flux Kustomizations existed only because the apps Kustomization couldn't enable decryption (#59's blocker). Now that it can, folded them back into apps via a 2-step `prune: false` handoff. Net: 5 Flux Kustomizations → 3, fewer reconciliation surfaces, no pod restarts during ownership transfer
  - For #46: chose Option 2 (SOPS) over Option 1 (sealed-secrets). SOPS infrastructure was already operational from earlier work; matched existing pattern for cloudflared/transmission/alertmanager
  - For the jimsmcp GHCR pull secret (#46 step 1): the `jwilleke/jimsmcp` GHCR package is not linked to any GitHub repo (`gh api user/packages/container/jimsmcp` → `repository:null`), so a fine-grained PAT couldn't be scoped to it. Used a classic PAT with `read:packages` only — narrow enough for a single-user homelab
  - For the fluxcdbot git-push secret (#46 step 2): re-used the same fine-grained PAT minted earlier today; just stored declaratively now under `apps/production/image-automation/` so apps Kustomization decrypts and applies it
- Current Issue: None — everything Ready: True at session end
- Tests: All 3 Flux Kustomizations Ready: True at master HEAD; image automation chain (ImageRepository → ImagePolicy → ImageUpdateAutomation) all Ready: True with successful scan and `repository up-to-date`; alertmanager pod rolled after Secret data flipped from ciphertext to cleartext (confirms decryption took effect); zero failing pods cluster-wide
- Work Done:
  - Sub-task A: deleted `apps/production/monitoring/prometheus/.env.secret.prometheus-self-scrape.encrypted` (unused — basic auth replaced by Authentik ForwardAuth in `web.yaml removed - using Authentik ForwardAuth instead of basic auth` long ago); removed `secretGenerator` block + `prometheus-secret-volume` mount in statefulset (35ba6ed; bedcce0 was the followup that fixed the orphaned references the first commit left dangling)
  - Sub-task B: re-encrypted `apps/production/monitoring/prometheus-alertmanager/.env.secret.alertmanager.encrypted` with `gmail_app_password=<value>` to `age1sr8j…` via `private/encrypt-alertmanager-secret.sh` (35ba6ed)
  - Re-enabled `decryption: sops` on apps Kustomization (b5116c1) — fixes Gmail SMTP auth that had been silently broken since `fd8922a`
  - Folded `cloudflared` + `image-automation` Flux Kustomizations back into apps:
    - Step 1 (3584d75): set `prune: false` on both, so finalizers don't garbage-collect their inventory on Kustomization deletion
    - Step 2 (e3db92a): added `./cloudflared` and `./image-automation` to `apps/production/kustomization.yaml`; deleted `clusters/deby/cloudflared.yaml` + `clusters/deby/image-automation.yaml`. Apps adopted resources via server-side apply; cloudflared pods stayed at 44h uptime, no restart
  - Filed issue #69 — `image.toolkit.fluxcd.io/v1beta2` ImageRepository/ImagePolicy/ImageUpdateAutomation deprecated, should bump to `v1` (low priority)
  - #46 step 1 (9e27187): migrated `jimsmcp/ghcr-jimsmcp` to in-repo SOPS Secret at `apps/production/jimsmcp/ghcr-jimsmcp.sops.yaml` (classic PAT with `read:packages` since GHCR package isn't repo-linked). Helper script: `private/encrypt-jimsmcp-ghcr-secret.sh`
  - #46 step 2 (718bfd4): migrated `flux-system/flux-system-git-auth` to in-repo SOPS Secret at `apps/production/image-automation/flux-system-git-auth.sops.yaml`. Same fluxcdbot PAT, just declarative now. Helper script: `private/encrypt-flux-git-auth-secret.sh`
  - #46 step 3 (c1b5dc6): wrote `docs/secrets-inventory.md` — categorizes every cluster Secret by source-of-truth (auto-generated / Helm-state / in-repo SOPS / bootstrap / hand-applied / stale) + documents the cluster-rebuild recovery procedure
- Commits: 35ba6ed, bedcce0, b5116c1, 7df0b8f, 3584d75, e3db92a, 9e27187, 718bfd4, c1b5dc6
- Issues: #46 (substantially advanced — 3 of 5 candidate Secrets migrated; cloudflare-api-token + 3 authentik/* still TODO), #69 (filed)
- Files Modified:
  - `apps/production/monitoring/prometheus-alertmanager/.env.secret.alertmanager.encrypted` (re-encrypted with `gmail_app_password`, now to `age1sr8j…`)
  - `apps/production/monitoring/prometheus/.env.secret.prometheus-self-scrape.encrypted` (deleted)
  - `apps/production/monitoring/prometheus/kustomization.yaml`, `apps/production/monitoring/prometheus/prometheus-statefulset.yaml` (drop prometheus-secrets references)
  - `clusters/deby/apps.yaml` (re-enabled `decryption: sops`)
  - `clusters/deby/cloudflared.yaml`, `clusters/deby/image-automation.yaml` (deleted — folded back in)
  - `apps/production/kustomization.yaml` (added `./cloudflared` and `./image-automation`)
  - `apps/production/jimsmcp/kustomization.yaml`, `apps/production/jimsmcp/ghcr-jimsmcp.sops.yaml` (in-repo Secret manifest)
  - `apps/production/image-automation/kustomization.yaml`, `apps/production/image-automation/flux-system-git-auth.sops.yaml` (in-repo Secret manifest)
  - `AGENTS.md` (Tech Debt section updated; old PAT marked revoked)
  - `docs/secrets-inventory.md` (new)
  - `private/encrypt-alertmanager-secret.sh`, `private/encrypt-jimsmcp-ghcr-secret.sh`, `private/encrypt-flux-git-auth-secret.sh` (gitignored helpers)
- Follow-ups (not in this session):
  - Migrate `cert-manager/cloudflare-api-token` (the one true remaining hand-applied drift item) — same script pattern, ~5 min
  - Investigate `authentik/{authentik,authentik-postgresql,authentik-secrets}` — likely Helm-chart-owned but missing the release label, need to confirm before migrating
  - Verify durable backup of `~/.config/sops/age/keys.txt` (1Password / external) — losing this loses every in-repo Secret
  - Resolve issue #69 — bump `image.toolkit.fluxcd.io/v1beta2` → `v1` in `apps/production/image-automation/geohazardwatch-policy.yaml`
  - Update `apps/production/jimsmcp/README.md` to drop any "hand-applied imagePullSecret" caveat (cosmetic)

## 2026-05-08-01

- Agent: Claude Opus 4.7
- Subject: Lock down self-registration on geohazardwatch.com (image bump to 1.1.6)
- Current Issue: PR #61 (merged)
- Tests: end-to-end verified post-rollout — see Verification below
- Work Done:
  - Picks up `jwilleke/geohazardwatch#28` (which itself rebases on `jwilleke/ngdpbase#654` carrying the new `ngdpbase.application.registration` flag).
  - `apps/production/geohazardwatch/configmap.yaml` — added `"ngdpbase.application.registration": false` to `app-custom-config.json`.
  - `apps/production/geohazardwatch/deployment.yaml` — image tag `1.1.5` → `1.1.6`.
  - `apps/production/geohazardwatch/cronjob-import.yaml` — image tag `1.1.5` → `1.1.6`.
  - Reconciled (`flux -n flux-system reconcile kustomization apps --with-source`), restarted (`kubectl -n geohazardwatch rollout restart deploy/geohazardwatch`), waited for rollout to complete.
- Verification:
  - `GET https://geohazardwatch.com/register` → HTTP 404
  - `POST https://geohazardwatch.com/register` → HTTP 404
  - `GET https://geohazardwatch.com/wiki/request-access` → 301 → `/view/request-access` → HTTP 200 (page renders)
  - Header for anonymous visitors shows `Login` + `Request access` (link to `/wiki/request-access`); the old `Register` button is gone.
- Commits: `62352f9f`
- Files Modified:
  - apps/production/geohazardwatch/configmap.yaml
  - apps/production/geohazardwatch/deployment.yaml
  - apps/production/geohazardwatch/cronjob-import.yaml
  - docs/project_log.md (this file)

## 2026-05-07-11

- Agent: Claude Opus 4.7
- Subject: Cloudflare Tunnel live for `https://geohazardwatch.com`
- Key Decision: Carve cloudflared into its own Flux Kustomization (`clusters/deby/cloudflared.yaml`) scoped to `./apps/production/cloudflared` with `decryption.provider: sops`. Do NOT enable SOPS decryption on the broader `apps` Kustomization, because legacy encrypted files in `apps/production/monitoring/{prometheus,prometheus-alertmanager}/` use a different age recipient (`age1nur86…`) that `flux-system/sops-age` cannot decrypt — turning on SOPS for the whole tree fails the entire build.
- Work Done:
  - Discovered the in-cluster `flux-system/sops-age` private key derives public `age1sr8j9p87wuuqfnmharzqqnwj76yyc6mu5j3r5t7sr3j88wzn8exqwy6jhj`, while `scripts/_sops_config.include.sh` was hardcoded to `age1nur86…`. Two age key pairs in play; pre-existing `*.encrypted` files split across both.
  - Updated `scripts/_sops_config.include.sh` to the Flux key so future `encrypt-env-files.sh` runs target the right recipient.
  - Re-encrypted the placeholder `apps/production/transmission/.env.secret.transmission.encrypted` to the Flux key (operator confirmed transmission isn't deployed; content swapped for a placeholder).
  - Left `apps/production/monitoring/{prometheus,prometheus-alertmanager}/.env.secret.*.encrypted` untouched. They live in deployed apps and the operator hasn't authorized re-encryption — they remain consumed as opaque ciphertext via secretGenerator (current production behaviour, unchanged).
  - Created `clusters/deby/cloudflared.yaml` (new Flux Kustomization, SOPS enabled, scoped to `./apps/production/cloudflared`).
  - Reverted SOPS decryption from `clusters/deby/apps.yaml` and removed `- ./cloudflared` from `apps/production/kustomization.yaml`.
  - End-to-end verified: `https://geohazardwatch.com/` → 302 to `/view/volcanoes-and-earthquakes`, served via Cloudflare edge (`104.21.54.107`) → tunnel → `cloudflared` Deployment (2/2 ready, Cloudflare connectors healthy) → `Service/geohazardwatch:80` → wiki pod. Traefik bypassed on the public path as designed (geohazardwatch#14).
- Follow-up: rotate the tunnel token (it was visible in the agent transcript while wiring this up). After the operator re-encrypts the monitoring secrets to the Flux key, the `apps` Kustomization can also turn SOPS on if desired.
- Files Modified:
  - clusters/deby/cloudflared.yaml (new)
  - clusters/deby/apps.yaml (reverted to no decryption)
  - apps/production/kustomization.yaml (removed cloudflared entry, added explanatory note)
  - scripts/_sops_config.include.sh (correct recipient)
  - apps/production/transmission/.env.secret.transmission.encrypted (placeholder, re-encrypted)
  - docs/project_log.md (this file)

## 2026-05-07-10

- Agent: Claude Opus 4.7
- Subject: Bump geohazardwatch image to 1.1.5 (ngdpbase 3.10.2 ships `themes/`)
- Symptom on cluster: Volcano theme set in app-custom-config.json had no effect; `/themes/core.css` and `/themes/volcano/...` returned 404; `VolcanoMap` plugin's Leaflet rendering broke because core CSS variables didn't load. Filed as `geohazardwatch#26`.
- Root cause: `ghcr.io/jwilleke/ngdpbase:3.10.1` runtime image was missing the `themes/` directory. `TemplateManager` regenerated a fallback `default.css` on boot, but `core.css`, `core-variables-empty.css`, and every theme directory (`default/`, `flatly/`, `fairways/`, `volcano/`) were absent.
- Fix: Upstream PR `jwilleke/ngdpbase#652` added `COPY --from=builder /app/themes ./themes` to the Dockerfile. Released as ngdpbase v3.10.2. Bumped geohazardwatch (`jwilleke/geohazardwatch#27`) to use 3.10.2, released as v1.1.5. mj-infra-flux image tag bumped 1.1.3 → 1.1.4 (in #53) → 1.1.5 (in #55) over the day.
- Verified post-rollout: `/themes/core.css` 200, `/themes/volcano/css/variables.css` 200, `/themes/volcano/assets/favicon.svg` 200, theme + favicon visually applied, VolcanoMap renders.
- Closed: `geohazardwatch#26`.

## 2026-05-07-09

- Agent: Claude Opus 4.7
- Subject: Add cloudflared Deployment for the public Cloudflare Tunnel to geohazardwatch.com
- Work Done:
  - Created `apps/production/cloudflared/` (namespace, deployment with 2 replicas of cloudflare/cloudflared:2026.5.0, kustomization with secretGenerator from SOPS-encrypted .env, README).
  - Tunnel `tunnel-infra-flux` was created in the Cloudflare Zero Trust dashboard (Tunnel ID f222996a-d5ae-42dc-9803-08feffffeddf). Public Hostname route on the dashboard side targets `geohazardwatch.geohazardwatch.svc.cluster.local:80` with HTTP Host Header `geohazardwatch.com` — bypassing Traefik on the public path per geohazardwatch#14.
  - Encrypted the tunnel token to `apps/production/cloudflared/.env.secret.cloudflared.encrypted` via the existing scripts/encrypt-env-files.sh on deby (where the age private key lives).
  - Registered `- ./cloudflared` in `apps/production/kustomization.yaml` under "Public Applications".
- Files Modified:
  - apps/production/cloudflared/* (new dir, 5 files including encrypted secret)
  - apps/production/kustomization.yaml
  - docs/project_log.md (this file)
- Follow-up: rotate the tunnel token after the deployment is verified — the token was visible in the agent conversation transcript during setup.

## 2026-05-07-08

- Agent: Claude Opus 4.7
- Subject: Pre-seed anchor Organization JSON-LD so ngdpbase 3.10+ can bind admin role
- Symptom: After bumping geohazardwatch to v1.1.4 (ngdpbase 3.10.1), boot logs showed `Created Person record for admin` and `Created default admin user`, but `/app/data/roles/` and `/app/data/organizations/` remained empty. Admin user still resolved to `Anonymous|All` because no role record was bound.
- Root cause: `UserManager.applyRoleDiff` calls `syncRoleAdd`, which silently skips when "the install has no anchor org" (per its own JSDoc). 3.10's headless install path explicitly does NOT seed the anchor Organization from config — `services/InstallService.ts:637`: "Operators wanting a pre-seeded anchor org pre-supply the JSON-LD file alongside their custom config."
- Fix:
  - Added `geohazardwatch.json` data key to the ConfigMap with the JSON-LD Organization record (`@id: https://geohazardwatch.com`, name `GeoHazardWatch`).
  - Added `ngdpbase.application.organization.file: "geohazardwatch.json"` to `app-custom-config.json` so OrganizationManager loads it.
  - Mounted the new key into `/app/data/organizations/geohazardwatch.json` via a second `org` configMap volume + subPath.
- Follow-up after merge (one-time, on the cluster): scale to 0, sudo-delete `users.json` and the orphaned 3.9-era Person record at `/mnt/tank/jims/data/systems/geohazardwatch/persons/b4de08d8-…json`, scale back to 1. ngdpbase will see zero users, run `createDefaultAdmin`, and bind the admin role to the now-loaded Organization.
- Files Modified:
  - apps/production/geohazardwatch/configmap.yaml
  - apps/production/geohazardwatch/deployment.yaml
  - docs/project_log.md (this file)

## 2026-05-07-07

- Agent: Claude Opus 4.7
- Subject: Bump geohazardwatch image tag 1.1.3 → 1.1.4
- Work Done:
  - Picks up `jwilleke/geohazardwatch#25` which bumps the base ngdpbase image to 3.10.1.
  - 3.10 is the first ngdpbase release that creates `OrganizationRole` records on headless install, which is required for the seeded `admin` user to actually carry the `admin` role at login — without it, the cluster's admin user resolved to `Anonymous|All` and saw no Edit button or admin dashboard.
- Files Modified:
  - apps/production/geohazardwatch/deployment.yaml
  - apps/production/geohazardwatch/cronjob-import.yaml
  - docs/project_log.md (this file)

## 2026-05-07-06

- Agent: Claude Opus 4.7
- Subject: Port working theme/front-page/page-provider config from local instance to cluster
- Symptom: Site logged in as admin, but couldn't edit pages, used the wrong theme, and addon plugins didn't render. Same code worked correctly on the local jminm4 ngdpbase instance at localhost:3333.
- Diagnosis: Diffed cluster `app-custom-config.json` against the local working `data/config/app-custom-config.json` in the ngdpbase clone. Three production-relevant settings were missing.
- Fix: Added to the cluster ConfigMap:
  - `ngdpbase.theme.active: "volcano"` (was defaulting to `default` theme)
  - `ngdpbase.front-page: "volcanoes-and-earthquakes"` (was defaulting to `Welcome`)
  - `ngdpbase.page.provider: "versioningfileprovider"` (was defaulting to `filesystemprovider`; versioning provider supports the full editing UI and history)
- Did NOT port (environment-specific or sensitive): port 3333, local addons path, base-url, session secret (belongs in SOPS Secret), local backup dir, organization metadata.
- Files Modified:
  - apps/production/geohazardwatch/configmap.yaml
  - docs/project_log.md (this file)

## 2026-05-07-05

- Agent: Claude Opus 4.7
- Subject: Fix geohazardwatch DNS resolution for external hostnames (ndots:1)
- Key Decision: Override `ndots:5` (k8s default) to `ndots:1` via `dnsConfig` on both the Deployment and CronJob pod specs.
- Symptom: Initial data-import job (`/api/ve-geology/*` data sources at `webservices.volcano.si.edu`, `earthquake.usgs.gov`, etc.) failed with bare `Import failed: fetch failed` — Node's undici error message hides the underlying cause.
- Diagnosis:
  - Spawned a one-shot `curlimages/curl` pod in the `geohazardwatch` namespace.
  - `nslookup webservices.volcano.si.edu` resolved correctly via cluster DNS (10.43.0.10).
  - `curl https://webservices.volcano.si.edu/` failed with `Could not resolve host`.
  - `curl https://webservices.volcano.si.edu./` (trailing dot, FQDN) returned HTTP 404 — i.e. server reachable.
  - Conclusion: Alpine musl `getaddrinfo` mis-handles k8s `/etc/resolv.conf` `search` directive under the default `ndots:5`. The geohazardwatch image is FROM `ghcr.io/jwilleke/ngdpbase` which is FROM `node:20-alpine`. The wiki engine itself doesn't make outbound HTTPS so the issue stayed hidden until the import ran.
- Fix: Added `dnsConfig.options.ndots: "1"` to both the Deployment and CronJob pod specs. With ndots:1, any name containing at least one dot (all external hostnames) is treated as absolute first, skipping the broken search-list expansion.
- Files Modified:
  - apps/production/geohazardwatch/deployment.yaml
  - apps/production/geohazardwatch/cronjob-import.yaml
  - docs/project_log.md (this file)

## 2026-05-07-04

- Agent: Claude Opus 4.7
- Subject: Bump geohazardwatch image tag 1.1.2 → 1.1.3
- Work Done:
  - Bumped `image:` tag in `deployment.yaml` and `cronjob-import.yaml` to `1.1.3` to pick up `geohazardwatch#24` — fix for placeholder UUIDs on seed pages so the wiki actually has content.
- Files Modified:
  - apps/production/geohazardwatch/deployment.yaml
  - apps/production/geohazardwatch/cronjob-import.yaml
  - docs/project_log.md (this file)

## 2026-05-07-03

- Agent: Claude Opus 4.7
- Subject: Fix geohazardwatch addons-path so built-in ngdpbase addons keep loading
- Key Decision: Use array form for `ngdpbase.managers.addons-manager.addons-path`. ngdpbase's `AddonsManager` accepts either a string or an array, but a string REPLACES the default `./addons`, killing the built-in addon scan. Array preserves built-ins AND adds the external geohazardwatch addon.
- Work Done:
  - Changed `ngdpbase.managers.addons-manager.addons-path` from `"/opt/geohazardwatch/addons"` to `["/app/addons", "/opt/geohazardwatch/addons"]`.
  - Verified the behaviour by reading `src/managers/AddonsManager.ts` in the upstream `ngdpbase` repo (lines 208-219): the value is split on whether it's `Array.isArray()`, single strings replace; arrays scan all entries.
- Files Modified:
  - apps/production/geohazardwatch/configmap.yaml
  - docs/project_log.md (this file)

## 2026-05-07-02

- Agent: Claude Opus 4.7
- Subject: Bump geohazardwatch image tag from 1.0.1 to 1.1.2
- Work Done:
  - First publishable image of `ghcr.io/jwilleke/geohazardwatch` is `1.1.2` (1.0.1 was a placeholder; 1.1.0 and 1.1.1 publish workflows failed for separate reasons — see `jwilleke/geohazardwatch` CHANGELOG).
  - Bumped `image:` tag in `deployment.yaml` and `cronjob-import.yaml` to `1.1.2` so the manifest references a real image.
- Files Modified:
  - apps/production/geohazardwatch/deployment.yaml
  - apps/production/geohazardwatch/cronjob-import.yaml
  - docs/project_log.md (this file)

## 2026-05-07-01

- Agent: Claude Opus 4.7
- Subject: Add `geohazardwatch` app with image automation
- Key Decision: Bypass Traefik on the public path. The Cloudflare Tunnel will target the `geohazardwatch` Service directly (decided in `jwilleke/geohazardwatch#14`); Traefik IngressRoute is kept only for internal LAN verification on `geohazardwatch.nerdsbythehour.com`.
- Work Done:
  - Created `apps/production/geohazardwatch/` (namespace, configmap, deployment, service, ingress, certificate, cronjob-import, image-policy, kustomization, README).
  - Used hostPath `/mnt/tank/jims/data/systems/geohazardwatch` for `/app/data` (matches jimswiki convention; avoids `wiki` in the path per operator preference).
  - ngdpbase configured via ConfigMap to set addons-path `/opt/geohazardwatch/addons` and enable the `ve-geology` addon with `dataPath: /app/data/ve-geology`.
  - Drafted Flux `ImageRepository` + `ImagePolicy` (semver `>=1.0.0 <2.0.0`) + `ImageUpdateAutomation` in `image-policy.yaml`, but **NOT** added to the kustomization yet — the production cluster's Flux was bootstrapped without `image-reflector-controller` / `image-automation-controller`, so the CRDs don't exist. Bootstrap step documented in the app's README; once added, enable by uncommenting the resource line.
  - Nightly `CronJob` runs `import-volcanoes`, `import-earthquakes`, `import-hans` against `/app/data/ve-geology` at 08:00 UTC.
  - Registered app in `apps/production/kustomization.yaml`.
  - Pairs with `jwilleke/geohazardwatch#19` which adds the Dockerfile + image-publish workflow + Renovate.
- Files Modified:
  - `apps/production/geohazardwatch/*` (10 new files)
  - `apps/production/kustomization.yaml`
  - `docs/project_log.md` (this file)
- Follow-up: Cloudflare Tunnel wiring (`jwilleke/geohazardwatch#15-18`) — only after the site is verifiable on the LAN.

## 2026-01-29-01

- Agent: Claude Opus 4.5
- Subject: Fix Flux reconciliation and Home Assistant authentication
- Key Decision: Switch HA from ForwardAuth to direct OIDC authentication
- Current Issue: None - completed successfully
- Work Done:
  - Diagnosed Flux apps kustomization stuck in "Reconciliation in progress"
  - Root cause: Certificates stuck with IncorrectIssuer error (letsencrypt-prod vs letsencrypt-production)
  - Fixed 5 files referencing wrong ClusterIssuer name
  - Removed duplicate certificate resources (jimswiki-cert, amdwiki-cert) conflicting with ingress-created certs
  - Fixed Home Assistant "Unable to connect" error
  - Removed ForwardAuth middleware from HA ingress - using OIDC auth directly instead
  - Configured HA trusted_networks to only include local network (192.168.68.0/24) for auto-login
  - Kept k3s networks in http.trusted_proxies for proxy header trust
  - HA now uses auth_oidc for user identity via ha.nerdsbythehour.com
- Commits: 4819c04, 422483c, b7a705d
- Files Modified:
  - apps/production/amdwiki/certificate.yaml
  - apps/production/amdwiki/ingress.yaml
  - apps/production/amdwiki/kustomization.yaml
  - apps/production/jimsmcp/ingress.yaml
  - apps/production/jimswiki/jimswiki-certificate.yaml
  - apps/production/jimswiki/kustomization.yaml
  - apps/production/shared-resources/ingress.yaml
  - apps/production/home-assistant-proxy/ingress.yaml
  - (external) 192.168.68.20:/config/configuration.yaml

## 2026-01-22-05

- Agent: Claude Opus 4.5
- Subject: Attempt amdwiki fix, created upstream issue
- Key Decision: Report Dockerfile bug upstream rather than maintain local fork
- Current Issue: amdwiki blocked on upstream fix (issue #212)
- Work Done:
  - Cloned latest amdWiki from GitHub (commit 0a0391c)
  - Built Docker image and imported to k3s
  - Found Dockerfile missing TypeScript build step (npm run build)
  - Reviewed docker-compose.yml and docker-compose-traefik.yml
  - Found inconsistency: traefik compose uses old volume structure
  - Created GitHub issue: https://github.com/jwilleke/amdWiki/issues/212
  - Simplified deployment.yaml to use INSTANCE_DATA_FOLDER
  - Scaled amdwiki to 0 replicas pending upstream fix
  - Deleted abandoned kubefilebrowser deployment
- Commits: 323c234
- Files Modified:
  - apps/production/amdwiki/deployment.yaml
  - project_log.md

## 2026-01-22-04

- Agent: Claude Opus 4.5
- Subject: Fix Dependabot security vulnerabilities in jimsmcp
- Key Decision: Update dependencies via npm update
- Current Issue: None - completed successfully
- Work Done:
  - Identified 3 high severity vulnerabilities via gh CLI
  - @modelcontextprotocol/sdk ReDoS vulnerability
  - @modelcontextprotocol/sdk DNS rebinding protection not enabled
  - qs DoS via memory exhaustion (arrayLimit bypass)
  - Ran npm update and npm audit fix
  - Verified 0 vulnerabilities remain
- Commits: a3adf5e
- Files Modified:
  - apps/production/jimsmcp/package-lock.json

## 2026-01-22-03

- Agent: Claude Opus 4.5
- Subject: Implement service failure monitoring alerts
- Key Decision: Use blackbox-exporter with local DNS (192.168.68.1) for external URL probing
- Current Issue: None - completed successfully
- Work Done:
  - Added http_2xx and http_2xx_3xx probe modules to blackbox-exporter config
  - Configured blackbox-exporter with dnsPolicy: None using 192.168.68.1 for external DNS
  - Created scrape-configs.blackbox.yaml for HTTP service health probes
  - Created alerting-rules.service-health.yaml with comprehensive alerts
  - Monitored services: nerdsbythehour.com, auth, jimswiki, teslamate, grafana, ha, cdn
  - Excluded: traefik (internal), jimsmcp (internal), amd (known broken)
  - Verified alerts firing and reaching Alertmanager (Telegram notifications configured)
  - Updated monitoring README with probe commands, web UI URLs, and TODOs
- Commits: a30ac24, 24d0034, d68cf59, 3f48357
- Files Modified:
  - apps/production/monitoring/prometheus-blackbox-exporter/blackbox-deployment.yaml
  - apps/production/monitoring/prometheus-blackbox-exporter/config/blackbox-config.yaml
  - apps/production/monitoring/prometheus/kustomization.yaml
  - apps/production/monitoring/prometheus/config/alerting-rules.service-health.yaml (created)
  - apps/production/monitoring/prometheus/config/scrape-configs.blackbox.yaml (created)
  - apps/production/monitoring/README.md
  - AGENTS.md
  - project_log.md

## 2026-01-22-02

- Agent: Claude Opus 4.5
- Subject: Verify Home Assistant trusted proxies for k3s
- Key Decision: None - configuration already in place
- Current Issue: None - completed successfully
- Work Done:
  - Verified trusted_proxies config exists in HA at /config/configuration.yaml
  - Config trusts k3s pod network (10.42.0.0/16), service network (10.43.0.0/16), and host (192.168.68.71)
  - Confirmed use_x_forwarded_for: true is set
  - Tested proxy with curl - Authentik ForwardAuth redirects correctly (HTTP 302)
  - Marked task complete in AGENTS.md
- Commits: None (verification only)
- Files Modified:
  - AGENTS.md (marked task complete)
  - project_log.md (this file)

## 2026-01-22-01

- Agent: Claude Opus 4.5
- Subject: Fix JimsWiki subdomain migration and certificate issuer
- Key Decision: Migrate JimsWiki from path-based URL to subdomain for cookie domain compatibility
- Current Issue: None - completed successfully
- Work Done:
  - Diagnosed 404 error on jimswiki.nerdsbythehour.com subdomain
  - Found cert-manager annotation mismatch: "letsencrypt-prod" vs actual ClusterIssuer "letsencrypt-production"
  - Fixed ingress annotation to use correct issuer name
  - Certificate successfully issued for jimswiki.nerdsbythehour.com
  - Deleted stale certificate resource (jimswiki-cert) with wrong issuer reference
  - Verified HTTPS access returns HTTP 200 with correct session cookie
  - JimsWiki now accessible at https://jimswiki.nerdsbythehour.com/ (subdomain-based)
- Commits: 277ff3a
- Files Modified:
  - apps/production/jimswiki/jimswiki-ingress.yaml (fixed cert-manager issuer annotation)
  - project_log.md (this file)

## 2026-01-21-01

- Agent: Claude Opus 4.5
- Subject: Fix Prometheus CrashLoopBackOff and expose MQTT externally
- Key Decision: Use LoadBalancer for MQTT instead of Traefik (simpler, existing Traefik in kube-system not managed by Flux)
- Current Issue: None - completed successfully
- Work Done:
  - Diagnosed Prometheus CrashLoopBackOff (1612 restarts over 22 days)
  - Root cause: 3,232 WAL segments (44GB) causing excessive WAL replay time on startup
  - Deleted corrupted WAL files from HostPath volume
  - Updated Prometheus StatefulSet with resilience improvements:
    - Reduced retention from 30d to 15d
    - Reduced size limit from 100GB to 50GB
    - Increased CPU from 1 to 2 cores
    - Increased memory from 4Gi to 8Gi
    - Migrated from HostPath to PVC (60Gi local-path)
    - Added startup probe (30 retries x 10s = 5 min grace period)
    - Added preStop lifecycle hook (15s drain)
  - Created PodDisruptionBudget for Prometheus
  - Created alerting rules for WAL size, compaction, restarts, memory
  - Deleted and recreated StatefulSet (volumeClaimTemplate is immutable)
  - Changed Mosquitto service from ClusterIP to LoadBalancer
  - MQTT now accessible externally at 192.168.68.71:1883
- Commits: b733b0a, f7273e9, 2d43c1b
- Files Modified:
  - apps/production/monitoring/prometheus/prometheus-statefulset.yaml
  - apps/production/monitoring/prometheus/prometheus-pdb.yaml (created)
  - apps/production/monitoring/prometheus/config/alerting-rules.prometheus.yaml (created)
  - apps/production/monitoring/prometheus/kustomization.yaml
  - apps/base/traefik-ingress/kustomization.yaml (added MQTT entrypoint)
  - apps/production/messaging/mosquitto-service.yaml
  - project_log.md (this file)

## 2025-12-11-02

- Agent: Claude
- Subject: Security vulnerability analysis and remediation plan
- Key Decision: Prioritized vulnerabilities into 3 tiers for phased implementation
- Current Issue: None - completed successfully
- Work Done:
  - Reviewed ZeroThreat AI security scan report for nerdsbythehour.com
  - Analyzed 7 vulnerabilities across 3 risk tiers (39 Medium, 3 Low, 3 Information severity)
  - Created comprehensive `security/SECURITY.md` with prioritized list and recommendations
  - Priority 1 (Medium): Content Security Policy missing, ClickJacking, Insecure CORS
  - Priority 2 (Low): Strict-Transport-Security not enforced, X-Content-Type-Options missing
  - Priority 3 (Info): Email addresses disclosed, TRACE/TRACK methods detected
  - Provided code examples for each vulnerability fix
  - Assessed compliance: GDPR (Pass), OWASP Top 10 (Fail), HIPAA (Fail), PCI DSS (Fail), ISO 27001-A (Fail)
  - Created 3-week implementation roadmap
  - Updated AGENTS.md with session notes
- Commits: 0da91ba
- Files Modified:
  - `security/SECURITY.md` (created)
  - AGENTS.md (updated with session notes)
  - project_log.md (this file)

## 2025-12-11-01

- Agent: Claude
- Subject: Added zero-threat.html static page to landing page
- Key Decision: Modified serve routing config to serve specific paths as SPA fallback while allowing static files through
- Current Issue: None - completed successfully
- Work Done:
  - Created `/opt/traefik/landingpage/public/zero-threat.html` with required content
  - Created `/opt/traefik/landingpage/serve.json` config for explicit SPA route control
  - Updated Dockerfile to use serve.json for routing (replaces --single flag)
  - Rebuilt Docker image with updated config
  - Imported image to k3s containerd
  - Restarted landingpage pods
  - Verified zero-threat.html serves correct content without SPA fallback
  - Updated AGENTS.md and project_log.md with session notes
- Commits: 0907c8a
- Files Modified:
  - `/opt/traefik/landingpage/public/zero-threat.html` (created)
  - `/opt/traefik/landingpage/serve.json` (created)
  - `/opt/traefik/landingpage/Dockerfile` (updated)
  - AGENTS.md (updated with session notes)
  - project_log.md (this file)

## 2026-05-10-01

- Agent: Claude Opus 4.7
- Subject: cluster-side resolution of the geohazardwatch.com outage + source-of-truth migration for app-custom-config + Flux PAT rotation + new PAT health-check workflow. Five commits today plus one out-of-band data-dir rename on the NAS share.
- Current Issue: #70 (closed by today work); follow-ups #69 (v1beta2 ImageRepository deprecated — touched today, not fixed) and #46 (sealed-secrets/SOPS — partially advanced).
- Tests: cluster verification only — `flux get image policy/repository/update`, `kubectl get deploy/configmap -o jsonpath`, public-site `curl` smoke tests. No unit tests in this repo.
- Work Done:
  - **3bed418 — `fix(geohazardwatch): rename addon ID ve-geology -> geohazardwatch in configmap`.** The proximate cause of `https://geohazardwatch.com/view/volcanoes-and-earthquakes` showing `Plugin "VolcanoMap" not found` and `[MarqueePlugin: fetch target HansDataManager.toMarqueeText() not found]`: the `geohazardwatch` addon was renamed from `ve-geology` upstream (`jwilleke/geohazardwatch@fe8c4d3`, shipped in v1.2.0) but `apps/production/geohazardwatch/configmap.yaml` still had `ngdpbase.addons.ve-geology.enabled: true`. AddonsManager discovered the renamed addon by directory but silently disabled it because the matching `enabled` key was for the old name. Plugins/managers never registered. Two-line config rename + pod rollout-restart fixed it. Boot logs after restart show `📦 Discovered add-on: geohazardwatch v1.2.2 [enabled]` + all 7 plugins registering. Public site recovered. Cross-repo runtime safety net for this exact failure class shipped same day in `ngdpbase` v3.13.1 as `assertConfiguredAddonsExist` (jwilleke/ngdpbase#672); dev-time companion in `geohazardwatch` (jwilleke/geohazardwatch#35).
  - **aca4fdc — Flux PAT rotation (#70).** Note: the commit message reads `fix(flux): migrate flux-system-git-auth pull secret into repo (#46)` because the operator re-ran `private/encrypt-flux-git-auth-secret.sh` (the helper from the original migration), which carries that hard-coded message. **Actual semantic of this commit is the PAT rotation, not the migration** (the migration happened earlier in 718bfd4). Diagnostic chain: `flux get image update -n flux-system geohazardwatch` had been reporting `READY: False — failed to push to remote: authorization failed: Permission to jwilleke/mj-infra-flux.git denied to jwilleke` since 2026-05-09 ~15:23 UTC (the SOPS-migration commit) — the PAT encrypted into the SOPS file lacked write capability. Operator minted a new fine-grained PAT (Contents: R/W on this repo, ≥90d expiration), verified via the curl probes (`HTTP/2 200` on read; `HTTP/2 422` on write probe with `x-accepted-github-permissions: contents=write`), re-encrypted via the helper, committed, pushed. Flux source-controller reconciled the new Secret into the cluster within a minute; the next `flux reconcile image update` succeeded. Aftermath: dccfd0f — fluxcdbot pushed the bump from 1.2.2 → 1.2.3 that had been held back for ~24h, and the cluster auto-rolled.
  - **dccfd0f — auto-bump to geohazardwatch:1.2.3** (committed by `fluxcdbot`, not by hand). Side effect of fixing #70.
  - **43cfabd — `ci(flux): daily fluxcdbot PAT health check (#70 follow-up)`.** New `.github/workflows/pat-health-check.yml`. Daily cron + `workflow_dispatch`. Probes the GitHub API with a separate `FLUXCDBOT_PAT_HEALTHCHECK` Actions secret (must hold the same PAT as the SOPS file — operator updates both on rotate; the workflow header has the rotation runbook). Parses the `github-authentication-token-expiration` response header (fine-grained PATs return this on every authenticated call) and fails the workflow if (a) the PAT lost capability — non-200 response, or (b) the expiration is within 14 days. Catches both classes of failure that bit us in #70 — the silent-revoke and the silent-expire.
  - **840b87c — `feat(geohazardwatch): persistent file as single source of truth for app-custom-config`.** Removed the read-only ConfigMap overlay that masked `/app/data/config/app-custom-config.json`. After this commit, the file lives entirely on the persistent NAS-share volume (`/mnt/tank/jims/data/systems/geohazardwatch/config/app-custom-config.json`). Operators edit it three equivalent ways: from a Mac via the NAS mount, via SSH on `deby`, or via `/admin/configuration` UI Save (which now persists — previously writes failed EROFS on the read-only overlay). Pre-seeded the persistent file with current ConfigMap content (cp via `kubectl get cm -o jsonpath`) before removing the overlay so existing settings carried over.
  - **Manual data-dir rename** on the persistent volume (no git commit; out-of-band on the NAS): `/mnt/tank/jims/data/systems/geohazardwatch/ve-geology` → `geohazardwatch`. Also rewrote `app-custom-config.json` on the persistent volume to drop the now-stale `ngdpbase.addons.geohazardwatch.dataPath` override (addon defaults to `./data/geohazardwatch` which resolves to `/app/data/geohazardwatch` and matches the renamed dir). Done with `replicas=0` → `mv` → file rewrite → `replicas=1` so no in-flight write races. ~30s downtime.
  - **2c69fe3 — `chore(geohazardwatch): drop stale app-custom-config.json from ConfigMap`.** Final cleanup: removed the (now-unused, now-stale) `data.app-custom-config.json` key from the cluster ConfigMap. Replaced with a 5-line block comment pointing to the persistent file as the runtime source of truth. The ConfigMap now carries only the `geohazardwatch.json` Organization JSON-LD overlay (still needed at runtime for ngdpbase's `applyRoleDiff` admin-binding logic).
  - Trade-off note for this migration: source-of-truth shifted from "git → kubelet → pod" to "NAS → pod". Backups become more important; we lose GitOps audit trail for the runtime config. mj-infra-flux still owns deployment.yaml (image, replicas, ingress, mounts, probes) but no longer owns ngdpbase's own config.
  - Did NOT bundle: hostPath-layout cleanup (operator flagged the inconsistency that the persistent volume root maps directly to `/app/data` rather than via a `data/` subdir like .env-driven local dev — should be e.g. `/mnt/tank/jims/data/systems/geohazardwatch/data/{config,pages,...}`). Worth a separate scoped issue against this repo.
- Commits: `3bed418`, `aca4fdc`, `dccfd0f` (auto), `43cfabd`, `840b87c`, `2c69fe3`. Plus the tag `v3.13.1` on `jwilleke/ngdpbase` (referenced; not in this repo). Plus `e721636` on `jwilleke/geohazardwatch` (referenced).
- Files Modified:
  - `apps/production/geohazardwatch/configmap.yaml` (rename in 3bed418, drop data key in 2c69fe3)
  - `apps/production/geohazardwatch/deployment.yaml` (overlay removed in 840b87c)
  - `apps/production/image-automation/flux-system-git-auth.sops.yaml` (PAT re-encrypted in aca4fdc)
  - `.github/workflows/pat-health-check.yml` (new in 43cfabd)
  - this entry in `docs/project_log.md`
