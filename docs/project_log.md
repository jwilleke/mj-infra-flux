# Project Log

This page is for AI agent session tracking.
See [docs/planning/TODO.md](./docs/planning/TODO.md) for task planning, [CHANGELOG.md](./CHANGELOG.md) for version history.

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
