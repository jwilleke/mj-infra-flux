# esphome-builder

ESPHome Device Builder on deby, moved from plain Docker (`/home/jim/dockers/esphome-builder`). Tracking issue: mj-infra-flux#280.

- `hostNetwork: true`: mDNS discovery and OTA reach the LAN. The HA ESPHome add-on (192.168.68.20) remote-builds against `192.168.68.71:6055`.
- 6052: the dashboard and the built-in MCP (`POST /api/mcp`, 2026.10+). It is password-gated with `ESPHOME_USERNAME`/`ESPHOME_PASSWORD` from `esphome-builder-auth.sops.yaml`. The plaintext is in `mjs-network/private/creds/esphome-builder.txt`.
- `esphome.nerdsbythehour.com`: LAN-only ingress behind Authentik (private DNS, like netalertx). MCP clients use `http://192.168.68.71:6052/api/mcp` directly.
- Data: hostPath `/mnt/local-k3s-data/esphome-builder/{config,cache}`. `config/` holds the peer-link key and the HA pairing, so it must be copied, not recreated.
- Image: `ghcr.io/esphome/esphome`, bumped by Flux image automation (`image-automation/esphome-builder-policy.yaml`).

## Cutover (one time)

The Deployment lands with `replicas: 0` so it cannot fight the compose container for 6055.

```sh
cd /home/jim/dockers/esphome-builder && docker compose down
sudo mkdir -p /mnt/local-k3s-data/esphome-builder
sudo rsync -a /home/jim/dockers/esphome-builder/config/ /mnt/local-k3s-data/esphome-builder/config/
sudo rsync -a /home/jim/dockers/esphome-builder/cache/  /mnt/local-k3s-data/esphome-builder/cache/   # optional, ~4.8 GB
# then a PR setting replicas: 1 (or scale by hand; Flux will revert to git on the next reconcile)
sudo ss -ltnp | grep -E ':605[25]'
```

## Rollback

```sh
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
sudo -n -E flux suspend kustomization apps
sudo -n -E kubectl -n esphome-builder scale deploy esphome-builder --replicas=0
cd /home/jim/dockers/esphome-builder && docker compose up -d
```

The original `config/` is left as it was, so the compose container comes back already paired.
