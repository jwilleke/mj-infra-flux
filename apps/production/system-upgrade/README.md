# system-upgrade

[rancher/system-upgrade-controller](https://github.com/rancher/system-upgrade-controller) v0.21.1, pinned and vendored unmodified, with one Plan (`k3s-server`) for __k3s patch upgrades only__ on deby ([deby#69](https://github.com/jwilleke/deby/issues/69)).

## How it behaves

- The Plan follows the `v1.36` channel, so it only ever moves to the latest `v1.36.x`. Minor upgrades stay manual: edit `channel` after reading the release notes.
- It is __gated by a node label__ and does nothing until you opt in:

  ```bash
  kubectl label node deby k3s-upgrade=enabled      # allow the next patch upgrade
  kubectl -n system-upgrade get plans,jobs          # watch it
  kubectl label node deby k3s-upgrade-             # back to manual
  ```

- Jobs are only created 22:30-23:59 ET, inside deby's maintenance slot.
- Single node: the node is cordoned during the upgrade, never drained.

## Before the first run

- `backup-deby` (21:01) must have succeeded that night: it captures the k3s SQLite state.
- After the upgrade: `kubectl get nodes` shows the new version; recopy `~/.kube/config` from `/etc/rancher/k3s/k3s.yaml` if `client-admin.crt` changed.
