# Flux, cluster infrastructure and image automation

*Moved from homelab `network/apps/flux-and-infrastructure.md` (last changed 2026-11-23) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Covers `clusters/deby`, `infrastructure/`, `apps/base`, `apps/lib` and
`apps/production/image-automation` in `jwilleke/mj-infra-flux`.

## What it is and does

Flux watches the `master` branch of `jwilleke/mj-infra-flux` and makes the k3s
cluster on deby match it. Image automation watches container registries and
commits new image tags back to git, so some apps update themselves.

## Access

| Item | Value |
| --- | --- |
| Repo | <https://github.com/jwilleke/mj-infra-flux>, branch `master`, local clone `/Volumes/hd2A/workspaces/github/mj-infra-flux` |
| CLI | `ssh deby`, `export KUBECONFIG=$HOME/.kube/config`, then `flux` / `kubectl` |
| Reach | No UI |

## Where it runs / where data lives

| Item | Value |
| --- | --- |
| Cluster | k3s v1.36.5 single node `deby` (`192.168.68.71`, Debian 12), SQLite datastore |
| Flux | v2.9.6, namespace `flux-system`, GitRepository `flux-system` |
| Kustomizations | `flux-system`, `infra-configs` (`./infrastructure/prod/configs`: Traefik HelmChartConfig), `external-secrets`, `openbao`, `openbao-secret-store`, `apps` (`./apps/production`, depends on `infra-configs`, SOPS decryption) |
| `apps/base` | Shared bases, e.g. upstream cert-manager manifest |
| `apps/lib/mariadb` | Unused example/library, not deployed |
| Image automation | ImagePolicies for yourphr, yourphr-relay, demo-yourphr, geohazardwatch, ngdpbase-demo, owntracks, maps (Dawarich 1.x), cloudflared; Flux pushes tag bumps to `master` |
| Cluster state backup | `backup-deby.sh` saves `k3s-state.db`, the server token and the age key into `/deby-backup/host/daily/<date>/dumps/` |

## Secrets

| Secret | Where |
| --- | --- |
| SOPS age key | Secret `flux-system/sops-age`, key `age.agekey`; see [docs/secrets.md](https://github.com/jwilleke/homelab/blob/master/docs/secrets.md) |
| Git write access for image automation | SOPS file `apps/production/image-automation/flux-system-git-auth.sops.yaml` |

## Dependencies

GitHub, the SOPS age key, deby.

## Recovery

(a) A Kustomization or HelmRelease is stuck:

```bash
flux get kustomizations
flux get helmreleases -A
flux reconcile source git flux-system
flux reconcile kustomization apps --with-source
flux logs --level=error --since=1h
```

(b) Bad commit broke the cluster: `git revert` it on the Mac, push, then
`flux reconcile kustomization apps --with-source`. (Pushing is your call.)

(c) deby rebuilt: follow [docs/restores/deby-backup.md](https://github.com/jwilleke/homelab/blob/master/docs/restores/deby-backup.md).
Short form: restore `/mnt/local-k3s-data`, install k3s, put back
`k3s-state.db` and the token or start clean, recreate `flux-system/sops-age`
from the backup, then:

```bash
flux bootstrap github --owner=jwilleke --repository=mj-infra-flux --branch=master --path=clusters/deby --personal
```

## Health checks

```bash
flux check
flux get kustomizations          # all READY True on the same master@sha1
kubectl get pods -A | grep -vE 'Running|Completed'
```

## Known gaps

- Image automation pushes straight to `master`; a bad image tag goes live with no review.
- Hand-made Secrets (listed in [openbao-external-secrets.md](../apps/production/openbao/README.md)) are not restored by `flux bootstrap`.
- Local-only images (`landingpage:latest`, `openspeedtest:latest`) must be rebuilt by hand after a rebuild.
