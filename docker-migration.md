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

Ask questions and prepare a plan for this migration.