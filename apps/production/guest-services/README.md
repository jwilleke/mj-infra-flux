# Guest Services

Public-facing services that don't require authentication.

## Services

### whoami

Simple HTTP service that displays request information including IP address, headers, and connection details.

- __URL__: <https://deby.nerdsbythehour.com>
- __Image__: traefik/whoami:latest
- __Authentication__: None (public)
- __Purpose__: Debugging and connection information display
- __Security__: Runs as apps:apps (3003:3003)

### openspeedtest

Self-hosted network speed testing tool for measuring upload and download speeds.

- __URL__: <https://nerdsbythehour.com/speed>
- __Image__: Custom build from /opt/traefik/openspeedtest
- __Authentication__: None (public)
- __Purpose__: Network speed testing
- __Security__: Runs as root (nginx requirement for temp directories)
- __Features__:
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

- __whoami__: Runs as UID/GID 3003:3003 (apps:apps)
- __openspeedtest__: Runs as root (required by nginx to create temp directories)

## Notes

- Both services are linked from the landing page `/guest` route
- All services use Traefik ingress with Let's Encrypt TLS certificates
- Services are managed by Flux GitOps from this repository

## Operations summary

*Moved from homelab `network/apps/guest-services.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

Two small helper pages. OpenSpeedTest lets anyone on the LAN test their speed to
deby. whoami echoes back request headers, which helps when checking Traefik.

### Access

| Item | Value |
| --- | --- |
| Speed test | <https://nerdsbythehour.com/speed> |
| whoami | <https://deby.nerdsbythehour.com> |
| Reach | LAN only (DNS points at deby) |
| Sign-in | None |

### Where it runs / where data lives

deby, namespace `guest-services`. `openspeedtest:latest` is built on deby and
imported into k3s (`imagePullPolicy: Never`). whoami is `traefik/whoami` v1.12.0.
No data.

### Secrets

None.

### Dependencies

Traefik, cert-manager.

### Recovery

(a) Pod broken:

```bash
kubectl -n guest-services get pods
kubectl -n guest-services rollout restart deploy
```

(b) Data lost: nothing to lose.

(c) deby rebuilt: the openspeedtest image is not in any registry. Rebuild and
import it before Flux can start the pod:

```bash
docker build -t openspeedtest:latest <source dir>   # source dir: Unknown — to fill in
docker save openspeedtest:latest -o /tmp/ost.tar && sudo k3s ctr images import /tmp/ost.tar
```

### Health checks

```bash
curl -s https://deby.nerdsbythehour.com/ | head -5
curl -o /dev/null -w "%{http_code}\n" https://nerdsbythehour.com/speed
```

### Known gaps

- OpenSpeedTest image is local only; where its build files live is unknown.
