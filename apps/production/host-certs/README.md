# host-certs

cert-manager Certificates for services running directly on cluster hosts
(not behind Traefik). The host pulls the Secret with a systemd timer.

## deby Cockpit (:9091)

- Secret: `host-certs/deby-cockpit-tls`
- On deby: `/usr/local/sbin/cockpit-cert-sync` (daily via `cockpit-cert-sync.timer`)
  writes `/etc/cockpit/ws-certs.d/50-deby.cert` (cert+chain) and `50-deby.key`
  (root:cockpit-ws 0640), restarts `cockpit.service` only if content changed.
