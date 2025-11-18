# mjplex - Plex Media Server

Plex Media Server for movies, TV shows, and photos.

## Overview

- **URL:** https://plex.nerdsbythehour.com
- **Namespace:** `mjplex`
- **Image:** `plexinc/pms-docker:latest`
- **Hardware Transcoding:** Intel Quick Sync (via /dev/dri)
- **Security:** Protected by Authentik ForwardAuth (to be enabled)

## Media Libraries

All media is on NFS mounts (read-only in container):

- **Movies:** `/mnt/tank/shared/media/movies/`
- **TV Shows:** `/mnt/tank/shared/media/tv/`
- **Photos:** `/mnt/tank/shared/media/photos/`

## Data Paths

### Persistent Data (NFS)

- **Config:** `/home/jim/docs/data/systems/mj-infra-flux/mjplex/config`
  - Plex Media Server configuration and database
  - Contains: Preferences.xml, Plug-ins, Metadata, etc.

### Ephemeral Data (Local SSD - Fast)

- **Transcode:** `/mnt/local-k3s-data/mjplex-transcode`
  - Temporary transcoding files
  - Up to 100Gi
  - Fast local SSD for optimal transcoding performance

## Initial Setup

### Step 1: Get Plex Claim Code

Before deploying, get a claim code (expires in 4 minutes):

1. Visit: https://www.plex.tv/claim/
2. Copy the claim code
3. Update `mjplex-statefulset.yaml`:
   ```yaml
   - name: PLEX_CLAIM
     value: "claim-XXXXXXXXXXXXXXXXXX"
   ```

### Step 2: Deploy

```bash
# Deploy mjplex
kubectl apply -k apps/production/mjplex/

# Watch startup
kubectl logs -n mjplex -l app=mjplex -f
```

### Step 3: Initial Configuration

1. Access: https://plex.nerdsbythehour.com
2. Sign in with your Plex account
3. Add media libraries:
   - Movies: `/data/Movies`
   - TV Shows: `/data/TV-Shows`
   - Photos: `/data/Photos`
4. Configure transcoding settings
5. Enable hardware transcoding (Intel Quick Sync)

## Configuration

### Environment Variables

- `TZ`: `America/New_York`
- `PLEX_UID`: `3001` (plex user)
- `PLEX_GID`: `3001` (plex group)
- `PLEX_CLAIM`: Claim code from plex.tv/claim (only needed once)

### Resources

```yaml
Requests: 1000m CPU, 1Gi RAM
Limits: 4000m CPU, 4Gi RAM
```

### Ports

- `32400` - Web interface (HTTPS)
- `3005` - Plex Companion
- `8324` - Roku Companion
- `32469` - DLNA (TCP)
- `1900` - DLNA (UDP)
- `32410-32414` - GDM discovery (UDP)

## Hardware Transcoding

Plex uses Intel Quick Sync for hardware-accelerated transcoding:

- **Device:** `/dev/dri` (Intel GPU)
- **CPU:** Supports Quick Sync (Intel i5-13600K or similar)
- **Security:** Requires `privileged: true` for device access

To verify Quick Sync is working:
1. Play a video that requires transcoding
2. Check Dashboard → "Transcode Status"
3. Should show "(hw)" for hardware transcoding

## Common Operations

### View Logs

```bash
kubectl logs -n mjplex -l app=mjplex --tail=100 -f
```

### Restart Plex

```bash
kubectl rollout restart statefulset mjplex -n mjplex
kubectl get pods -n mjplex -w
```

### Access Plex Database

```bash
kubectl exec -n mjplex -it mjplex-0 -- sqlite3 /config/Library/Application\ Support/Plex\ Media\ Server/Plug-in\ Support/Databases/com.plexapp.plugins.library.db
```

### Clear Transcode Cache

```bash
sudo rm -rf /mnt/local-k3s-data/mjplex-transcode/*
```

### Backup Configuration

```bash
# Backup Plex config (important!)
tar -czf ~/backups/mjplex-config-$(date +%Y%m%d).tar.gz \
  /home/jim/docs/data/systems/mj-infra-flux/mjplex/config/
```

## Troubleshooting

### Plex Not Starting

Check logs:
```bash
kubectl logs -n mjplex mjplex-0
```

Common issues:
- Claim code expired (get new one)
- Config directory permissions
- Media mounts not accessible

### Hardware Transcoding Not Working

1. Verify /dev/dri exists:
   ```bash
   ls -la /dev/dri
   ```

2. Check if pod has access:
   ```bash
   kubectl exec -n mjplex -it mjplex-0 -- ls -la /dev/dri
   ```

3. Verify in Plex Settings → Transcoder → "Use hardware acceleration"

### Media Not Showing Up

1. Check media mounts:
   ```bash
   kubectl exec -n mjplex -it mjplex-0 -- ls -la /data/Movies
   kubectl exec -n mjplex -it mjplex-0 -- ls -la /data/TV-Shows
   kubectl exec -n mjplex -it mjplex-0 -- ls -la /data/Photos
   ```

2. Verify NFS mounts on host:
   ```bash
   ls -la /mnt/tank/shared/media/movies
   ```

3. Scan library in Plex UI

### Can't Access Web Interface

1. Check ingress:
   ```bash
   kubectl get ingress -n mjplex
   ```

2. Check certificate:
   ```bash
   kubectl get certificate -n mjplex
   ```

3. Test local access:
   ```bash
   kubectl port-forward -n mjplex svc/mjplex 32400:32400
   # Then access http://localhost:32400/web
   ```

## Authentik Integration

**Current Status:** Authentik ForwardAuth is commented out

**To Enable:**
1. Configure Authentik application for Plex
2. Uncomment annotation in `mjplex-ingress.yaml`
3. Apply: `kubectl apply -k apps/production/mjplex/`

**Note:** Plex has its own authentication. Consider if you need both.

## Performance Notes

### Transcoding Performance

- **Hardware transcoding:** Very fast with Intel Quick Sync
- **Software transcoding:** CPU-intensive, slower
- **Transcode location:** Local SSD for best performance

### Storage Performance

- **Config:** NFS (acceptable - not performance critical)
- **Transcode:** Local SSD (critical for performance)
- **Media:** NFS (acceptable - read-only, streaming)

## Migration from Previous Setup

**Previous config location:** `/home/jim/docs/data/systems/21-apps/k8s/apps/mjplex/`

**New config location:** `/home/jim/docs/data/systems/mj-infra-flux/mjplex/config`

**If you have existing Plex config to migrate:**
```bash
# Copy old config to new location
sudo cp -rp /mnt/vol1/appsdata/plex/config/* \
  /home/jim/docs/data/systems/mj-infra-flux/mjplex/config/
```

## Security Considerations

- Runs as `plex` user (UID 3001:3001)
- Media mounts are read-only
- Requires privileged mode for /dev/dri access
- Consider enabling Authentik for additional access control

## References

- [Plex Docker Image](https://github.com/plexinc/pms-docker)
- [Plex Documentation](https://support.plex.tv/)
- [Intel Quick Sync](https://github.com/plexinc/pms-docker#intel-quick-sync-hardware-transcoding-support)
- [Linux Permissions Guide](https://support.plex.tv/articles/200288596-linux-permissions-guide/)
