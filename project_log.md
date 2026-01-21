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

- 2026-01-21-01 - Fix Prometheus CrashLoopBackOff and expose MQTT externally
- 2026-01-01-03 - Remove home assistant and hoarder
- 2026-01-01-25 - Added patch to disable node-exporter systemd collector - "Prevented D-Bus connection errors"
- 2025-12-01-01 - Fixed amdwiki service connectivity - "Rebuild amdwiki image and config"
- 2025-12-10-01 - Fixed Home Assistant proxy DNS and WebSocket - "Diagnose and fix ha.nerdsbythehour.com connectivity"
- 2025-12-11-01 - Added zero-threat.html static page - "Create unprotected zero-threat.html page on landing page"
- 2025-12-11-02 - Security vulnerability analysis and remediation plan - "Analyze ZeroThreat security scan and create SECURITY.md"

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
