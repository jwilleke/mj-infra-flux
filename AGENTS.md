<!-- KIT:START v1.8.1-0-gf013faa — managed by mjs-project-template; edit below the KIT:END marker -->
## Agent Kit Protocols

This section is __managed by the kit__ (`install-kit.sh`) — it is identical across repos. Put repo-specific context __below the `KIT:END` marker__; do not edit here.

The heading above names the kit on purpose. It used to read `Agent Context & Protocols`, which is the
same wording a repo naturally picks for its own agent section below `KIT:END` — two identical `##`
headings in one file, and `markdownlint` MD024 fails on it. The kit owns one heading string in every
repo that installs it, so that string says whose it is.

### Session continuity

- Before starting, read the `▶ Resume here` block at the top of `TODO.md` (committed, so it syncs across machines) and recent `git log`. That is where the last session left off — repeating finished work is the most common avoidable mistake.
- Commit a chunk of work with `/session-commit`: commits code + `TODO.md`, appends a journal entry to `private/project_log.md` (the log is never committed).
- Run `/pstatus` often (after every `/session-commit`): it ranks open work and recommends the next step.
- End a session with `/wrap`: commits anything outstanding, refreshes the `▶ Resume here` pointer, and reports whether it is safe to shut down the editor.

### Priorities — GitHub labels are the source of truth

Priority labels are mutually exclusive and mean:

- `P0` — __Broken. Stop all work and fix it.__ (production down / blocked / security breach)
- `P1` — __Delivers value to the mission.__
- `P2` — __Nice to have.__
- `deferred` — consciously postponed; `needs-triage` — awaiting a priority decision.

Then:

