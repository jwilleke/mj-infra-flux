# Deployment Guidelines

## Kustomize First

__ALWAYS prefer Kustomize over Helm when possible.__

### Why Kustomize?

1. __Transparency__ - Plain Kubernetes YAML, no templating magic
2. __GitOps-friendly__ - Easy to review changes in PRs
3. __Simplicity__ - No additional tools needed (built into kubectl)
4. __Composability__ - Overlay-based customization
5. __Debuggability__ - What you see is what you deploy

### When to Use Helm

Use Helm __only__ when:

- Complex third-party applications with extensive configuration
- Active upstream Helm chart with frequent updates
- Converting would require significant effort

__Current Helm deployments__ (to be migrated when time permits):

- Authentik (SSO/IdP)

### Examples of Kustomize Deployments

See `apps/production/` for reference implementations:

- ✅ `landingpage/` - React app
- ✅ `openspeedtest/` - Custom image
- ✅ `whoami/` - Simple service
- ✅ `jimswiki/` - Complex app with 38K+ files
- ✅ `teslamate/` - Multi-component app
- ✅ `database/` - Shared PostgreSQL
- ✅ `messaging/` - Shared Mosquitto MQTT
- ✅ `monitoring/` - Grafana + Prometheus

## Secret Management

__NEVER commit secrets to git, encrypted or plaintext.__

Secrets live in OpenBao. External Secrets Operator copies them into Kubernetes Secrets. The runbook is `infrastructure/prod/openbao/README.md`.

The only bootstrap secret is `openbao-unseal-key`, created by hand and never committed.

Helm charts that already use `valuesFrom` keep reading the Kubernetes Secret ESO creates. They do not get a second copy of the value in git.

### What NOT to Do

- Plaintext secrets in YAML files
- Encrypted secrets in git
- Hardcoded passwords
- API keys in manifests

See `SECURITY-INCIDENT.md` for lessons learned from an actual incident.

## File Structure

```
apps/
├── base/           # Base configurations (minimal)
└── production/     # Production deployments
    └── myapp/
        ├── namespace.yaml
        ├── deployment.yaml
        ├── service.yaml
        ├── ingress.yaml
        ├── certificate.yaml (if needed)
        ├── kustomization.yaml
        └── README.md (document your app!)
```

## Naming Conventions

- __Namespaces__: Lowercase, hyphenated (e.g., `guest-services`)
- __Resources__: Descriptive, include app name (e.g., `jimswiki-deployment`)
- __Labels__: Use `app: <name>` for selectors
- __Secrets__: End with `-secret` (e.g., `authentik-secrets`)

## Documentation

Every application should have a `README.md` with:

1. __Overview__ - What does it do?
2. __URL__ - Where is it accessed?
3. __Dependencies__ - What does it need?
4. __Configuration__ - How is it configured?
5. __Secrets__ - How are secrets managed?
6. __Troubleshooting__ - Common issues

## Testing Before Commit

```bash
# Validate Kustomize manifests
kubectl kustomize apps/production/myapp/

# Dry-run apply
kubectl apply -k apps/production/myapp/ --dry-run=client

# Actually apply
kubectl apply -k apps/production/myapp/
```

## Migration from Docker

See `docker-migration.md` for the complete migration process from Docker Compose to Kubernetes.

Key principles:

- ✅ Preserve data paths
- ✅ Use hostPath for persistent data
- ✅ Document volume mounts
- ✅ Test thoroughly before removing Docker containers

## Resources

- [Kustomize Documentation](https://kustomize.io/)
- [Flux Kustomization](https://fluxcd.io/flux/components/kustomize/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [OpenBao runbook](infrastructure/prod/openbao/README.md)
