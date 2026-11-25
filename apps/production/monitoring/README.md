# Monitoring Stack - Prometheus & Grafana

Comprehensive monitoring solution for the k3s cluster with metrics collection, storage, visualization, and alerting.

## Overview

- __Namespace__: `monitoring`
- __Prometheus URL__: <https://prometheus.nerdsbythehour.com> (with basic auth)
- __Grafana URL__: <https://grafana.nerdsbythehour.com>
- __Components__:
  - Prometheus - Metrics collection and storage
  - Grafana - Visualization and dashboards
  - Alertmanager - Alert routing and notifications
  - Blackbox Exporter - External endpoint monitoring

## Architecture

```
┌─────────────────────────────────────────────┐
│         Monitoring Stack (monitoring ns)    │
│                                             │
│  ┌──────────────┐      ┌──────────────┐   │
│  │  Prometheus  │─────▶│   Grafana    │   │
│  │   (scraper)  │      │ (dashboards) │   │
│  └──────┬───────┘      └──────────────┘   │
│         │                                   │
│         │  Scrapes metrics from:           │
│         ├─▶ Kubernetes API (pods, nodes)   │
│         ├─▶ Applications (annotations)     │
│         ├─▶ Exporters (postgres, mqtt)     │
│         └─▶ Blackbox Exporter (endpoints)  │
│                                             │
│  ┌──────────────┐      ┌──────────────┐   │
│  │ Alertmanager │      │   Blackbox   │   │
│  │  (alerts)    │      │  Exporter    │   │
│  └──────────────┘      └──────────────┘   │
└─────────────────────────────────────────────┘
```

## Deployed Components

### Prometheus

- __Version__: 3.0.1
- __Service__: `prometheus-service.monitoring.svc.cluster.local:80`
- __Storage__: PVC `prometheus-storage-volume-prometheus-0` (60Gi, local-path provisioner); mounted at `/prometheus` in the pod
- __Retention__: 30 days or 100GB (whichever comes first)
- __Resources__: 1 CPU / 2Gi RAM
- __Security__: Runs as UID/GID 4030:4030
- __Features__:
  - Service discovery (Kubernetes pods/services)
  - Custom scrape configs
  - Recording rules
  - Alert rules

### Grafana

- __Version__: 10.1.6
- __Service__: `grafana-service.monitoring.svc.cluster.local:80`
- __Storage__: `/mnt/local-k3s-data/grafana`
- __Resources__: 250m-1 CPU / 750Mi-2Gi RAM
- __Security__: Runs as UID/GID 4020:4020
- __Features__:
  - Prometheus datasource (pre-configured)
  - Dashboard provisioning
  - User authentication
  - Alert visualization

### Alertmanager

- __Version__: Latest
- __Service__: `alertmanager.monitoring.svc.cluster.local:9093`
- __Purpose__: Routes and manages alerts from Prometheus
- __Features__:
  - Grouping, deduplication
  - Silencing
  - Notification routing (email, Slack, webhook)

### Blackbox Exporter

- __Version__: 0.25.0
- __Service__: `blackbox-exporter.monitoring.svc.cluster.local:9115`
- __DNS__: Uses local DNS (192.168.68.1) for external domain resolution
- __Purpose__: Probes external HTTP/HTTPS endpoints
- __Monitored Services__:
  - <https://nerdsbythehour.com> (landing page)
  - <https://auth.nerdsbythehour.com> (Authentik SSO)
  - <https://teslamate.nerdsbythehour.com>
  - <https://grafana.nerdsbythehour.com>
  - <https://ha.nerdsbythehour.com> (Home Assistant)
  - <https://cdn.nerdsbythehour.com>
- __Excluded__: traefik (internal), jimsmcp (internal), amd (known broken)

## Checking Service Health Probes

### Web UI

- __<https://prometheus.nerdsbythehour.com/alerts>__ - View all alert rules and current state (firing/pending/inactive)
- __<https://prometheus.nerdsbythehour.com/targets>__ - View all scrape targets including blackbox probes
- __<https://prometheus.nerdsbythehour.com/graph>__ - Query metrics directly with PromQL

__Alertmanager UI__ (cluster internal):

