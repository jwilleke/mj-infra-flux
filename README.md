# mj-infra-flux

[git](https://github.com/jwilleke/mj-infra-flux)

This is our Kubernetes [Flux](https://fluxcd.io/) repository. It WILL(?) everything installed in my kubernetes cluster and keeps the cluster up to date with this repo.

I stole this from [jimwilleke](https://github.com/jimwilleke/home-infra-k8s-flux)

> NOTE: IN PROGRESS. Still converting my old repo containing kubernetes resources – <https://github.com/jimwilleke/home-infra> – to this one. It's great that this can be gradual and isn't an all-in moment on Flux. So far so good though!

## Apps

- Monitoring: See [apps/base/monitoring/kube-state-metrics/README.md](apps/base/monitoring/kube-state-metrics/README.md) (there is more monitoring in <https://github.com/jimwilleke/home-infra> that isn't yet moved over)

- Transmission: Runs a transmission torrent seeder

## Usage

### Handy CLI Commands working with Flux

```sh
# force reconciliation to source:
flux reconcile kustomization flux-system --with-source

# Show all Flux objects that are not ready !
flux get all -A --status-selector ready=false

# watch flux events:
flux events -w

# Show flux warning events
kubectl get events -n flux-system --field-selector type=Warning

flux get kustomizations --watch

###############
#
# To fix something manually while flux won't constantly replace them do this:
flux suspend kustomization apps
# then make changes
# then resume:
flux resume kustomization apps
#
###############

flux reconcile kustomization apps

# I find it helpful to get logs directly from the kusotmization controller:
kubectl -n flux-system logs -f deployment/kustomize-controller


# Automated Image Updates:
# check the image repository (per https://fluxcd.io/flux/guides/image-update/)
flux get image repository -n tayle-prod repo-tayle-app

# list images flux is tracking:
flux get images all --all-namespaces

# list the image policies:
flux get images -A policy

# list all image repositories:
kubectl get -A imagerepository

# list the tags found in an image repository:
kubectl get -n tayle-prod -o=yaml imagerepository/repo-tayle-worker

# a handy way to do a drunrun on the kustomize (this prints a lot of warnings when it works but returns non-zero as long as there are no errors):
kubectl kustomize apps/production | kubectl apply --dry-run='server' -f -
```

### Cluster Layout

``` plain
├── apps
│   ├── base
│   ├── production
│   └── staging
├── infrastructure
│   ├── base
│   ├── production
│   └── staging
└── clusters
    ├── production
    └── staging
```

per <https://fluxcd.io/flux/guides/repository-structure/>
example at <https://github.com/fluxcd/flux2-kustomize-helm-example>

### Secrets

Using [sops](https://github.com/getsops/sops) + [age](https://github.com/FiloSottile/age).

#### Encrypting

TLDR: put .env files in a dirctory and then run `/scripts/encrypt-env-files.sh <dir>` on the dir containing the .env file and it will save `.env*.encrypted` files that you can reference in kustomization files like:

```yaml
secretGenerator:
  # db
  - name: db-creds
    envs:
      - .env.secret.db.encrypted
```

Per <https://fluxcd.io/flux/guides/mozilla-sops/#encrypting-secrets-using-age>

#### Decrypting

The flux+kustomize knows how to decrypt SOPS secrets via secret generator. So we just have to have a `sops-age` secret in the `flux-system` namespace in the cluster.

See `/infrastructure/configs/create-sops-age-decryption-secret.sh`

Per <https://fluxcd.io/flux/guides/mozilla-sops/#encrypting-secrets-using-age>

### Image Pull Secrets

Image Pull Secrets (to [Pull an Image from a Private Registry](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/)) using `.dockerconfigjson` secrets are kinda just like json secrets. Run:

```sh
./scripts/create-image-pull-secret-ghcr.sh
```

Per <https://fluxcd.io/flux/components/kustomize/kustomizations/#kustomize-secretgenerator>

### Image Updates & Image Scanning

Image scanning for one app setup at `apps/production/tayle/image-scanning` per <https://fluxcd.io/flux/guides/image-update/>

#### Image Updates from Github Web Hooks for Continuous Deployment

A flux webhook receive is set up in `/infrastructure/base/configs/image-scanning-webhook-receiver`. It has configured which ImageRepositories to refresh. More can be added.

Add a webhook to github like:

Get the ReceiverURL by running `kubectl -n flux-system get receiver` it will print it out as its status.

> On GitHub, navigate to your repository and click on the “Add webhook” button under “Settings/Webhooks”. Fill the form with:
> Payload URL: compose the address using the receiver LB and the generated URL `http://<LoadBalancerAddress>/<ReceiverURL>`
> Secret: use the token string
>
> With the above settings, when you push a commit to the repository, the following happens:
>
> GitHub sends the Git push event to the receiver address
> Notification controller validates the authenticity of the payload using HMAC
> Source controller is notified about the changes
> Source controller pulls the changes into the cluster and updates the GitRepository revision
> Kustomize controller is notified about the revision change
> Kustomize controller reconciles all the Kustomizations that reference the GitRepository object

per [webhook-receivers](https://fluxcd.io/flux/guides/webhook-receivers/)

### YAML+Kustomize

I prefer plain "kubectl yaml" and Kustomize over helm. Helm is great for packaging up an app into an opaque package and provide it to others, but IMHO not for managing a cluster directly. When consuming apps, I prefer consuming yaml if provided, but don't mind consuming Helm.

## TODO

- [x] Setup transmission with secrets
- [x] Setup image updates for tayle: <https://fluxcd.io/flux/guides/image-update/> & <https://fluxcd.io/flux/components/image/imageupdateautomations/>
- [ ] Expose webhook receiver for tayle main events: <https://fluxcd.io/flux/guides/webhook-receivers/>
- [ ] Setup transmission with image updates and

## Posterity / Done

- [x] Bootstrap
      See script for this in scripts dir. it was updated.

``` plain
flux bootstrap github \
--token-auth \
--owner=jimwilleke \
--repository=home-infra-k8s-flux \
--branch=main \
--path=clusters/nas1 \
--personal
```
