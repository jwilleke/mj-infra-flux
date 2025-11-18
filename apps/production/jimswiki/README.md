# JimsWiki - Kubernetes Deployment

JSPWiki instance deployed at https://nerdsbythehour.com/jimswiki/

## Overview

Migrated from Docker (/opt/traefik/jimswiki) to k3s while preserving all wiki data.

- **Application:** Apache JSPWiki on Tomcat 9.0.108
- **Docker Image:** `aug12018/jimswiki:latest` (custom build)
- **Namespace:** `jimswiki`
- **URL:** https://nerdsbythehour.com/jimswiki/
- **Wiki Pages:** 38,004 pages (3.4GB)
- **Security:** Protected by Authentik ForwardAuth (to be enabled)

## Critical Data Paths

**⚠️ IMPORTANT: These paths MUST NOT change - 38,004 wiki pages depend on them!**

- **Wiki Pages:** `/home/jim/docs/data/systems/wikis/jimswiki`
  - NFS mount: `192.168.68.41:/volume/.../jims/.data` → `/home/jim/docs`
  - Contains 38,004+ .txt files
  - Total size: 3.4GB

- **Configuration:** `/opt/traefik/jimswiki/config`
  - jspwiki-custom.properties
  - userdatabase.xml, groupdatabase.xml
  - log4j2.xml, jspwiki-ehcache.xml

- **Logs:** `/opt/traefik/jimswiki/logs`
  - Tomcat catalina logs

- **Work Directory:** `/opt/traefik/jimswiki/work`
  - Tomcat work directory (cache, compiled JSPs)
  - Contains refmgr.ser (reference manager cache for 38K pages)

## Architecture

### Deployment Configuration

```yaml
Replicas: 1
Security Context: apps:apps (3003:3003)
Resources:
  Requests: 500m CPU, 1Gi RAM
  Limits: 2000m CPU, 2Gi RAM
```

### Volume Mounts

All volumes use `hostPath` to mount from the k3s node:

1. **Wiki Pages** (Critical - 38,004 files):
   ```yaml
   hostPath: /home/jim/docs/data/systems/wikis/jimswiki
   mountPath: /home/jim/docs/data/systems/wikis/jimswiki
   ```

2. **Configuration Files**:
   ```yaml
   hostPath: /opt/traefik/jimswiki/config
   mountPath: /var/jspwiki/etc
   ```

3. **Logs**:
   ```yaml
   hostPath: /opt/traefik/jimswiki/logs
   mountPath: /usr/local/tomcat/logs
   ```

4. **Work Directory**:
   ```yaml
   hostPath: /opt/traefik/jimswiki/work
   mountPath: /usr/local/tomcat/work
   ```

5. **Startup Script** (from ConfigMap):
   ```yaml
   configMap: jimswiki-startup
   mountPath: /startup.sh
   ```

### Startup Script

The startup script (in jimswiki-configmap.yaml) performs critical tasks:

1. Moves webapp from `ROOT` to `jimswiki` context
2. Copies `jspwiki-custom.properties` to WEB-INF/classes
3. Copies `log4j2.xml` to WEB-INF/classes
4. Starts Tomcat

**Do not remove or modify** - essential for proper operation.

## Environment Variables

```yaml
JAVA_HOME: /opt/java/openjdk
CATALINA_OPTS: -Djspwiki.baseURL=https://nerdsbythehour.com/jimswiki
jspwiki_fileSystemProvider_pageDir: /home/jim/docs/data/systems/wikis/jimswiki
jspwiki_basicAttachmentProvider_storageDir: /home/jim/docs/data/systems/wikis/jimswiki
jspwiki_applicationName: JimsWiki
```

## Ingress Configuration

- **Host:** nerdsbythehour.com
- **Path:** /jimswiki (Prefix)
- **Priority:** 100 (higher than landing page)
- **TLS:** Let's Encrypt via cert-manager
- **Authentication:** Authentik ForwardAuth (to be enabled)

## Deployment

### Prerequisites

1. Docker image must be available in k3s containerd:
   ```bash
   docker save aug12018/jimswiki:latest | sudo k3s ctr images import -
   ```

2. Verify NFS mount is active:
   ```bash
   ls -la /home/jim/docs/data/systems/wikis/jimswiki | wc -l  # Should show ~38,000
   ```