```bash
kubectl port-forward -n monitoring svc/alertmanager 9093:9093
# Then browse to http://localhost:9093
```

### View Probe Status

```bash
# Check all HTTP probe results (1=up, 0=down)
kubectl exec -n monitoring prometheus-0 -- wget -qO- \
  "http://localhost:9090/api/v1/query?query=probe_success" 2>/dev/null | \
  jq -r '.data.result[] | "\(.metric.instance): \(.value[1])"'

# Check HTTP response codes
kubectl exec -n monitoring prometheus-0 -- wget -qO- \
  "http://localhost:9090/api/v1/query?query=probe_http_status_code" 2>/dev/null | \
  jq -r '.data.result[] | "\(.metric.instance): \(.value[1])"'

# Check SSL certificate expiry (days remaining)
kubectl exec -n monitoring prometheus-0 -- wget -qO- \
  "http://localhost:9090/api/v1/query?query=(probe_ssl_earliest_cert_expiry-time())/86400" 2>/dev/null | \
  jq -r '.data.result[] | "\(.metric.instance): \(.value[1] | tonumber | floor) days"'
```

### View Active Alerts

```bash
# Check firing alerts
kubectl exec -n monitoring prometheus-0 -- wget -qO- \
  "http://localhost:9090/api/v1/alerts" 2>/dev/null | \
  jq -r '.data.alerts[] | select(.state=="firing") | "\(.labels.alertname): \(.labels.instance // .labels.pod // "cluster")"'

# Check all alerts (pending and firing)
kubectl exec -n monitoring prometheus-0 -- wget -qO- \
  "http://localhost:9090/api/v1/alerts" 2>/dev/null | \
  jq -r '.data.alerts[] | "\(.labels.alertname): \(.state)"'

# Check alertmanager received alerts
kubectl exec -n monitoring deploy/alertmanager -- wget -qO- \
  "http://localhost:9093/api/v2/alerts" 2>/dev/null | \
  jq -r '.[] | "\(.labels.alertname): \(.status.state)"'
```

### View Loaded Alert Rules

```bash
# List all alert rule groups
kubectl exec -n monitoring prometheus-0 -- wget -qO- \
  "http://localhost:9090/api/v1/rules" 2>/dev/null | \
  jq -r '.data.groups[].name'

# View specific rule group
kubectl exec -n monitoring prometheus-0 -- wget -qO- \
  "http://localhost:9090/api/v1/rules" 2>/dev/null | \
  jq '.data.groups[] | select(.name=="service_health")'
```

### Test Blackbox Probe Manually

```bash
# Test a specific URL through blackbox exporter
kubectl exec -n monitoring deploy/blackbox-exporter -- wget -qO- \
  "http://localhost:9115/probe?target=https://grafana.nerdsbythehour.com&module=http_2xx_3xx" | \
  grep -E "probe_success|probe_http_status_code"
```

## Quick Start

### Access Grafana

1. Navigate to: <https://grafana.nerdsbythehour.com>
2. Login with admin credentials (check Grafana data directory or reset password)
3. Prometheus datasource is already configured and set as default

### View Prometheus Metrics

1. Navigate to: <https://prometheus.nerdsbythehour.com>
2. Enter credentials from web.yaml basic auth
3. Explore metrics, run PromQL queries

### Import Dashboards to Grafana

Pre-built community dashboards:

```bash
# Kubernetes Cluster Monitoring
Dashboard ID: 315

# Node Exporter Full
Dashboard ID: 1860

# Prometheus 2.0 Stats
Dashboard ID: 3662

# Container Metrics
Dashboard ID: 893
```

__To import:__

1. Grafana → Dashboards → Import
2. Enter dashboard ID
3. Select "Prometheus" as data source
4. Click Import

## Configuration

### Prometheus Scrape Configs

Located in: `apps/production/monitoring/prometheus/config/`

__Current scrape configs:__

- `scrape-configs.prometheus.yaml` - Prometheus self-monitoring
- `scrape-configs.coinpoet.yaml` - Custom application scraping
- Kubernetes service discovery (built-in)

### Kubernetes Auto-Discovery

Prometheus automatically discovers and scrapes pods with these annotations:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"      # Default: 80
    prometheus.io/path: "/metrics"  # Default: /metrics
