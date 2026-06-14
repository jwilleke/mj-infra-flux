<!-- KIT:START — managed by mjs-project-template; edit below the KIT:END marker -->
# Agent Context & Protocols

This section is **managed by the kit** (`install-kit.sh`) — it is identical across
repos. Put repo-specific context **below the `KIT:END` marker**; do not edit here.

## Session continuity

- Before starting, read the `▶ Resume here` block at the top of `TODO.md` (committed, so it
  syncs across machines) and recent `git log`. That is where the last session left off —
  repeating finished work is the most common avoidable mistake.
- Commit a chunk of work with `/session-commit`: commits code + `TODO.md`, appends a journal
  entry to `private/project_log.md` (the log is never committed).
- Run `/status` often (after every `/session-commit`): it ranks open work and recommends
  the next step.
- End a session with `/wrap`: commits anything outstanding, refreshes the `▶ Resume here`
  pointer, and reports whether it is safe to shut down the editor.

## Priorities — GitHub labels are the source of truth

Priority labels are mutually exclusive and mean:

- `P0` — **Broken. Stop all work and fix it.** (production down / blocked / security breach)
- `P1` — **Delivers value to the mission.**
- `P2` — **Nice to have.**
- `deferred` — consciously postponed; `needs-triage` — awaiting a priority decision.

Then:

- Security comes first. Scanner alerts (Dependabot / code-scanning / GitGuardian) become
  issues labeled `security` + a graded priority: critical/high → `P0`, medium → `P1`, low → `P2`.
- `TODO.md` = a `▶ Resume here` block (maintained by `/wrap`) on top, then priority bands that
  `/status` regenerates from the labels. Do not hand-edit the bands.

## Working agreement

- Think before coding: state assumptions, surface trade-offs, ask when scope is ambiguous.
- Simplicity first: the minimum that solves the problem; nothing speculative.
- Use Conventional Commits for messages.
- Issue decomposition — NEVER put "Steps", "Phases", or numbered sequences inside a single
  GitHub issue. Break each step into its own issue and link them using GitHub relationships:
  `closes #N` / `fixes #N` (resolves another), `blocked by #N` (dependency), `relates to #N`
  (context link). Example: a 3-phase migration = 3 issues with "blocked by" chains, not one
  issue with Phase headings.

## Markdown conventions

- Dash (`-`) bullets; no bare numbered lists. ATX (`#`) headings. Spaced tables (`| a | b |`).
- Inline HTML is **not** allowed. Long lines are fine.
- Rules live in `.markdownlint.jsonc`; the editor, CLI, CI and agents all read that one file.
<!-- KIT:END -->

# Project Context for AI Agents

This file serves as the single source of truth for project context and state. All AI agents (Claude, Gemini, etc.) should read this file first when working on this project.

## Team Role & Cross-Project Scope

You (Claude, and any other AI agent) operate as a **senior member of a development–deployment team**, not a one-off assistant. Act with that ownership: anticipate cluster/downstream impact, surface risk and contradictions instead of rubber-stamping, and keep shared context current for the agents who follow you.

This team runs **three coupled projects on the same `deby` host (192.168.68.71)**, treated as one effort:

- **`/home/jim/Documents/mj-infra-flux`** (this repo) — the Flux GitOps source of truth for the k3s cluster (the *deployment* side).
- **`/home/jim/thishost`** — the `deby` host operations workspace (the *host/infra* side: networking, storage/ZFS, systemd, alerting). Its conventions live in that workspace's own `AGENTS.md`.
- **`/home/jim/Documents/mjs-network`** — the network domain (LAN, UniFi gear, Protect cameras, internal DNS). Its conventions live in that repo's own `AGENTS.md`.

Implications:

