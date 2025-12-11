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

## Current Status

### Last Session: 2025-12-10 (Evening)
- Diagnosed Home Assistant proxy connectivity issue
- Root cause: DNS pointing to wrong IP + HTTP/2 vs WebSocket limitation
- Applied solution: Traefik IngressRoute for proper HTTP/1.1 WebSocket support
- Files created/modified: ha-configuration.yaml, external-service.yaml, ingressroute.yaml
- Status: Awaiting verification of WebSocket connection in browser

### Known Issues
- Home Assistant WebSocket connection pending verification with IngressRoute deployment

### Next Work Items
-  Verify Home Assistant frontend loads and connects successfully
2. Monitor Home Assistant stability
3. Consider enabling Authentik ForwardAuth on other protected services
