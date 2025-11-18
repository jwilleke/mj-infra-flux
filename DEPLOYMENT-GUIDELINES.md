# Deployment Guidelines

## Kustomize First

**ALWAYS prefer Kustomize over Helm when possible.**

### Why Kustomize?

1. **Transparency** - Plain Kubernetes YAML, no templating magic
2. **GitOps-friendly** - Easy to review changes in PRs
3. **Simplicity** - No additional tools needed (built into kubectl)
4. **Composability** - Overlay-based customization
5. **Debuggability** - What you see is what you deploy

### When to Use Helm

Use Helm **only** when:
- Complex third-party applications with extensive configuration
- Active upstream Helm chart with frequent updates
- Converting would require significant effort

**Current Helm deployments** (to be migrated when time permits):
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

**NEVER commit secrets in plaintext to git.**

### Approved Methods

1. **SOPS + Age (Preferred)**
   ```bash
   # Encrypt secrets with SOPS
   ./scripts/encrypt-env-files.sh <directory>
   ```

2. **Cluster-only Secrets**
   ```bash
   # Create secret directly in cluster (not in git)
   kubectl create secret generic my-secret -n my-namespace \
     --from-literal=key="value"
   ```

3. **Helm valuesFrom** (for Helm deployments)
   ```yaml
   valuesFrom:
     - kind: Secret
       name: my-secret
       valuesKey: key
       targetPath: path.to.value
   ```

### What NOT to Do

❌ Plaintext secrets in YAML files
❌ Secrets in git history
❌ Hardcoded passwords
❌ API keys in manifests

See `SECURITY-INCIDENT.md` for lessons learned from actual incident.

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

- **Namespaces**: Lowercase, hyphenated (e.g., `guest-services`)
- **Resources**: Descriptive, include app name (e.g., `jimswiki-deployment`)
- **Labels**: Use `app: <name>` for selectors
- **Secrets**: End with `-secret` (e.g., `authentik-secrets`)

## Documentation

Every application should have a `README.md` with:

1. **Overview** - What does it do?
2. **URL** - Where is it accessed?
3. **Dependencies** - What does it need?
4. **Configuration** - How is it configured?
5. **Secrets** - How are secrets managed?
6. **Troubleshooting** - Common issues

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
- [SOPS Guide](https://fluxcd.io/flux/guides/mozilla-sops/)