```

__Example:__

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    metadata:
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
    spec:
      containers:
        - name: myapp
          image: myapp:latest
          ports:
            - containerPort: 8080
```

### Grafana Datasource

Pre-configured via provisioning at:

- `apps/production/monitoring/grafana/config/provisioning/datasources/prometheus.yaml`

```yaml
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus-service.monitoring.svc.cluster.local:80
    isDefault: true
```

## Adding Metrics to Applications

### Option 1: Application Metrics (Recommended)

Instrument your application to expose Prometheus metrics:

__Go (with prometheus/client_golang):__

```go
import "github.com/prometheus/client_golang/prometheus/promhttp"

http.Handle("/metrics", promhttp.Handler())
```

__Python (with prometheus-client):__

```python
from prometheus_client import start_http_server, Counter

requests_total = Counter('app_requests_total', 'Total requests')

start_http_server(8080)  # Exposes /metrics on port 8080
```

__Node.js (with prom-client):__

```javascript
const client = require('prom-client');
const register = new client.Registry();

app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

Then add the annotation to your deployment as shown above.

### Option 2: Exporters (For Third-Party Services)

Install exporters for services that don't natively expose metrics:

__PostgreSQL Exporter:__

```bash
# Deploy postgres_exporter as a sidecar or separate deployment
# Configure to connect to postgresql.database.svc.cluster.local
```

__MQTT Exporter:__

```bash
# Deploy mosquitto_exporter
# Configure to connect to mosquitto.messaging.svc.cluster.local
```

__Node Exporter (System Metrics):__

```bash
# Deploy node-exporter as DaemonSet
# Scrapes CPU, memory, disk, network from nodes
```

## Common Queries

### Container Metrics

```promql
# CPU usage per container
rate(container_cpu_usage_seconds_total{container!=""}[5m])

# Memory usage per container
container_memory_working_set_bytes{container!=""}

# Network traffic
rate(container_network_receive_bytes_total[5m])
```

### Kubernetes Metrics

```promql
# Pods running per namespace
count(kube_pod_info) by (namespace)

# Node CPU usage
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Node memory usage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
```

### Application Health

```promql
# Check which targets are up
up

# HTTP request rate
rate(http_requests_total[5m])

# Request latency (95th percentile)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

## Alerting

### Alert Rules

Located in: `apps/production/monitoring/prometheus/config/`

__Active alert rule files:__

- `alerting-rules.prometheus.yaml` - Prometheus TSDB health (WAL, compaction, restarts, memory)
- `alerting-rules.service-health.yaml` - Service failure alerts (added 2026-01-22)

__Service Health Alerts (alerting-rules.service-health.yaml):__

| Alert | Severity | Trigger |
|-------|----------|---------|
| ServiceDown | critical | HTTP probe fails for 2min |
| ServiceSlowResponse | warning | Response time >5s for 5min |
| SSLCertExpiringSoon | warning | SSL cert expires in <14 days |
| SSLCertExpiryCritical | critical | SSL cert expires in <3 days |
| PodCrashLoopBackOff | critical | >3 restarts in 1 hour |
| PodNotReady | warning | Pod not ready for 5min |
| DeploymentNoReplicas | critical | 0 available replicas for 5min |
| StatefulSetNoReplicas | critical | 0 ready replicas for 5min |
| NodeHighMemoryUsage | warning | Memory >90% for 5min |
| NodeHighCPUUsage | warning | CPU >85% for 10min |
| NodeDiskSpaceLow | warning | Disk <15% free for 5min |
| NodeDiskSpaceCritical | critical | Disk <5% free for 2min |
| PostgreSQLDown | critical | PostgreSQL pod down for 2min |

__Prometheus TSDB Alerts (alerting-rules.prometheus.yaml):__

| Alert | Severity | Trigger |
|-------|----------|---------|
| PrometheusWALFilesLarge | warning | Storage <10GB available |
| PrometheusCompactionSlowing | warning | Compaction >1hr |
| PrometheusFrequentRestarts | critical | Multiple restarts in 24hr |
| PrometheusHighMemory | warning | Memory >85% of 8GB limit |

### Alertmanager Configuration

Configure notification routing in:

