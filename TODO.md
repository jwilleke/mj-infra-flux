# mj-infra-flux — TODO

GitOps repo for the **deby** k3s cluster (Flux v2.7.3 / source-controller v1.7.3). Operator-owned infrastructure tasks. Authoritative live state is the GitHub issue tracker; this file is a curated snapshot.

## Recently completed

- **2026-05-15 — Migrated Flux image-automation git auth from the `fluxcdbot` PAT to a GitHub App** (tracked as ngdpbase #726).
  - `Secret/flux-system-git-auth` (ns `flux-system`) rebuilt with `githubAppID` / `githubAppInstallationID` / `githubAppPrivateKey`, SOPS-age encrypted (commit `e6c430e`).
  - `GitRepository/flux-system` given `spec.provider: github` — committed (`1e31ab2`) and the live resource patched to break the auth-can't-pull-its-own-fix deadlock.
  - Verified: `GitRepository` + `Kustomization` `READY=True`, image-automation `geohazardwatch` `READY=True`. Pull path proven. Push path uses the same secret and will surface the GitHub App identity (in place of `fluxcdbot`) on the next geohazardwatch image bump — final visual confirmation.

## Open

### Obsoleted by the GitHub App migration — ready to close

- **#71** [BUG] `FLUXCDBOT_PAT_HEALTHCHECK` secret is not set — the PAT canary is moot; auth no longer uses the PAT.
- **#72** [BUG] PAT health check: all jobs have failed — same root cause; the `pat-health-check.yml` workflow should be removed.

Decommission checklist (companion to ngdpbase #725):

- [ ] Revoke the old `fluxcdbot` PAT in GitHub settings.
- [ ] Delete `.github/workflows/pat-health-check.yml`.
- [ ] Delete the `FLUXCDBOT_PAT_HEALTHCHECK` repository secret.
- [ ] Close #71 and #72.

### Bugs

- **#69** [BUG] `image.toolkit.fluxcd.io/v1beta2` ImageRepository deprecated — upgrade the geohazardwatch manifest to v1.
- **#32** Investigate `sist2-admin-1` exit 128 root cause.

### Enhancements

- **#46** Install sealed-secrets (or SOPS) so cluster Secrets can live in the repo — note: SOPS-age is already in use for `flux-system-git-auth`; re-scope or close.
- **#45** Rotate `ghcr-jimsmcp` imagePullSecret to a read-only PAT (defense in depth).
- **#44** Delete throwaway `ghcr.io/jwilleke/test` package (auth-validation leftover).
- **#42** Add a CI workflow that builds, type-checks, and tags the jimsmcp image on push to master.

## Notes

- Secrets are SOPS-age encrypted; the decryption key lives in-cluster.
- Flux image-automation commits are authored by the GitHub App as of 2026-05-15 (previously `fluxcdbot`).
