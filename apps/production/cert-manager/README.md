# cert-manager (TLS certificates)

*Moved from homelab `network/apps/cert-manager.md` (last changed 2026-11-23) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

## What it is and does

cert-manager gets and renews the HTTPS certificates for `*.nerdsbythehour.com`
hosts served by Traefik. It uses Let's Encrypt and proves ownership with a DNS
record in Cloudflare (DNS-01), so it works even though the hosts are LAN only.

## Access

No UI. Use `kubectl` on deby. Let's Encrypt account email: `jim@willeke.com`.

## Where it runs / where data lives

| Item | Value |
| --- | --- |
| Host | deby, namespace `cert-manager` |
| Deploy | Upstream v1.21.2 manifest in `apps/base/cert-manager`, applied by Flux Kustomization `apps` |
| Issuers | ClusterIssuers `letsencrypt-production` and `letsencrypt-staging` |
| Data | Only Kubernetes objects (Certificates, Secrets). Nothing on disk to back up. |

## Secrets

| Secret | Where |
| --- | --- |
| Cloudflare API token | OpenBao `apps/cert-manager/cloudflare-api-token` → ExternalSecret → Secret `cert-manager/cloudflare-api-token`, key `api-token` |

See [docs/secrets.md](https://github.com/jwilleke/homelab/blob/master/docs/secrets.md).

## Dependencies

- External Secrets and OpenBao (for the Cloudflare token)
- Cloudflare DNS for `nerdsbythehour.com`

## Recovery

Run on deby with `export KUBECONFIG=$HOME/.kube/config`.

(a) Pod broken:

```bash
kubectl -n cert-manager get pods
kubectl -n cert-manager rollout restart deploy/cert-manager deploy/cert-manager-webhook deploy/cert-manager-cainjector
```

(b) Data lost: certificates are re-issued automatically. To force one:

```bash
kubectl get certificate -A
kubectl -n <ns> delete secret <tls-secret>      # cert-manager re-issues it
```

(c) deby rebuilt: Flux re-applies it. Check that OpenBao is unsealed and the
`cloudflare-api-token` ExternalSecret is `SecretSynced` before expecting certs.

## Health checks

```bash
kubectl get clusterissuer
kubectl get certificate -A | grep -v True      # anything listed is not ready
```

## Known gaps

- Rebuild order matters: no certificates until OpenBao is unsealed (the token comes from OpenBao).
- Some app folders hold a `certificate.yaml` that is not listed in their kustomization (geohazardwatch, home-assistant-proxy). Their TLS comes from somewhere else; see those pages.