- The **one curated TODO digest** covers all three repos: `~/thishost/TODO.md` (spans `jwilleke/mj-infra-flux` + `jwilleke/deby` + `jwilleke/mjs-network`). Do **not** recreate a repo-root `TODO.md` here.
- The **one operational session log** lives at `~/thishost/docs/project_log.md` (consolidated 2026-05-22) and covers session work touching *any* of the three repos.
- **Do not add session-shaped entries to this repo's `docs/project_log.md` or the "Completed Work" section below** — both are frozen historical archives (entries up to 2026-05-22); see freeze headers at the top of each.
- New work referencing this repo records `mj-infra-flux@<sha>` in the canonical log over in `jwilleke/deby`.
- Code-side conventions still live here: `CHANGELOG.md`, ADRs, build/release notes, this `AGENTS.md` (excluding the frozen "Completed Work" section). The consolidation is operational history only.
- Live source of truth for work items is the GitHub issue trackers (`jwilleke/mj-infra-flux`, `jwilleke/deby`, `jwilleke/mjs-network`).

## Jim's Global Preference

- Remeber this is Using FLUX CI
In all interactions and commit messages 
- Be concise and sacrifice grammar for consistion
- We do Test-Driven-Developement
- DRY (Don't Repeat Yourself) principle in Documentation and Code. Refer to other Documents.
- Iterate Progressively. Start with Core features only: Gather feedback.
- Present a list of unresolved questions to answer, if any.
- Questions, Comments and Suggestions are always encouraged!
- Your primary method for interacting with GitHub should be the CLI.
- On larger objectives present phased implementation plan
- Operational session logs live in `~/thishost/docs/project_log.md` (consolidated 2026-05-22) — do NOT add session entries to this repo. Reference `mj-infra-flux@<sha>` in the canonical log instead.

## Project Overview

**Project Name:** mj-infra-flux

**Description:** Production Kubernetes (k3s) GitOps infrastructure running on 192.168.68.71 (deby) with Flux CD. Hosts 16+ production services including TeslaMate, JimsWiki (38,004 pages), Home Assistant, Grafana, Authentik SSO, and more. All services are managed through Git and automatically deployed via Flux.

**Primary Domain:** nerdsbythehour.com

**Goals:**

- Maintain a production-grade Kubernetes infrastructure using GitOps principles
- Ensure all services are highly available and properly secured
- Use Kustomize for all deployments (Helm only when absolutely necessary)
- Never commit secrets to git (use SOPS + Age encryption)
- Document everything thoroughly for future maintenance

## Current Status

- Overall Progress: Phase 3 Complete - All services migrated to k3s
- Last Updated: 2025-12-01
- Updated By: Claude (Initialization of AGENTS.md)
- Cluster Status: Production, 16+ services running
- Infrastructure: k3s on 192.168.68.71 (deby)

## Architecture & Tech Stack

see [ARCHITECTURE.md](./ARCHITECTURE.md)

## Repository Structure

```
mj-infra-flux/
├── apps/
│   ├── base/              # Base configurations (traefik, cert-manager)
│   ├── production/        # Production deployments (16 applications)
│   └── lib/               # Shared libraries (mariadb, etc.)
├── infrastructure/
│   ├── base/configs/      # Infrastructure configs (webhook, sops)
│   └── prod/              # Production infrastructure
├── clusters/
│   └── production/        # Flux system components
├── scripts/               # Utility scripts (secret encryption, bootstrapping)
├── .claude/               # Claude Code configurations
│   ├── commands/          # Custom slash commands
│   └── mcp.json           # MCP server configuration
└── docs/                  # Documentation files
```

## Key Documentation Files (READ THESE)

**Essential Reading:**

1. **ARCHITECTURE.md** - Complete architecture, service inventory, URLs, authentication flow
2. **DEPLOYMENT-GUIDELINES.md** - Deployment best practices, Kustomize patterns
3. **CODE_STANDARDS.md** - Coding standards and best practices
4. **CONTRIBUTING.md** - Contribution gelines
5. **SETUP.md** - Initial setup and bootstrapping instructions

**Reference Documentation:**

- **README.md** - Quick start, common commands, usage
- **SECURITY-INCIDENT.md** - Real security incident and lessons learned
- **docker-migration.md** - Migration strategy from Docker to Kubernetes

**Application READMEs:**
- Each app in `apps/production/*/README.md` has detailed documentation

## Key Principles (MANDATORY)

### 1. Deployment Philosophy

**ALWAYS use Kustomize. NEVER use Helm unless absolutely necessary.**

- ✅ Use plain Kubernetes YAML + Kustomize for all new applications
- ✅ Helm is acceptable ONLY for existing third-party charts with active maintenance
- ❌ Must justify why Kustomize won't work before considering Helm

**Good Kustomize Examples:**
- `apps/production/jimswiki/` - Complex app with 38K+ files
- `apps/production/teslamate/` - Multi-component application
- `apps/production/database/` - Shared PostgreSQL
- `apps/production/messaging/` - Shared Mosquitto MQTT

### 2. Secret Management

**NEVER commit secrets in plaintext to git. This is non-negotiable.**

**Approved methods (in priority order):**

1. **SOPS + Age encryption** (PREFERRED)
   ```bash
   # Store secrets in .env files
   # Encrypt with: ./scripts/encrypt-env-files.sh <directory>
   # Only commit .env*.encrypted files to git
   ```

2. **Cluster-only Kubernetes Secrets**
   ```bash
   # Create directly in cluster (NOT in git)
   kubectl create secret generic my-secret -n namespace --from-literal=key="value"
   # Document in README how to recreate it
   ```

3. **Helm valuesFrom** (only if using Helm)

**Reference:** `SECURITY-INCIDENT.md` documents a real security incident caused by improper secret handling.

### 3. Documentation Requirements

Every application MUST have a README.md with:
1. Overview - What it does
2. URL - Where it's accessed
3. Data Paths - Where persistent data is stored
4. Dependencies - What other services it needs
5. Configuration - How to configure it
6. Secrets - Exact kubectl commands to manage secrets
7. Deployment - How to deploy/update
8. Troubleshooting - Common issues

**Example:** `apps/production/jimswiki/README.md`

### 4. Testing Before Commit

**Always validate before committing:**
```bash
# 1. Validate Kustomize
kubectl kustomize apps/production/myapp/

# 2. Dry-run
kubectl apply -k apps/production/myapp/ --dry-run=client

# 3. Apply to cluster
kubectl apply -k apps/production/myapp/

# 4. Verify
kubectl get pods -n namespace
kubectl logs -n namespace -l app=myapp

# 5. Test functionality (curl, browser)
```

## Production Services

### Core Infrastructure
- **Traefik** (kube-system) - Ingress controller
- **cert-manager** (cert-manager) - Let's Encrypt certificates
- **Flux** (flux-system) - GitOps automation

### Shared Services
- **PostgreSQL** (database) - Shared database for multiple apps
- **Mosquitto** (messaging) - MQTT broker for IoT
- **Grafana** (monitoring) - Dashboards and monitoring
- **Authentik** (authentik) - SSO/IdP for all protected services

### Applications
- **Landing Page** - Public landing page at nerdsbythehour.com
- **JimsWiki** - 38,004 pages wiki (JSPWiki)
- **TeslaMate** - Vehicle tracking 
- **Home Assistant** - Home automation
- **Hoarder** - Bookmark and content management
- **Guest Services** - Public services (OpenSpeedTest, whoami)
- **jimsmcp** - MCP server for managing infrastructure
- **Shared Resources** - CDN for static assets

**Full inventory:** See `ARCHITECTURE.md`

## Data Organization

### NFS Mount (Persistent, Backed Up)
```
/home/jim/docs/data/systems/
├── mj-infra-flux/          # k3s application data
│   ├── grafana/            # Grafana config
│   ├── mosquitto/          # MQTT config & data
│   ├── postgresql/         # Database backups
│   ├── teslamate/          # TeslaMate config
│   └── jimswiki/           # JSPWiki config
├── shared-resources/       # CDN static assets
└── wikis/
    └── jimswiki/           # 38,004 wiki pages (CRITICAL)
```

### Local SSD (Fast, Ephemeral)
```
/mnt/local-k3s-data/
├── postgresql/             # PostgreSQL data (8Gi)
├── grafana/                # Grafana dashboards
├── jimswiki-work/          # JSPWiki cache
└── jimswiki-logs/          # JSPWiki logs
```

## Common Commands

### Flux Operations
```bash
# Force reconciliation
flux reconcile kustomization flux-system --with-source

# Show all Flux objects not ready
flux get all -A --status-selector ready=false

# Watch flux events
flux events -w

# Force reconcile apps
flux reconcile kustomization apps
```

### Kustomize Operations
```bash
# Validate manifests
kubectl kustomize apps/production/myapp/

# Dry-run apply
kubectl apply -k apps/production/myapp/ --dry-run=client

# Apply to cluster
kubectl apply -k apps/production/myapp/
```

### Secret Management
```bash
# Encrypt secrets with SOPS + Age
./scripts/encrypt-env-files.sh apps/production/myapp/

# Create cluster-only secret
kubectl create secret generic my-secret -n namespace \
  --from-literal=key="value"
```

### Debugging
```bash
# Check pod status
kubectl get pods -n namespace

# View pod logs
kubectl logs -n namespace -l app=myapp

# Describe resource
kubectl describe pod -n namespace pod-name

# Port forward for testing
kubectl port-forward -n namespace svc/myservice 8080:80
```

## Key Decisions

### Migration to Kubernetes
- **Decision:** Migrate all Docker Compose services to k3s
- **Status:** Phase 3 Complete - All services migrated
- **Rationale:** Better orchestration, scaling, and GitOps integration
- **Documentation:** `docker-migration.md`

### Kustomize Over Helm
- **Decision:** Use Kustomize for all new deployments
- **Rationale:** Transparency, simplicity, better GitOps integration
- **Exception:** Existing Helm charts (e.g., Authentik) acceptable
- **Documentation:** `DEPLOYMENT-GUIDELINES.md`

### SOPS + Age for Secrets
- **Decision:** Use SOPS + Age encryption for all secrets in git
- **Rationale:** Security, audit trail, GitOps compatibility
- **Alternative:** Cluster-only secrets for highly sensitive data
- **Documentation:** `SECURITY-INCIDENT.md` (lessons learned)

### Port Range for Applications
- **Decision:** Run apps within ports 9200-9299 when possible
- **User/Group:** Run as apps:apps (3003:3003) when possible
- **Rationale:** Consistency, security, easy firewall rules

## Completed Work

> **Frozen as of 2026-05-22.** Operational history is consolidated at [`jwilleke/deby:docs/project_log.md`](https://github.com/jwilleke/deby/blob/master/docs/project_log.md). The entries below are preserved as historical record; do not add new session-shaped entries here.

### Session: 2025-12-01 (Morning)
- Agent: Claude
- Work Done:
  - Initialized AGENTS.md with complete project context
  - Consolidated documentation from CLAUDE.md and other files
  - Removed CLAUDE.md (replaced by AGENTS.md)
  - Updated README.md to reference AGENTS.md
- Files Modified: AGENTS.md (created), CLAUDE.md (removed), README.md

### Session: 2025-12-01 (Afternoon)
- Agent: Claude
- Work Done:
  - Fixed amdwiki service (https://amd.nerdsbythehour.com) which was showing "no available server"
  - Rebuilt amdwiki Docker image from source (missing config files)
  - Imported rebuilt image to k3s cluster
  - Copied config files from Docker image to host directory at `/home/jim/docs/data/systems/mj-infra-flux/amdwiki/config/`
  - Fixed enableServiceLinks issue causing port misconfiguration (app was trying to listen on malformed address)
  - Set `amdwiki.install.completed: true` in production config to skip installation wizard
  - Updated deployment with increased readiness probe failure threshold
- Files Modified:
  - `apps/production/amdwiki/deployment.yaml` (added enableServiceLinks: false, increased readiness failureThreshold)
  - `/home/jim/docs/data/systems/mj-infra-flux/amdwiki/config/app-production-config.json` (added install.completed flag)

### Session: 2025-12-10 (Evening)
- Agent: Claude
- Work Done:
  - Fixed Home Assistant proxy connectivity issue (ha.nerdsbythehour.com)
  - Diagnosed: DNS was pointing to wrong IP (192.168.68.20 instead of Traefik at 192.168.68.71)
  - Fixed Home Assistant config: updated external_url and internal_url for new domain
  - Fixed service backend: changed from HTTPS to HTTP (backend runs on HTTP)
  - Root cause of "Unable to connect": Traefik Ingress uses HTTP/2 but WebSocket needs HTTP/1.1
  - Solution: Migrated from standard Ingress to Traefik IngressRoute for proper WebSocket support
- Files Modified:
  - `private/ha-configuration.yaml` (added external_url, internal_url, auth_providers, fixed HTTP config)
  - `apps/production/home-assistant-proxy/external-service.yaml` (changed serversscheme from https to http)
  - `apps/production/home-assistant-proxy/ingress.yaml` (simplified, removed duplicate API ingress)
  - `apps/production/home-assistant-proxy/ingressroute.yaml` (created, replaces Ingress with proper WebSocket support)

### Session: 2025-12-11 (Evening)
- Agent: Claude
- Work Done:
  - Added zero-threat.html static page to landing page unprotected
  - Created `/opt/traefik/landingpage/public/zero-threat.html` with required content
  - Modified serve configuration to serve specific routes as SPA fallback while serving zero-threat.html as static file
  - Updated Dockerfile to use explicit serve.json config for SPA routing control
  - Rebuilt Docker image, imported to k3s, deployed and verified serving correct content
  - Issue resolution: serve's default behavior was rewriting all 404s to index.html; solved with explicit rewrite config limiting to "/" and "/guest" routes only
- Files Modified:
  - `/opt/traefik/landingpage/public/zero-threat.html` (created static page)
  - `/opt/traefik/landingpage/serve.json` (created serve config with specific rewrites)
  - `/opt/traefik/landingpage/Dockerfile` (updated to use serve.json for routing control)

### Session: 2026-05-09 (geohazardwatch image automation end-to-end)
- Agent: Claude Opus 4.7
- Work Done:
  - Closed issue #64. Image automation now runs end-to-end for geohazardwatch: GHCR scan → ImagePolicy resolves to highest semver in range → fluxcdbot pushes auto-bump commit → Flux reconciles → rolling deploy.
  - Regenerated `clusters/deby/flux-system/gotk-components.yaml` via `flux install --components=...,image-reflector-controller,image-automation-controller --version=v2.7.3 --export`. The previous file referenced these controllers only in RBAC; the Deployments were missing.
  - Established a new pattern for cluster-level Flux automation: `apps/production/image-automation/` (no `namespace:` directive in its kustomization) reconciled by a dedicated Flux Kustomization at `clusters/deby/image-automation.yaml` with `decryption: sops`. Mirrors the cloudflared pattern; sidesteps the apps Kustomization (which can't enable decryption while legacy prometheus SOPS files use an unavailable age recipient).
  - Out-of-band `flux-system-git-auth` Secret on the cluster (matches the `sops-age` pattern) gives fluxcdbot push access via a fine-grained PAT scoped to mj-infra-flux only.
  - Replicate this layout for jimsmcp / future apps: drop a `<app>-policy.yaml` + `<app>-ghcr.sops.yaml` next to the existing files.
- PRs: #65 (reverted), #66 (reverted), #67 (revert), #68 (final structural fix).
- Files Modified: `clusters/deby/flux-system/gotk-components.yaml`, `clusters/deby/flux-system/gotk-sync.yaml`, `clusters/deby/image-automation.yaml`, `apps/production/image-automation/{kustomization,geohazardwatch-policy,geohazardwatch-ghcr.sops}.yaml`, `apps/production/geohazardwatch/{deployment,kustomization,README}.md`, `apps/production/geohazardwatch/image-policy.yaml` (deleted), `docs/project_log.md`, `AGENTS.md`.
- Follow-ups outstanding:
  - Revoke the old GHCR PAT (`ghp_dUUY1T9N…`) — rotated to a fine-grained PAT during this session.
  - Re-encrypt `apps/production/monitoring/prometheus/.env.secret.prometheus-self-scrape.encrypted` and `apps/production/monitoring/prometheus-alertmanager/.env.secret.alertmanager.encrypted` from `age1nur86…` to the unified `age1sr8j…` — currently apply as garbled-but-functional env vars; blocks any future "enable SOPS on apps Kustomization" cleanup.

### Session: 2025-12-11 (Night)
- Agent: Claude
- Work Done:
  - Reviewed ZeroThreat security scan report for nerdsbythehour.com
  - Created comprehensive security vulnerability analysis in `security/SECURITY.md`
  - Prioritized 7 vulnerabilities across 3 tiers (Medium/Low/Information)
  - Provided implementation recommendations with code examples for each vulnerability
  - Key findings: Missing security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options), insecure CORS, clickjacking risk, email disclosure
  - Created 3-week implementation roadmap for remediation
  - Compliance status: GDPR (Pass), OWASP Top 10 (Fail), HIPAA (Fail), PCI DSS (Fail), ISO 27001-A (Fail)
- Files Modified:
  - `security/SECURITY.md` (created comprehensive vulnerability report with prioritized recommendations)

## Current Issues & Blockers

### Active Issue: Home Assistant Proxy WebSocket Connection

**Status:** In Progress - WebSocket failing due to HTTP/2 limitation

**Problem:**
- Home Assistant accessible at ha.nerdsbythehour.com but frontend shows "Unable to connect"
- Root cause: Traefik's standard Ingress uses HTTP/2, but WebSocket requires HTTP/1.1
- Traefik's HTTP/2 doesn't support the Upgrade header needed for WebSocket connections

**What's Working:**
- DNS resolution fixed (192.168.68.71 - correct Traefik IP)
- Home Assistant backend accessible at 192.168.68.20:8123
- HTTP proxy working through Traefik
- Authentik authentication working
- Home Assistant config updated with external/internal URLs

**Solution Applied:**
- Switched from standard Ingress to Traefik IngressRoute
- IngressRoute properly handles HTTP/1.1 protocol for WebSocket connections
- Created: `/home/jim/Documents/mj-infra-flux/apps/production/home-assistant-proxy/ingressroute.yaml`

**Next Steps:**
- Verify WebSocket connection works after IngressRoute deployment
- Test frontend can establish connection to backend API

### Potential Improvements
- Create port allocation table for all applications (ports 9200-9220)
- Monitor for security updates on all containers
- Review and optimize resource allocations as needed

## TODO & Next Steps

### High Priority

- [ ] Enable Authentik ForwardAuth on protected services (jimswiki, teslamate, grafana, home assistant)
- [x] Configure Home Assistant trusted proxies for k3s (completed 2026-01-22)
- [ ] Monitor and maintain service health

### Medium Priority

- [ ] Review and update documentation as services change
- [ ] Consider migrating remaining Helm deployments to Kustomize
- [ ] Set up automated backups for critical data
- [x] Implement monitoring alerts for service failures (completed 2026-01-22)

### Low Priority

- [ ] Docker cleanup (after verification period)
- [ ] Optimize resource requests/limits across services
- [ ] Review and update security policies
- [ ] Consider implementing network policies

### Tech Debt (surfaced 2026-05-09)

- [x] Revoke old GHCR PAT (`ghp_dUUY1T9N…`) — completed 2026-05-09; rotated to fine-grained PAT earlier same day.
- [x] Re-encrypt / clean up the two prometheus SOPS files — completed 2026-05-09. The prometheus self-scrape file held unused basic-auth credentials (replaced by Authentik ForwardAuth long ago); deleted along with its volume mount. The alertmanager file held a stale `telegram_bot_token` from before the Telegram→Gmail switch (`fd8922a`); replaced with `gmail_app_password` re-encrypted to `age1sr8j…`. Then SOPS decryption was re-enabled on the apps Kustomization (commit `b5116c1`) — fixed Gmail SMTP auth which had been silently failing since `fd8922a`.

## Notes & Context

### Security Model

**Authentication Flow:**
- Public services: No authentication (landing page, guest services)
- Protected services: Authentik ForwardAuth (jimswiki, teslamate, grafana, home assistant)

**Secrets Management:**
- SOPS + Age encryption for secrets in git
- Cluster-only secrets for highly sensitive data
- Never commit plaintext secrets (see SECURITY-INCIDENT.md)

### Resource Ownership

Prefer running as apps:apps (3003:3003):
```yaml
securityContext:
  runAsUser: 3003
  runAsGroup: 3003
  fsGroup: 3003
```

Exception: When image requires root (document why in README).

### Namespace Strategy

- One namespace per logical application
- Shared services get dedicated namespaces:
  - `database` - Shared PostgreSQL
  - `messaging` - Shared MQTT
  - `monitoring` - Grafana/Prometheus
  - `authentik` - SSO/IdP

### Git Practices

- Work directly on `master` branch (small repo, sole maintainer)
- Use descriptive commit messages with "why" not just "what"
- End commits with Claude Code attribution
- Never commit secrets, age keys, or unencrypted .env files

## Agent Guidelines

### For All Agents

1. **Read this file first** before starting any work
2. **Read key documentation:**
   - ARCHITECTURE.md - Complete architecture
   - DEPLOYMENT-GUIDELINES.md - Deployment patterns
   - CODE_STANDARDS.md - Coding standards
   - CONTRIBUTING.md - Contribution guidelines
3. **Update this file** after completing tasks
4. **Note your session** in the "Completed Work" section with date and work done
5. **Follow the key principles** - They are mandatory, not optional

### Critical Rules

- ❌ **NEVER** commit secrets in plaintext
- ❌ **NEVER** use Helm for new deployments without justification
- ✅ **ALWAYS** use Kustomize for new applications
- ✅ **ALWAYS** document in README.md
- ✅ **ALWAYS** test before committing
- ✅ **ALWAYS** update AGENTS.md when completing work

### When in Doubt

1. Check `DEPLOYMENT-GUIDELINES.md`
2. Look for similar examples in `apps/production/`
3. Review `CODE_STANDARDS.md` for coding patterns
4. Ask the user for clarification
5. Document decisions in README

### Quick Command Reference

```bash
# Apply changes
kubectl apply -k apps/production/myapp/

# Encrypt secrets
./scripts/encrypt-env-files.sh apps/production/myapp/

# Force Flux sync
flux reconcile kustomization flux-system --with-source

# Check status
flux get all -A --status-selector ready=false
kubectl get pods -A
```

## References

- **GitHub Repository:** https://github.com/jwilleke/mj-infra-flux
- **Original Inspiration:** https://github.com/activescott/home-infra-k8s-flux
- **Flux Documentation:** https://fluxcd.io/
- **Kustomize Documentation:** https://kustomize.io/

---

**Important:** Keep this file synchronized and updated. It's the bridge between different agents and sessions working on the same project.

**Last Updated:** 2026-05-22 by Claude Opus 4.7 (operational-history consolidation — session logs moved to `jwilleke/deby:docs/project_log.md`).
