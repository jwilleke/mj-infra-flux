# mj-infra-flux — TODO

GitOps repo for the **deby** k3s cluster (Flux v2.7.3 / source-controller v1.7.3). Operator-owned infrastructure tasks. Authoritative live state is the GitHub issue tracker; this file is a curated snapshot.

## Recently completed

- **2026-05-16 — Decoupled Loki storage from the `/mnt/tank` NFS automount failure domain** (#73, closed):
  - `loki-deployment.yaml` `data` volume moved off `hostPath: /mnt/tank/jims/data/systems/loki` onto a node-local `local-path` PVC (new `loki-pvc.yaml` → `loki-data`, RWO 20Gi); committed `78d5fbe` (current `master` HEAD).
  - Verified live: PVC Bound on `local-path` (PV under `/var/lib/rancher/k3s/storage/...`), pod recreated `1/1 Running`, ruler rule groups reloaded and evaluating. Loki no longer shares the storage failure domain its ruler is supposed to alert on. Companion alert-path hardening is #74 (still open, below).

- **2026-05-15 — Migrated Flux image-automation git auth from the `fluxcdbot` PAT to a GitHub App** (tracked as ngdpbase #726).
  - `Secret/flux-system-git-auth` (ns `flux-system`) rebuilt with `githubAppID` / `githubAppInstallationID` / `githubAppPrivateKey`, SOPS-age encrypted (commit `e6c430e`).
  - `GitRepository/flux-system` given `spec.provider: github` — committed (`1e31ab2`) and the live resource patched to break the auth-can't-pull-its-own-fix deadlock.
  - Verified: `GitRepository` + `Kustomization` `READY=True`, image-automation `geohazardwatch` `READY=True`. Pull path proven. Push path uses the same secret and will surface the GitHub App identity (in place of `fluxcdbot`) on the next geohazardwatch image bump — final visual confirmation.

- **2026-05-15 — PAT decommission** (companion to ngdpbase #725):
  - [x] Removed `.github/workflows/pat-health-check.yml` (commit `3d66dd8c`).
  - [x] `FLUXCDBOT_PAT_HEALTHCHECK` secret — confirmed it never existed (no Actions secrets on the repo); nothing to delete. This was the subject of #71.
  - [x] Closed #71 and #72 as obsolete.
  - [ ] **Operator-only, still pending:** revoke the old `fluxcdbot` PAT in GitHub account settings (<https://github.com/settings/tokens>). Cannot be done via CLI/API — manual. Until done, the (now-unused) token remains valid.

## Open

### Bugs

- **#69** [BUG] `image.toolkit.fluxcd.io/v1beta2` ImageRepository deprecated — upgrade the geohazardwatch manifest to v1.
- **#32** Investigate `sist2-admin-1` exit 128 root cause.

### Enhancements

- **#75** [FEATURE] Mattermost implementation — stand up Mattermost in the cluster.
- **#74** P1 — move storage/backup alerts onto Prometheus/node-exporter (independent of Loki) and broaden the `ZfsPoolDegraded` matcher (currently misses `suspended` / `uncorrectable I/O failure`). Companion to the now-closed #73.
- **#46** Install sealed-secrets (or SOPS) so cluster Secrets can live in the repo — note: SOPS-age is already in use for `flux-system-git-auth`; re-scope or close.
- **#45** Rotate `ghcr-jimsmcp` imagePullSecret to a read-only PAT (defense in depth).
- **#44** Delete throwaway `ghcr.io/jwilleke/test` package (auth-validation leftover).
- **#42** Add a CI workflow that builds, type-checks, and tags the jimsmcp image on push to master.

## Notes

- Secrets are SOPS-age encrypted; the decryption key lives in-cluster.
- Flux image-automation commits are authored by the GitHub App as of 2026-05-15 (previously `fluxcdbot`).
