# Guest Services

Public-facing services that don't require authentication.

## Services

### whoami
Simple HTTP service that displays request information including IP address, headers, and connection details.

- **URL**: https://deby.nerdsbythehour.com
- **Image**: traefik/whoami:latest
- **Authentication**: None (public)
- **Purpose**: Debugging and connection information display
- **Security**: Runs as apps:apps (3003:3003)

### openspeedtest
Self-hosted network speed testing tool for measuring upload and download speeds.

- **URL**: https://nerdsbythehour.com/speed
- **Image**: Custom build from /opt/traefik/openspeedtest
- **Authentication**: None (public)
- **Purpose**: Network speed testing
- **Security**: Runs as root (nginx requirement for temp directories)
- **Features**:
  - HTML5-based speed test (no Flash required)
  - Measures download and upload speeds
  - Displays latency and jitter
  - Works behind Traefik reverse proxy

## Migration Status

- ✅ whoami: Migrated from default namespace to guest-services namespace
- ✅ openspeedtest: Migrated from Docker to k3s

## Deployment Notes

### Building openspeedtest Image

```bash
cd /opt/traefik/openspeedtest
docker build -t openspeedtest:latest .
docker save openspeedtest:latest -o /tmp/openspeedtest.tar
sudo k3s ctr images import /tmp/openspeedtest.tar
```

### Updating openspeedtest

When making changes to the OpenSpeedTest source or configuration:

1. Rebuild the image
2. Re-import to k3s
3. Restart the deployment:
   ```bash
   sudo kubectl rollout restart deployment/openspeedtest -n guest-services
   ```

## Security

- **whoami**: Runs as UID/GID 3003:3003 (apps:apps)
- **openspeedtest**: Runs as root (required by nginx to create temp directories)

## Notes

- Both services are linked from the landing page `/guest` route
- All services use Traefik ingress with Let's Encrypt TLS certificates
- Services are managed by Flux GitOps from this repository