- `apps/production/monitoring/prometheus-alertmanager/config/alertmanager.yaml`

__Current configuration:__

- __Receiver__: email to `mjsservers@willeke.com` through Resend SMTP (`smtp.resend.com:587`, password file `/config/secrets/resend_api_key` from the `alertmanager-secrets` ExternalSecret)
- __Group wait__: 30s
- __Group interval__: 5m
- __Repeat interval__: 4h
- __Weekly maintenance window__: planned-update noise (including some criticals) and remaining `severity="warning"` notifications are muted Sat 22:00 to Sun 02:00 America/New_York (see below). Backups, disk/pool health, IDS spikes, and a few other always-on alerts are never muted.

### Maintenance window

One weekly window for all planned updates and reboots: __Saturday 22:00 to Sunday 02:00 America/New_York__. The device schedule (UniFi, Home Assistant, deby, clara, the GCP watcher) lives in [jwilleke/homelab `docs/maintenance/maintenance-window.md`](https://github.com/jwilleke/homelab/blob/master/docs/maintenance/maintenance-window.md); epic [deby#69](https://github.com/jwilleke/deby/issues/69).

__What the config does__ (`prometheus-alertmanager/config/alertmanager.yaml`):

- `time_intervals: weekly-maintenance-window` is two ranges, Sat 22:00-24:00 and Sun 00:00-02:00, both with `location: America/New_York`, so DST is handled by Alertmanager.
- Three child routes, first match wins:
  - Never muted, even during the window: `BackupDebyFailed`, `BackupDebyStale`, `NasBackupRsyncStale`, `NasBackupRsyncMissedOrFailed`, `NodeDiskSpaceCritical`, `NodeDiskSpaceLow`, `ZfsPoolCapacityCritical`, `ZfsPoolCapacityHigh`, `ZfsPoolDegraded`, `ZfsPoolUnhealthy`, `SmartDeviceUnhealthy`, `NvmeCriticalWarning`, `NvmeMediaErrors`, `NvmeWearHigh`, `DiskTemperatureHigh`, `SmartSectorProblems`, `OpenBaoSealed`, `AlertmanagerNotificationDeliveryFailing`, `UDMProThreatRateSpike`, `SSLCertExpiryCritical`, `TankNonRoutineEvent`, `ProtectNonRoutineEvent`.
  - Muted during the window, any severity (planned reboot/update noise): `UDMProWANDown`, `ServiceDown`, `HomeAssistantScrapeDown`, `HomeAssistantAlarmPanelUnavailable`, `HomeAssistantNotificationDeliveryFailing`, `HostLogsAbsent`, `NodeNotReady`, `PostgreSQLDown`, `PodCrashLoopBackOff`, `DeploymentNoReplicas`, `StatefulSetNoReplicas`, `ClaraDown`, `OpenBaoScrapeDown`, `NetAlertXScrapeDown`.
  - Remaining `severity="warning"` alerts are muted during the window (the original [mj-infra-flux#294](https://github.com/jwilleke/mj-infra-flux/pull/294) mute).
- During the window those muted alerts still fire and are visible in the Alertmanager UI and Grafana, but no email goes out. An alert still firing when the window closes is emailed at the next group interval after 02:00, so a problem that lasts past the window is not lost.
- Loki ruler alerts (`loki/rules/rules.yaml`) go through this same Alertmanager, so the mute covers them too. Grafana has no Grafana-managed alert rules (checked 2026-11-18), so no Grafana mute timing is needed.
- Gatus on the GCP VM emails on its own, not through Alertmanager. `external/gatus/config.yaml` has a matching `maintenance` block (Saturday 22:00, duration 4h, `America/New_York`). That file is not Flux-reconciled; copy it to the VM for the mute to take effect.

__Ad-hoc "quiet for xx minutes"__ still uses a scoped silence (for work outside this window, or a shorter/longer mute than Saturday night). Alertmanager runs with a `/alerting/list` route prefix, so pass it in the URL:

```bash
# on deby
AM='kubectl --kubeconfig /home/jim/.kube/config -n monitoring exec deploy/alertmanager -- amtool --alertmanager.url=http://localhost:9093/alerting/list'

# example: clara reboot, silence everything about clara for 45 minutes
$AM silence add 'alertname=~"Clara.*|Node.*"' 'instance=~"clara.*"' --duration=45m --author=jim --comment='clara patch reboot (deby#69)'
# or by alert name only
$AM silence add alertname=ClaraDown --duration=45m --author=jim --comment='clara patch reboot (deby#69)'

$AM silence query            # list active silences and their IDs
$AM silence expire <ID>      # end it as soon as the post-checks pass
```

Silences are stored on the `alertmanager-data` PVC, so they survive an Alertmanager restart. A deby reboot takes Alertmanager itself down, so nothing is sent while deby is down; `for:` timers restart when Prometheus and Loki come back.

__Check the config before merging a change:__

```bash
# on deby, from a checkout of this repo (the running pod has amtool v0.34.1)
kubectl --kubeconfig /home/jim/.kube/config -n monitoring exec -i deploy/alertmanager -- \
  amtool check-config /dev/stdin < apps/production/monitoring/prometheus-alertmanager/config/alertmanager.yaml
kubectl --kubeconfig /home/jim/.kube/config -n monitoring exec -i deploy/alertmanager -- \
  sh -c 'cat > /tmp/am.yaml && amtool config routes test --config.file=/tmp/am.yaml --verify.receivers=on_call_operator_default severity=warning alertname=Test; rm -f /tmp/am.yaml' \
  < apps/production/monitoring/prometheus-alertmanager/config/alertmanager.yaml
```

__Supported receivers:__

- Email (SMTP)
- Slack webhooks
- PagerDuty
- Webhook (generic)
- Telegram

## Monitoring Best Practices

### 1. Use Labels Wisely

```promql
# Good - specific labels
http_requests_total{service="teslamate", method="GET", status="200"}

# Bad - too many cardinality
http_requests_total{user_id="12345"}  # Avoid high-cardinality labels
```

### 2. Set Resource Limits

Always define resource requests/limits for scraped pods to get accurate metrics.

### 3. Use Recording Rules

Pre-calculate expensive queries:

```yaml
groups:
  - name: recording_rules
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: rate(http_requests_total[5m])
```

### 4. Monitor the Monitor

- Check Prometheus targets: <https://prometheus.nerdsbythehour.com/targets>
- Check Grafana datasource health
- Monitor Prometheus disk usage

## Maintenance

### Backup Prometheus Data

```bash
# Prometheus data is stored on local disk (not backed up)
# For critical metrics, configure remote write to long-term storage

# Backup current data
kubectl exec -n monitoring prometheus-0 -- \
  tar -czf - /prometheus > prometheus-backup-$(date +%Y%m%d).tar.gz
```

### Backup Grafana Dashboards

```bash
# Grafana data (dashboards, users)
sudo kubectl exec -n monitoring grafana-0 -- \
  tar -czf /tmp/grafana-backup.tar.gz /var/lib/grafana

sudo kubectl cp monitoring/grafana-0:/tmp/grafana-backup.tar.gz \
  grafana-backup-$(date +%Y%m%d).tar.gz
```

### Update Prometheus

```bash
# Update image version in prometheus-statefulset.yaml
# Then apply
sudo kubectl apply -k apps/production/monitoring/prometheus/

# Or let Flux handle it
git add apps/production/monitoring/prometheus/
git commit -m "Update Prometheus to vX.Y.Z"
git push
```

### Update Grafana

```bash
# Update image version in grafana-statefulset.yaml
# Delete and recreate StatefulSet (preserves data on hostPath)
sudo kubectl delete statefulset grafana -n monitoring
sudo kubectl apply -k apps/production/monitoring/grafana/
```

### Check Prometheus Config

```bash
# View loaded configuration
sudo kubectl exec -n monitoring prometheus-0 -- \
  cat /etc/prometheus/prometheus.yaml

# Reload config without restart
curl -X POST https://prometheus.nerdsbythehour.com/-/reload
```

## Troubleshooting

### Prometheus Not Scraping Targets

1. Check target status: <https://prometheus.nerdsbythehour.com/targets>
2. Verify pod annotations:

   ```bash
   sudo kubectl get pod <pod-name> -o yaml | grep prometheus
   ```

3. Check Prometheus logs:

   ```bash
   sudo kubectl logs -n monitoring prometheus-0 | grep -i error
   ```

### Grafana Can't Connect to Prometheus

1. Verify datasource config:

   ```bash
   sudo kubectl exec -n monitoring grafana-0 -- \
     cat /etc/grafana/provisioning/datasources/prometheus.yaml
   ```

2. Test connectivity from Grafana:

   ```bash
   sudo kubectl exec -n monitoring grafana-0 -- \
     wget -qO- http://prometheus-service.monitoring.svc.cluster.local:80/-/healthy
   ```

3. Check Grafana logs:

   ```bash
   sudo kubectl logs -n monitoring grafana-0 | grep -i prometheus
   ```

### High Memory Usage

Prometheus memory usage grows with:

- Number of time series
- Scrape frequency
- Retention period

__Solutions:__

- Reduce retention time (default: 30d)
- Reduce scrape frequency
- Use recording rules
- Drop unnecessary metrics:

  ```yaml
  metric_relabel_configs:
    - source_labels: [__name__]
      regex: 'expensive_metric_.*'
      action: drop
  ```

### Disk Space Issues

```bash
# Check Prometheus storage usage
kubectl exec -n monitoring prometheus-0 -- du -sh /prometheus

# Prometheus auto-manages retention, but can manually clean old data
sudo kubectl exec -n monitoring prometheus-0 -- \
  promtool tsdb list /prometheus
```

## Monitoring Your Apps

### TeslaMate

TeslaMate has built-in Prometheus metrics at `:4000/metrics`:

- Vehicle state updates
- API call rates
- Database connection pool

__Enable scraping:__

```yaml
# In apps/production/teslamate/teslamate-deployment.yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "4000"
```

### PostgreSQL

Deploy postgres_exporter to monitor:

- Connection count
- Query performance
- Lock statistics
- Replication lag

### Authentik

Authentik exposes metrics at `:9300/metrics`:

- Login attempts
- Active sessions
- Token generation
- Provider requests

### Getting a new app onto the "Environment Health" NOC dashboard

`grafana/config/dashboards/env-health-noc.json` (`https://grafana.nerdsbythehour.com/d/env-health-noc/`) has two rows that auto-populate — adding a new app to either takes __zero dashboard edits__:

- __"External Services" row__ (public, browser-facing apps): add the app's URL to `prometheus/config/scrape-configs.blackbox.yaml`'s target list. The row is a single panel that repeats over `label_values(probe_success, instance)` — one tile per probed URL appears automatically, titled with the full URL.
- __"Cluster" row__ (internal apps with no public URL, health = "is the Deployment's replica available"): add the label `noc-monitor: "true"` to the Deployment's `metadata.labels`. The row repeats over `label_values(kube_deployment_labels{label_noc_monitor="true"}, deployment)`. Requires `kube-state-metrics` to have this label allowlisted (already configured in `apps/base/monitoring/kube-state-metrics/kustomization.yaml` — `--metric-labels-allowlist=deployments=[noc-monitor]`; if you ever add a *different* label for this purpose, extend that allowlist too, or it silently won't show up as a Prometheus label).

Neither convention covers apps that are internal-only *and* have no Kubernetes Deployment of their own (e.g. `netalertx-proxy`, which is just an Ingress + ExternalName Service pointing at a Docker container running directly on `deby`, outside k3s) — those still need ad-hoc handling; `netalertx-proxy` specifically is instead covered by adding `netalertx.nerdsbythehour.com` to the blackbox list, since blackbox-exporter runs in-cluster and can reach it via Traefik regardless of public exposure.

## Resources

- Prometheus docs: <https://prometheus.io/docs/>
- Grafana docs: <https://grafana.com/docs/grafana/latest/>
- PromQL guide: <https://prometheus.io/docs/prometheus/latest/querying/basics/>
- Grafana dashboards: <https://grafana.com/grafana/dashboards/>
- Kubernetes monitoring: <https://github.com/prometheus-operator/kube-prometheus>

## TODO / Future Improvements

### High Priority

- [ ] Add Grafana dashboard for service health probes
- [ ] Configure alert silencing for maintenance windows
- [ ] Add PostgreSQL exporter for detailed database metrics

### Medium Priority

- [ ] Add Node Exporter dashboard to Grafana
- [ ] Configure alert escalation (critical → page, warning → email)
- [ ] Add MQTT broker health monitoring
- [ ] Monitor Authentik login success/failure rates

### Low Priority

- [ ] Add custom recording rules for common queries
- [ ] Set up remote write for long-term metric storage
- [ ] Add application-specific metrics (TeslaMate)
- [ ] Configure Grafana alerting as backup to Alertmanager

### Known Issues

- `amd.nerdsbythehour.com` excluded from probes (service broken)
- `traefik.nerdsbythehour.com` excluded (internal dashboard, not publicly exposed)
- `jimsmcp.nerdsbythehour.com` excluded (internal service)

## Recent Changes

### 2026-01-22: Service Failure Monitoring

- Added HTTP probe modules (http_2xx, http_2xx_3xx) to blackbox-exporter
- Configured blackbox-exporter with local DNS (192.168.68.1)
- Created `scrape-configs.blackbox.yaml` for external service probes
- Created `alerting-rules.service-health.yaml` with comprehensive alerts
- Alerts now route to Telegram via Alertmanager

## Related Files

- Prometheus config: `apps/production/monitoring/prometheus/`
- Grafana config: `apps/production/monitoring/grafana/`
- Alertmanager config: `apps/production/monitoring/prometheus-alertmanager/`
- Blackbox config: `apps/production/monitoring/prometheus-blackbox-exporter/`

## Operations summary

*Moved from homelab `network/apps/monitoring.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

The monitoring stack collects metrics and logs from deby, the cluster, Home
Assistant, NetAlertX and other LAN hosts, shows them in Grafana dashboards, and
emails alerts. Blackbox probes check that the public sites answer.

### Access

| Item | Value |
| --- | --- |
| Grafana | <https://grafana.nerdsbythehour.com> (Authentik OIDC, generic OAuth) |
| Prometheus | <https://prometheus.nerdsbythehour.com> (Authentik forward-auth) |
| Loki | NodePort `192.168.68.71:31100` (no auth) |
| Alertmanager | In cluster only |
| Reach | LAN only |

### Where it runs / where data lives

| Item | Value |
| --- | --- |
| Host | deby, namespace `monitoring` |
| Prometheus | v3.15.0 StatefulSet, local-path PVC 60Gi, 15 days kept |
| Grafana | 13.2.4 StatefulSet, hostPath `/mnt/local-k3s-data/grafana` |
| Loki | 3.7.8, local-path PVC 20Gi, 30 days kept |
| Alertmanager | v0.34.1, local-path PVC 1Gi, mails `mjsservers@willeke.com` via Resend |
| Others | blackbox-exporter, otel-collector, node-exporter (DaemonSet), kube-state-metrics v2.20.0 |
| Extra targets | Home Assistant, NetAlertX, `clara` `192.168.68.24:9100`; blackbox probes `demo.yourphr.org`, `demo-relay.yourphr.org`, `ngdpbase-demo.nerdsbythehour.com`, `geohazardwatch.com` |
| Backup | Grafana folder in the deby-backup rsync. Prometheus/Loki PVCs sit under `/var/lib/rancher/k3s/storage` and are copied live by the rootfs rsync |

### Secrets

| Secret | Where |
| --- | --- |
| Grafana OIDC client secret | OpenBao `apps/monitoring/grafana-oauth` → Secret `grafana-oauth`, key `client-secret` |
| Grafana read of TeslaMate DB | OpenBao `apps/teslamate/teslamate`, property `database-password` → Secret `grafana-teslamate-db` |
| Alertmanager mail (Resend) | OpenBao `apps/monitoring/alertmanager-secrets` → Secret `alertmanager-secrets` |
| NetAlertX API token | Secret `monitoring/netalertx-api-token`, key `token` (made by hand) |
| Home Assistant token | Secret `monitoring/homeassistant-api-token`, key `token` (made by hand) |

### Dependencies

Authentik, Traefik, cert-manager, OpenBao, [shared PostgreSQL](../database/README.md)
for TeslaMate dashboards, Resend for email.

### Recovery

(a) Pod broken:

```bash
kubectl -n monitoring get pods
kubectl -n monitoring rollout restart statefulset/prometheus statefulset/grafana
kubectl -n monitoring rollout restart deploy/loki deploy/alertmanager
```

(b) Data lost: metrics and logs are history only; they restart empty. For
Grafana, copy back
`/deby-backup/host/daily/latest/rootfs/mnt/local-k3s-data/grafana/` with the
pod scaled to 0. Dashboards defined in git come back on their own.

(c) deby rebuilt: restore `/mnt/local-k3s-data`, recreate the two hand-made
token Secrets, then `flux reconcile kustomization apps --with-source`.

### Health checks

```bash
kubectl -n monitoring get pods
curl -sI https://grafana.nerdsbythehour.com/login | head -1
kubectl -n monitoring port-forward svc/prometheus 9090 &   # then open /targets
```

### Known gaps

- `netalertx-api-token` and `homeassistant-api-token` are not in git or OpenBao.
- `grafana-ingress` has no `ingressClassName`.
- Loki NodePort has no auth on the LAN.
- Prometheus, Loki and Alertmanager PVCs use reclaim policy `Delete`.

## For users: Grafana — grafana.nerdsbythehour.com

*Moved from homelab `docs/services-provided/grafana.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Dashboards for host metrics, Kubernetes cluster state, and TeslaMate vehicle analytics.

### How to reach it

__URL:__ <https://grafana.nerdsbythehour.com>

LAN only. Public DNS (checked 2026-11-23 with `dig @1.1.1.1`) points this name at deby, `192.168.68.71`, so it is not reachable from the internet. (The older homelab page said it was public via Cloudflare.)

### Authentication

Login is via __Authentik OAuth2__. Click "Sign in with Authentik" on the Grafana login page. Your Authentik session carries over — no separate Grafana password needed for normal use.

Admin credentials (if OAuth is unavailable): stored in the `grafana-oauth` secret; see `docs/secrets-inventory.md`.

### What's available

| Dashboard area | What it shows |
|---|---|
| Host / node | CPU, memory, disk I/O, ZFS pool health on `deby` |
| Kubernetes | Pod count, resource usage, Flux reconciliation state |
| TeslaMate | Trip history, charging sessions, battery degradation, range |
| Loki logs | Ingested logs from cluster pods and host systemd units |

### Data sources wired up

- __Prometheus__ — `http://prometheus.monitoring.svc.cluster.local:9090`
- __Loki__ — log aggregation from Promtail / OpenTelemetry collector
- __PostgreSQL (TeslaMate)__ — direct read-only connection to the `teslamate` database

### Operator reference

[`mj-infra-flux/apps/production/monitoring/grafana/`](grafana/)

## For users: Prometheus — prometheus.nerdsbythehour.com

*Moved from homelab `docs/services-provided/prometheus.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Time-series metrics store for host, cluster, and application monitoring. This is the data source behind Grafana.

### How to reach it

__URL:__ <https://prometheus.nerdsbythehour.com>

__LAN-only__ — not exposed to the internet. Accessible from `192.168.68.0/24` or via VPN. The Ingress now has Authentik forward-auth (`monitoring-authentik-forwardauth`, checked 2026-11-23); Prometheus itself has no login, so do not forward its port externally.

### What it scrapes

- __Node exporter__ — CPU, memory, disk, network on `deby`
- __kube-state-metrics__ — Kubernetes object state (pod health, deployment readiness)
- __cAdvisor__ — container resource usage
- __Blackbox exporter__ — external HTTP/TCP probes (uptime checks for public services)
- __OpenTelemetry collector__ — OTLP metrics forwarded from applications

### Alertmanager

Alerts fire through __Alertmanager__ (`prometheus-alertmanager` in the `monitoring` namespace). All notifications route through Alertmanager — direct-app SMTP is interim-only. See [`mj-infra-flux#86`](https://github.com/jwilleke/mj-infra-flux/issues/86) for the target architecture.

### Preferred interface

Use __Grafana__ (`grafana.nerdsbythehour.com`) for day-to-day dashboards. Access the Prometheus UI directly only for ad-hoc PromQL queries or alert-rule inspection.

### Operator reference

[`mj-infra-flux/apps/production/monitoring/prometheus/`](prometheus/)