3. Configuration files must exist:
   ```bash
   ls -la /opt/traefik/jimswiki/config/
   ```

### Apply to Kubernetes

```bash
# Apply with kubectl
sudo kubectl apply -k apps/production/jimswiki/

# Or let Flux reconcile
git add apps/production/jimswiki/
git commit -m "Add jimswiki to k3s"
git push
flux reconcile kustomization flux-system --with-source
```

### Verify Deployment

```bash
# Check pods
sudo kubectl get pods -n jimswiki

# Check logs (startup may take 30-60 seconds with 38K pages)
sudo kubectl logs -n jimswiki -l app=jimswiki -f

# Check ingress
sudo kubectl get ingress -n jimswiki

# Test access
curl -k https://nerdsbythehour.com/jimswiki/
```

## Important Notes

### First Startup Time

With 38,004 wiki pages:
- **First startup:** 30-60 seconds
- JSPWiki builds reference manager cache (refmgr.ser)
- Subsequent startups will be faster using cached data

### Lucene Search

Search indexing is **disabled** in jspwiki-custom.properties:
```properties
jspwiki.searchProvider=
jspwiki.use.lucene=false
```

This was necessary to prevent startup issues with the large page set.

### Context Path

JSPWiki is deployed at `/jimswiki` context (not ROOT):
- Startup script moves webapp to correct location
- No StripPrefix middleware needed
- All URLs are: `/jimswiki/...`

### File Permissions

The container runs as `apps:apps` (3003:3003):
- All hostPath volumes must be readable by uid 3003
- Config files: owned by apps:apps
- Wiki pages: owned by napp-it:unifi-drive (but readable by all)

## Authentication

**Current Status:** Authentik ForwardAuth is commented out in ingress

**To Enable:**
1. Configure Authentik application for jimswiki
2. Create ForwardAuth middleware
3. Uncomment annotation in jimswiki-ingress.yaml:
   ```yaml
   traefik.ingress.kubernetes.io/router.middlewares: authentik-forwardauth-jimswiki@kubernetescrd
   ```

**Required Access:**
- Group: `jimswiki` (or similar)
- Users: admin, jim (from Docker Authelia config)

## Migration from Docker

### Docker Configuration

Old location: `/opt/traefik/jimswiki/`

**docker-compose.yml section:**
```yaml
jimswiki:
  image: aug12018/jimswiki:latest
  container_name: jimswiki
  volumes:
    - /home/jim/docs/data/systems/wikis/jimswiki:/home/jim/docs/data/systems/wikis/jimswiki
    - ./jimswiki/config:/var/jspwiki/etc
    - ./jimswiki/logs:/usr/local/tomcat/logs
    - ./jimswiki/work:/usr/local/tomcat/work
    - ./jimswiki/tomcat-config/startup.sh:/startup.sh:ro
```

### Kubernetes Migration

All volume mounts preserved with identical paths using hostPath.

**No data migration needed** - wiki pages remain at same location.

## Troubleshooting

### Pod Not Starting

Check logs:
```bash
sudo kubectl logs -n jimswiki -l app=jimswiki --tail=100
```

Common issues:
- Image not imported to k3s containerd
- NFS mount not accessible
- Config files missing or wrong permissions

### CSS Not Loading

Verify webapp is at `/jimswiki` context:
```bash
sudo kubectl exec -n jimswiki -it deployment/jimswiki -- ls -la /usr/local/tomcat/webapps/
```

Should show `jimswiki` directory, not `ROOT`.

### Slow Startup

Normal with 38K pages. Check progress:
```bash
sudo kubectl logs -n jimswiki -l app=jimswiki -f
```

Watch for "Server startup in XXXX milliseconds"

### Permission Denied

Verify pod runs as uid 3003:
```bash
sudo kubectl exec -n jimswiki -it deployment/jimswiki -- id
```

Check hostPath permissions:
```bash
ls -la /home/jim/docs/data/systems/wikis/jimswiki
ls -la /opt/traefik/jimswiki/config
```

## Related Documentation

- Original Docker setup: `/opt/traefik/jimswiki/README.md`
- Migration plan: `docker-migration.md` (Phase 3)
- JSPWiki docs: https://jspwiki-wiki.apache.org/
- Traefik docs: https://doc.traefik.io/traefik/
