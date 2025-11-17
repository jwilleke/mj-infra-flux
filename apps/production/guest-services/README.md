# Guest Services

Public-facing services that don't require authentication.

## Services

### whoami
Simple HTTP service that displays request information including IP address, headers, and connection details.

- **URL**: https://deby.nerdsbythehour.com
- **Image**: traefik/whoami:latest
- **Authentication**: None (public)
- **Purpose**: Debugging and connection information display

## Migration Status

- ✅ whoami: Migrated from default namespace to guest-services namespace
- ⏳ openspeedtest: To be migrated next

## Security

All services run as UID/GID 3003:3003 (apps:apps) for consistency with other applications.

## Notes

The whoami service was originally deployed manually in the `default` namespace. It has been migrated to:
- New namespace: `guest-services`
- Added to GitOps: Managed by Flux
- Security context: apps:apps (3003:3003)
- Resource limits: Applied for better cluster management
