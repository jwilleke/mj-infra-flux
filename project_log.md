# Project Log

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
1. Verify Home Assistant frontend loads and connects successfully
2. Monitor Home Assistant stability
3. Consider enabling Authentik ForwardAuth on other protected services
