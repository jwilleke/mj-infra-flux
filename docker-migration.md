# Docker Migration

I want all the docker apps under
/opt/traefik

Except for:

- authelia  (can be deleted) will use Authentik
- traefik-docker (will be deleted)
- dashy can be deleted we will use Authentik

Migrated to be in k3s managed by https://github.com/jwilleke/mj-infra-flux (We are in cloned repo)
 
 
The Landing page should be the "home" page for everyone.

The Members page (MembersPage.tsx) will be replaced with Authentik. (https://auth.nerdsbythehour.com/if/user/#/library)

The Guests Page (GuestPage.tsx) should contain

- openspeedtest (Not behind Authentik)
- whoami (Not behind Authentik)

I would like if all k3s would be owned by apps:apps (uid 3003) (gid 3003)

---

## Migration Progress

### ✅ Phase 1 Complete: Stateless Applications

**C. Landing Page** ✅ COMPLETE
- Status: Deployed to k3s
- Namespace: `landingpage`
- URL: https://nerdsbythehour.com
- Routes:
  - `/` - Public landing page
  - `/guest` - Guest page with links to openspeedtest and whoami
  - `/members` - Protected by Authentik (ForwardAuth to be configured)
- Changes:
  - Updated MembersPage.tsx to use Authentik instead of Authelia
  - Added whoami link to GuestPage.tsx
  - Built and imported Docker image to k3s
  - Security: Runs as apps:apps (3003:3003)
- Commit: 2ac59b8

**B. whoami** ✅ COMPLETE
- Status: Migrated from default namespace to GitOps
- Namespace: `guest-services`
- URL: https://deby.nerdsbythehour.com
- Changes:
  - Imported into GitOps from manual deployment
  - Moved from default to guest-services namespace
  - Added proper resource limits
  - Security: Runs as apps:apps (3003:3003)
- Commit: 237dea6

**A. openspeedtest** ✅ COMPLETE
- Status: Deployed to k3s
- Namespace: `guest-services`
- URL: https://nerdsbythehour.com/speed
- Changes:
  - Built custom image from /opt/traefik/openspeedtest
  - Imported to k3s containerd
  - Configured ingress with path /speed
  - Security: Runs as root (nginx requirement)
- Commit: d069dd4

### ✅ Phase 2 Complete: Shared Infrastructure & TeslaMate

**PostgreSQL** (Shared Instance) ✅ COMPLETE
- Status: Deployed to k3s
- Namespace: `database`
- Service: `postgresql.database.svc.cluster.local:5432`
- Storage: `/mnt/local-k3s-data/postgresql` (local disk for permissions)
- Databases: teslamate (+ future apps)
- Commit: 6d1dd39

**Mosquitto MQTT** (Shared Broker) ✅ COMPLETE
- Status: Deployed to k3s
- Namespace: `messaging`
- Service: `mosquitto.messaging.svc.cluster.local:1883`
- Storage: NFS at `/home/jim/docs/data/systems/mj-infra-flux/mosquitto/`
- Topics: teslamate/* (+ future apps)
- Commit: 6d1dd39

**Grafana** (Shared Dashboards) ✅ COMPLETE
- Status: Deployed to k3s
- Namespace: `monitoring`
- URL: https://grafana.jimwilleke.com
- Storage: `/mnt/local-k3s-data/grafana`
- Ready for TeslaMate datasource
- Commit: 3db228c

**TeslaMate** ✅ COMPLETE
- Status: Deployed to k3s
- Namespace: `teslamate`
- URL: https://teslamate.nerdsbythehour.com
- Connected to: Shared PostgreSQL + Shared MQTT
- Data migration: Ready (instructions in README)
- Commit: 3db228c

### ✅ Phase 3 Complete: jimswiki

**jimswiki** ✅ COMPLETE
- Status: Deployed to k3s
- Namespace: `jimswiki`
- URL: https://nerdsbythehour.com/jimswiki/
- Data: Host mount at /home/jim/docs/data/systems/wikis/jimswiki (38,004 pages, 3.4GB)
- Image: `aug12018/jimswiki:latest` (imported to k3s)
- Context: Webapp deployed at `/jimswiki` (not ROOT)
- Startup: ~30 seconds with 38K pages
- Implementation:
  - InitContainer copies webapp from ROOT to jimswiki context
  - Shared emptyDir volume for webapps
  - HostPath mounts preserve all data locations
  - Running as root (matches Docker behavior)
- Commit: 1c1ab7e

### 🗑️ To Be Removed from Docker

After all migrations complete:
- Stop: `cd /opt/traefik && docker-compose down`
- Remove: authelia, dashy, traefik containers
- Archive: /opt/traefik directory for reference

### 📝 Current Status

**Migration Status**: Phase 3 COMPLETE ✅ - ALL MIGRATIONS DONE!
- ✅ Phase 1: Stateless apps (landingpage, openspeedtest, whoami)
- ✅ Phase 2: Shared infrastructure (PostgreSQL, Mosquitto, Grafana) + TeslaMate
- ✅ Phase 3: jimswiki (38,004 pages migrated)

**Docker Services**: All stopped
- Running on same host with same IP (192.168.68.71)
- k3s Traefik ingress handling all traffic
- No DNS changes needed - seamless cutover

**Verification**:
```bash
docker ps -a  # Shows all containers exited
sudo kubectl get ingress -A  # Shows k3s ingresses active
sudo kubectl get pods -A  # Shows all k3s services running
```

### 📝 Next Steps

1. **TeslaMate Data Migration** ✅ COMPLETE:
   - Exported 409MB database from Docker PostgreSQL
   - Imported to k3s PostgreSQL: 1,002 drives, 51,816 charges, 2,976,634 positions
   - TeslaMate running with historical data

2. **Grafana Configuration** ✅ COMPLETE:
   - TeslaMate PostgreSQL datasource configured in Grafana
   - All 19 TeslaMate dashboards imported and working
   - Historical data visible in dashboards
   - Setup guide: `apps/production/monitoring/GRAFANA-TESLAMATE-SETUP.md`

3. **jimswiki Migration** ✅ COMPLETE:
   - Deployed to k3s with all 38,004 pages
   - Running at https://nerdsbythehour.com/jimswiki/
   - All data paths preserved
   - Details: `apps/production/jimswiki/README.md`

4. **Authentik ForwardAuth** (Optional):
   - Configure Authentik middleware for protected routes
   - Enable on: /members, teslamate, grafana, jimswiki

5. **Final Cleanup** (Ready to execute):
   - Test all services thoroughly
   - Remove Docker containers: `docker rm $(docker ps -aq)`
   - Remove unused Docker images
   - Archive /opt/traefik for reference