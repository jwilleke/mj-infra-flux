# Hoarder App Kubernetes Install

Basically I'm just copying all the files from https://github.com/hoarder-app/hoarder/tree/v0.23.0/kubernetes into this `/base` subdirectory and

## 1. Copy the kustomization.yaml file into the root rather than the base dir

## 2. Adjust `secretGenerator` and `configMapGenerator` to point to the encrypted versions of .env files here instead of unencrypted version:

From:

```yaml
secretGenerator:
- envs:
  - .secrets
  name: hoarder-secrets

configMapGenerator:
  - envs:
    - .env
    name: hoarder-configuration
```

To:

```yaml
secretGenerator:
- envs:
  - .env.secret.hoarder-secrets.encrypted
  name: hoarder-secrets

configMapGenerator:
  - envs:
    - .env.secret.hoarder-config.encrypted
    name: hoarder-configuration
```

## 3. Update the version tag in hoarder-env

tags: https://github.com/hoarder-app/hoarder/pkgs/container/hoarder
release notes: https://github.com/hoarder-app/hoarder/releases

## 4. Add a PV for the data-pvc and millisearch-pvc

I add these files in this dir to define the PVs and then use a patch in kustomize to patch the PVC's in hoarder to make sure they'll bind to the correct PV.
