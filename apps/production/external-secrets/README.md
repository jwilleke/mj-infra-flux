# External Secrets Operator

Syncs values from OpenBao into ordinary Kubernetes Secrets. Nothing in this
directory reads or writes a secret value. No `ExternalSecret` is installed.

- __Namespace__: `external-secrets`
- __Chart__: `external-secrets` 2.14.0 from `https://charts.external-secrets.io`
- __ServiceAccount__: `external-secrets` (the OpenBao kubernetes auth role of the same name)

The `ClusterSecretStore` named `openbao` is applied from
`apps/production/openbao-secret-store/` by the Flux Kustomization
`openbao-secret-store` (`wait: false`). It is not in this kustomization, and
`apps` does not depend on either one.

Runbook, auth bootstrap, and how to turn this off:
[apps/production/openbao/README.md](../openbao/README.md).
