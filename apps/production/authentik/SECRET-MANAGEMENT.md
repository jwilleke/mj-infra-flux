# Authentik Secret Management

## Overview

Authentik requires sensitive credentials that **must not** be stored in git. This document explains how secrets are managed.

## Secrets Location

Secrets are stored in a Kubernetes Secret named `authentik-secrets` in the `authentik` namespace. This secret is:
- ✅ Created directly in the cluster
- ✅ NOT stored in git
- ✅ Referenced by the HelmRelease via `valuesFrom`

## Required Secrets

The following secrets are required:

1. **secret_key** - Authentik's secret key for encryption
2. **postgresql_password** - Password for the PostgreSQL database

## Creating the Secret

### Initial Setup

If the secret doesn't exist, create it manually:

```bash
kubectl create secret generic authentik-secrets \
  -n authentik \
  --from-literal=secret_key="$(openssl rand -base64 64 | tr -d '\n')" \
  --from-literal=postgresql_password="$(openssl rand -base64 32 | tr -d '\n')"
```

### Restoring from Backup

If you have backed up the secret, restore it:

```bash
kubectl apply -f authentik-secrets-backup.yaml
```

## Backing Up the Secret

**IMPORTANT:** Back up this secret securely before making cluster changes!

```bash
# Export the secret (store securely, NOT in git!)
kubectl get secret authentik-secrets -n authentik -o yaml > ~/secure-backup/authentik-secrets-backup.yaml

# Verify backup
cat ~/secure-backup/authentik-secrets-backup.yaml
```

## How It Works

The `helmrelease.yaml` uses Flux's `valuesFrom` feature to inject secrets:

```yaml
valuesFrom:
  - kind: Secret
    name: authentik-secrets
    valuesKey: secret_key
    targetPath: authentik.secret_key
  - kind: Secret
    name: authentik-secrets
    valuesKey: postgresql_password
    targetPath: authentik.postgresql.password
  - kind: Secret
    name: authentik-secrets
    valuesKey: postgresql_password
    targetPath: postgresql.auth.password
```

This approach:
- ✅ Keeps secrets out of git
- ✅ Works with Flux/HelmRelease
- ✅ Allows secret rotation without git commits
- ✅ Prevents accidental secret exposure

## Rotating Secrets

To rotate secrets:

1. Generate new secrets:
   ```bash
   NEW_SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')
   NEW_DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
   ```

2. Update the Kubernetes secret:
   ```bash
   kubectl create secret generic authentik-secrets \
     -n authentik \
     --from-literal=secret_key="$NEW_SECRET_KEY" \
     --from-literal=postgresql_password="$NEW_DB_PASSWORD" \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

3. Restart Authentik:
   ```bash
   kubectl rollout restart deployment -n authentik -l app.kubernetes.io/name=authentik
   ```

## Security Best Practices

1. **Never commit secrets to git**
2. **Back up secrets securely** (encrypted, separate from git)
3. **Rotate secrets periodically**
4. **Limit access** to the `authentik` namespace
5. **Use RBAC** to control who can read secrets
6. **Monitor secret access** via audit logs

## Troubleshooting

### HelmRelease fails with "secret not found"

The `authentik-secrets` secret doesn't exist. Create it using the commands above.

### Authentik fails to start after secret rotation

1. Check the secret exists:
   ```bash
   kubectl get secret authentik-secrets -n authentik
   ```

2. Verify secret contents (base64 encoded):
   ```bash
   kubectl get secret authentik-secrets -n authentik -o yaml
   ```

3. Check HelmRelease logs:
   ```bash
   kubectl logs -n authentik -l app.kubernetes.io/name=authentik
   ```

## Migration from Plaintext

**This has been completed.** Previously, secrets were stored in plaintext in `helmrelease.yaml`. They have been:

1. ✅ Moved to a Kubernetes Secret
2. ✅ Removed from git via `git filter-repo`
3. ✅ HelmRelease updated to use `valuesFrom`

## Related Documentation

- [Flux HelmRelease valuesFrom](https://fluxcd.io/flux/components/helm/helmreleases/#values-overrides)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [SOPS for Flux](https://fluxcd.io/flux/guides/mozilla-sops/) (future enhancement)
