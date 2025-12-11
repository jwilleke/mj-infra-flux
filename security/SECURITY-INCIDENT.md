# Security Incident: Exposed Secrets in Git History

## Summary

GitGuardian detected exposed secrets in commit `65bf391a1ef2a7d2b9bc077676aa7a75a913df16` (2024-11-17).

**Status:** ✅ REMEDIATED (secrets removed from current codebase, rotation recommended)

## Exposed Secrets

The following secrets were committed in plaintext in `apps/production/authentik/helmrelease.yaml`:

1. **Authentik Secret Key** (line 19)
2. **PostgreSQL Password** (lines 23, 41)

## Remediation Actions Taken

### ✅ Step 1: Remove Secrets from Current Code (Completed)

Commit `de98c43` removed plaintext secrets:
- Updated HelmRelease to use `valuesFrom` with Secret reference
- Secrets now stored only in Kubernetes cluster
- Added SECRET-MANAGEMENT.md documentation

### ⏳ Step 2: Rotate Compromised Secrets (RECOMMENDED)

Since these secrets were exposed in git history, they should be rotated:

```bash
# Generate new secrets
NEW_SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')
NEW_DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')

# Update the Kubernetes secret
kubectl create secret generic authentik-secrets \
  -n authentik \
  --from-literal=secret_key="$NEW_SECRET_KEY" \
  --from-literal=postgresql_password="$NEW_DB_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart Authentik to pick up new secrets
kubectl rollout restart deployment -n authentik -l app.kubernetes.io/name=authentik
```

### ⏳ Step 3: Clean Git History (OPTIONAL)

**Warning:** This rewrites git history and requires force push!

To completely remove secrets from git history:

```bash
# Install git-filter-repo
pip3 install git-filter-repo

# Backup the repo first
cd /home/jim/Documents
cp -r mj-infra-flux mj-infra-flux.backup

# Remove the file from history
cd mj-infra-flux
git filter-repo --invert-paths --path apps/production/authentik/helmrelease.yaml \
  --refs refs/heads/master~7..refs/heads/master

# Or use BFG Repo-Cleaner (alternative)
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
# java -jar bfg.jar --delete-files helmrelease.yaml --no-blob-protection
# git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Force push (WARNING: This affects everyone with the repo)
git push --force origin master
```

**Note:** Only do this if:
- You're the sole maintainer
- Or you've coordinated with all team members
- You understand the implications of rewriting history

## Prevention Measures

### ✅ Added Documentation

- `apps/production/authentik/SECRET-MANAGEMENT.md` - Secret management best practices
- This file - Incident documentation

### ⏳ Future Improvements

1. **Use SOPS for secret encryption** (already configured in repo)
2. **Add pre-commit hooks** to detect secrets before commit
3. **Use Kustomize instead of Helm** for all future deployments
4. **Enable GitGuardian pre-receive hooks** (if possible)

## Lessons Learned

1. ✅ Never commit secrets in plaintext
2. ✅ Use Kubernetes Secrets with `valuesFrom` for Helm
3. ✅ Prefer Kustomize over Helm when possible
4. ✅ Use SOPS/age for encrypting secrets in git
5. ✅ Rotate secrets immediately after exposure

## Timeline

- **2024-11-17**: Secrets committed in `65bf391`
- **2024-11-18 03:XX**: GitGuardian alert received
- **2024-11-18 03:XX**: Secrets removed from current code (`de98c43`)
- **2024-11-18 03:XX**: This incident report created

## References

- [GitGuardian Alert](https://dashboard.gitguardian.com/) (check your notifications)
- [Authentik Secret Management](apps/production/authentik/SECRET-MANAGEMENT.md)
- [Flux SOPS Guide](https://fluxcd.io/flux/guides/mozilla-sops/)
- [Git Filter-Repo](https://github.com/newren/git-filter-repo/)

## Approval

- [ ] Secrets rotated in production
- [ ] Git history cleaned (optional)
- [ ] Team notified (if applicable)
- [ ] GitGuardian incident closed