- Security comes first. Scanner alerts (Dependabot / code-scanning / GitGuardian) become issues labeled `security` + a graded priority: critical/high → `P0`, medium → `P1`, low → `P2`.
- `TODO.md` = a `▶ Resume here` block (maintained by `/wrap`) on top, then priority bands that `/pstatus` regenerates from the labels. Do not hand-edit the bands.
- The two halves have one writer each and a deliberate handover: `/wrap` writes the resume pointer at session end, `/context` reads it at session open, and the first `/pstatus` of the session __removes__ it — by then you have already resumed, so it has served its purpose. A bands-only `TODO.md` mid-session is expected, not a loss.
- Kit files are overwritten wholesale on every sync — `.claude/commands/*.md`, `utility/sync-labels.sh`, `.markdownlint-cli2.jsonc`. Never add a rule to one of them: it is destroyed at the next sync (the installer now warns, but the rule still goes). A __generic__ rule belongs upstream in [mjs-project-template](https://github.com/jwilleke/mjs-project-template) so every repo gets it. A __repo-specific__ note about a command — a package manager the kit does not name, a scanner only this repo has — goes in `.claude/commands/<command>.local.md`, which the kit never writes, reads, or deletes. Read that file, if present, as part of the command; commit it, so it travels with the repo.
- `TODO.md` holds __no history__ — only what is open right now. Never add "merged since last run", closed/merged counts, a session narrative, a dated changelog, or work from other repos. A closed item just stops appearing; that disappearance is the whole record. Session history goes in `private/project_log.md` via `/session-commit` and `/wrap`, and nowhere else.

### Working agreement

- Think before coding: state assumptions, surface trade-offs, ask when scope is ambiguous.
- Simplicity first: the minimum that solves the problem; nothing speculative.
- Use Conventional Commits for messages.
- Issue decomposition — NEVER put "Steps", "Phases", or numbered sequences inside a single GitHub issue. Break each step into its own issue and link them using GitHub relationships: `closes #N` / `fixes #N` (resolves another), `blocked by #N` (dependency), `relates to #N` (context link). Example: a 3-phase migration = 3 issues with "blocked by" chains, not one issue with Phase headings.
- Issue/PR links — Never use a bare `#N` reference alone. Always pair it with the full GitHub URL: `[#333](https://github.com/owner/repo/issues/333)`. This applies in commit messages, PR descriptions, comments, and any agent output. Use `/issues/N` for issues and `/pull/N` for PRs.
- Awaiting approval — When work is complete but requires human sign-off before closing, apply the `in-review` label and leave a comment on the issue/PR that states: what was done, what the human needs to verify, and what action closes it. Never self-close an issue or PR.
- Closing issues — __Always remove the `in-review` label when closing__ an issue or PR (`gh issue edit N --remove-label in-review` before or with the close). Closed items must not keep `in-review`, or the label stops meaning "awaiting a decision" and the queue it drives can no longer be trusted.
- Commits — always use the `/session-commit` skill. Never run a bare `git commit` directly. `/session-commit` enforces the session log update, conventional commit format, and co-author trailer.
- Direct commits by default — commit to the default branch; do not open a pull request unless someone other than you will actually look at it before it lands. On a single-maintainer repo a self-opened, self-merged PR reviews nothing: it just splits one explanation across a commit message and a near-identical PR body. Put the reasoning in the commit message. A change touching a "risky" path, closing an issue, or feeling significant is __not__ a reason to open one — CI runs on `push` as well as `pull_request`, so a direct commit is still tested. Where a PR does exist, its body points at the commit message rather than restating it.

### Markdown conventions

__Read `.markdownlint-cli2.jsonc` before writing markdown.__ It is the control file — rules, globs
and ignores in one place, read by the editor, the CLI, CI and you, and identical in every repo the
kit installs into. Do not rely on a summary: this section deliberately does not restate the rules,
because a second copy drifts from the first the moment someone changes one.

Most markdown here is written by agents, so these are writing rules, not review rules — conform on
the first draft rather than relying on `--fix`. There is no exemption mechanism and none is wanted;
a disabled check is a check nobody revisits. Verify with `npm run lint:md`, or `npx markdownlint-cli2`
where there is no `package.json`.

Only committed files are linted: anything `.gitignore`d is generated or vendored, so its source is
linted instead.
<!-- KIT:END -->

## Project Context for AI Agents

This file serves as the single source of truth for project context and state. All AI agents (Claude, Gemini, etc.) should read this file first when working on this project.

## Team Role & Cross-Project Scope

You (Claude, and any other AI agent) operate as a __senior member of a development–deployment team__, not a one-off assistant. Act with that ownership: anticipate cluster/downstream impact, surface risk and contradictions instead of rubber-stamping, and keep shared context current for the agents who follow you.

This team runs __three coupled projects on the same `deby` host (192.168.68.71)__, treated as one effort:

- __`/home/jim/Documents/mj-infra-flux`__ (this repo) — the Flux GitOps source of truth for the k3s cluster (the *deployment* side).
- __`/home/jim/thishost`__ — the `deby` host operations workspace (the *host/infra* side: networking, storage/ZFS, systemd, alerting). Its conventions live in that workspace's own `AGENTS.md`.
- __`/home/jim/Documents/mjs-network`__ — the network domain (LAN, UniFi gear, Protect cameras, internal DNS). Its conventions live in that repo's own `AGENTS.md`.

Implications:

- The __one curated TODO digest__ covers all three repos: `~/thishost/TODO.md` (spans `jwilleke/mj-infra-flux` + `jwilleke/deby` + `jwilleke/mjs-network`). Do __not__ recreate a repo-root `TODO.md` here.
- The __one operational session log__ lives at `~/thishost/docs/project_log.md` (consolidated 2026-05-22) and covers session work touching *any* of the three repos.
- __Do not add session-shaped entries to this repo's `docs/project_log.md` or the "Completed Work" section below__ — both are frozen historical archives (entries up to 2026-05-22); see freeze headers at the top of each.
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

__Project Name:__ mj-infra-flux

__Description:__ Production Kubernetes (k3s) GitOps infrastructure running on 192.168.68.71 (deby) with Flux CD. Hosts 16+ production services including TeslaMate, JimsWiki (38,004 pages), Home Assistant, Grafana, Authentik SSO, and more. All services are managed through Git and automatically deployed via Flux.

__Primary Domain:__ nerdsbythehour.com

__Goals:__

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

__Essential Reading:__

1. __ARCHITECTURE.md__ - Complete architecture, service inventory, URLs, authentication flow
2. __DEPLOYMENT-GUIDELINES.md__ - Deployment best practices, Kustomize patterns
3. __CODE_STANDARDS.md__ - Coding standards and best practices
4. __CONTRIBUTING.md__ - Contribution gelines
5. __SETUP.md__ - Initial setup and bootstrapping instructions

__Reference Documentation:__

- __README.md__ - Quick start, common commands, usage
- __SECURITY-INCIDENT.md__ - Real security incident and lessons learned
- __docker-migration.md__ - Migration strategy from Docker to Kubernetes

__Application READMEs:__

- Each app in `apps/production/*/README.md` has detailed documentation

## Key Principles (MANDATORY)

### 1. Deployment Philosophy

__ALWAYS use Kustomize. NEVER use Helm unless absolutely necessary.__

- ✅ Use plain Kubernetes YAML + Kustomize for all new applications
- ✅ Helm is acceptable ONLY for existing third-party charts with active maintenance
- ❌ Must justify why Kustomize won't work before considering Helm

__Good Kustomize Examples:__

- `apps/production/jimswiki/` - Complex app with 38K+ files
- `apps/production/teslamate/` - Multi-component application
- `apps/production/database/` - Shared PostgreSQL
- `apps/production/messaging/` - Shared Mosquitto MQTT

### 2. Secret Management

__NEVER commit secrets in plaintext to git. This is non-negotiable.__

__Approved methods (in priority order):__

1. __SOPS + Age encryption__ (PREFERRED)

   ```bash
   # Store secrets in .env files
   # Encrypt with: ./scripts/encrypt-env-files.sh <directory>
   # Only commit .env*.encrypted files to git
   ```

2. __Cluster-only Kubernetes Secrets__

   ```bash
   # Create directly in cluster (NOT in git)
   kubectl create secret generic my-secret -n namespace --from-literal=key="value"
   # Document in README how to recreate it
   ```

3. __Helm valuesFrom__ (only if using Helm)

__Reference:__ `SECURITY-INCIDENT.md` documents a real security incident caused by improper secret handling.

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

__Example:__ `apps/production/jimswiki/README.md`

### 4. Testing Before Commit

__Always validate before committing:__

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

- __Traefik__ (kube-system) - Ingress controller
- __cert-manager__ (cert-manager) - Let's Encrypt certificates
- __Flux__ (flux-system) - GitOps automation

### Shared Services

- __PostgreSQL__ (database) - Shared database for multiple apps
- __Mosquitto__ (messaging) - MQTT broker for IoT
- __Grafana__ (monitoring) - Dashboards and monitoring
- __Authentik__ (authentik) - SSO/IdP for all protected services

### Applications

- __Landing Page__ - Public landing page at nerdsbythehour.com
- __JimsWiki__ - 38,004 pages wiki (JSPWiki)
- __TeslaMate__ - Vehicle tracking
- __Home Assistant__ - Home automation
- __Hoarder__ - Bookmark and content management
- __Guest Services__ - Public services (OpenSpeedTest, whoami)
- __jimsmcp__ - MCP server for managing infrastructure
- __Shared Resources__ - CDN for static assets

__Full inventory:__ See `ARCHITECTURE.md`

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

- __Decision:__ Migrate all Docker Compose services to k3s
- __Status:__ Phase 3 Complete - All services migrated
- __Rationale:__ Better orchestration, scaling, and GitOps integration
- __Documentation:__ `docker-migration.md`

### Kustomize Over Helm

- __Decision:__ Use Kustomize for all new deployments
- __Rationale:__ Transparency, simplicity, better GitOps integration
- __Exception:__ Existing Helm charts (e.g., Authentik) acceptable
- __Documentation:__ `DEPLOYMENT-GUIDELINES.md`

### SOPS + Age for Secrets

- __Decision:__ Use SOPS + Age encryption for all secrets in git
- __Rationale:__ Security, audit trail, GitOps compatibility
- __Alternative:__ Cluster-only secrets for highly sensitive data
- __Documentation:__ `SECURITY-INCIDENT.md` (lessons learned)

### Port Range for Applications

- __Decision:__ Run apps within ports 9200-9299 when possible
- __User/Group:__ Run as apps:apps (3003:3003) when possible
- __Rationale:__ Consistency, security, easy firewall rules

## Completed Work

> __Frozen as of 2026-05-22.__ Operational history is consolidated at [`jwilleke/deby:docs/project_log.md`](https://github.com/jwilleke/deby/blob/master/docs/project_log.md). The entries below are preserved as historical record; do not add new session-shaped entries here.

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
  - Fixed amdwiki service (<https://amd.nerdsbythehour.com>) which was showing "no available server"
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

__Status:__ In Progress - WebSocket failing due to HTTP/2 limitation

__Problem:__

- Home Assistant accessible at ha.nerdsbythehour.com but frontend shows "Unable to connect"
- Root cause: Traefik's standard Ingress uses HTTP/2, but WebSocket requires HTTP/1.1
- Traefik's HTTP/2 doesn't support the Upgrade header needed for WebSocket connections

__What's Working:__

- DNS resolution fixed (192.168.68.71 - correct Traefik IP)
- Home Assistant backend accessible at 192.168.68.20:8123
- HTTP proxy working through Traefik
- Authentik authentication working
- Home Assistant config updated with external/internal URLs

__Solution Applied:__

- Switched from standard Ingress to Traefik IngressRoute
- IngressRoute properly handles HTTP/1.1 protocol for WebSocket connections
- Created: `/home/jim/Documents/mj-infra-flux/apps/production/home-assistant-proxy/ingressroute.yaml`

__Next Steps:__

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

__Authentication Flow:__

- Public services: No authentication (landing page, guest services)
- Protected services: Authentik ForwardAuth (jimswiki, teslamate, grafana, home assistant)

__Secrets Management:__

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

1. __Read this file first__ before starting any work
2. __Read key documentation:__
   - ARCHITECTURE.md - Complete architecture
   - DEPLOYMENT-GUIDELINES.md - Deployment patterns
   - CODE_STANDARDS.md - Coding standards
   - CONTRIBUTING.md - Contribution guidelines
3. __Update this file__ after completing tasks
4. __Note your session__ in the "Completed Work" section with date and work done
5. __Follow the key principles__ - They are mandatory, not optional

### Critical Rules

- ❌ __NEVER__ commit secrets in plaintext
- ❌ __NEVER__ use Helm for new deployments without justification
- ✅ __ALWAYS__ use Kustomize for new applications
- ✅ __ALWAYS__ document in README.md
- ✅ __ALWAYS__ test before committing
- ✅ __ALWAYS__ update AGENTS.md when completing work

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

- __GitHub Repository:__ <https://github.com/jwilleke/mj-infra-flux>
- __Original Inspiration:__ <https://github.com/activescott/home-infra-k8s-flux>
- __Flux Documentation:__ <https://fluxcd.io/>
- __Kustomize Documentation:__ <https://kustomize.io/>

---

__Important:__ Keep this file synchronized and updated. It's the bridge between different agents and sessions working on the same project.

__Last Updated:__ 2026-05-22 by Claude Opus 4.7 (operational-history consolidation — session logs moved to `jwilleke/deby:docs/project_log.md`).
