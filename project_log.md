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

- 2025-12-01-01 - Fixed amdwiki service connectivity - "Rebuild amdwiki image and config"
- 2025-12-10-01 - Fixed Home Assistant proxy DNS and WebSocket - "Diagnose and fix ha.nerdsbythehour.com connectivity"
- 2025-12-11-01 - Added zero-threat.html static page - "Create unprotected zero-threat.html page on landing page"

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
- Commits: pending
- Files Modified:
  - `/opt/traefik/landingpage/public/zero-threat.html` (created)
  - `/opt/traefik/landingpage/serve.json` (created)
  - `/opt/traefik/landingpage/Dockerfile` (updated)
  - AGENTS.md (updated with session notes)
  - project_log.md (this file)
