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

### ⏳ Phase 2 Pending: Stateful Applications

**PostgreSQL** (Shared Instance)
- Status: Not started
- Purpose: Shared database for teslamate and future apps
- Location: /home/jim/docs/data/systems/mj-infra-flux/postgresql

**teslamate**
- Status: Not started
- Components: app, postgresql, grafana, mosquitto
- Data: Docker volumes to be migrated to PVCs

**jimswiki**
- Status: Not started
- Data: Host mount at /home/jim/docs/data/systems/wikis/jimswiki
- Complexity: Custom image, Tomcat, requires careful migration

### 🗑️ To Be Removed from Docker

After all migrations complete:
- Stop: `cd /opt/traefik && docker-compose down`
- Remove: authelia, dashy, traefik containers
- Archive: /opt/traefik directory for reference

### 📝 Current Status

**Docker Services**: All stopped (as of 10 hours ago)
- Running on same host with same IP (192.168.68.71)
- k3s Traefik ingress handling all traffic
- No DNS changes needed - seamless cutover

**Verification**:
```bash
docker ps -a  # Shows all containers exited
sudo kubectl get ingress -A  # Shows k3s ingresses active
```

### 📝 Next Steps

1. **Immediate**:
   - Configure Authentik ForwardAuth middleware for /members route
   - Test all migrated services (landingpage, whoami, openspeedtest)

2. **Phase 2 - Stateful Apps**:
   - Set up shared PostgreSQL instance in k3s
   - Migrate teslamate with data preservation
   - Migrate jimswiki with host mount

3. **Cleanup** (after Phase 2 complete):
   - Remove Docker containers: `docker rm $(docker ps -aq)`
   - Remove Docker images for migrated apps
   - Keep /opt/traefik for source code and reference
   - Archive docker-compose.yml