# Monitoring Stack - Prometheus & Grafana

Comprehensive monitoring solution for the k3s cluster with metrics collection, storage, visualization, and alerting.

## Overview

- **Namespace**: `monitoring`
- **Prometheus URL**: https://prometheus.jimwilleke.com (with basic auth)
- **Grafana URL**: https://grafana.nerdsbythehour.com
- **Components**:
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
- **Version**: 3.0.1
- **Service**: `prometheus-service.monitoring.svc.cluster.local:80`
- **Storage**: `/mnt/thedatapool/no-backup/app-data/prometheus/storage`
- **Retention**: 30 days or 100GB (whichever comes first)
- **Resources**: 1 CPU / 2Gi RAM
- **Security**: Runs as UID/GID 4030:4030
- **Features**:
  - Service discovery (Kubernetes pods/services)
  - Custom scrape configs
  - Recording rules
  - Alert rules

### Grafana
- **Version**: 10.1.6
- **Service**: `grafana-service.monitoring.svc.cluster.local:80`
- **Storage**: `/mnt/local-k3s-data/grafana`
- **Resources**: 250m-1 CPU / 750Mi-2Gi RAM
- **Security**: Runs as UID/GID 4020:4020
- **Features**:
  - Prometheus datasource (pre-configured)
  - Dashboard provisioning
  - User authentication
  - Alert visualization

### Alertmanager
- **Version**: Latest
- **Service**: `alertmanager.monitoring.svc.cluster.local:9093`
- **Purpose**: Routes and manages alerts from Prometheus
- **Features**:
  - Grouping, deduplication
  - Silencing
  - Notification routing (email, Slack, webhook)

### Blackbox Exporter
- **Version**: Latest
- **Service**: `blackbox-exporter.monitoring.svc.cluster.local:9115`
- **Purpose**: Probes external HTTP/HTTPS/TCP/ICMP endpoints
- **Use cases**:
  - Website uptime monitoring
  - SSL certificate expiration
  - Response time tracking

## Quick Start

### Access Grafana

1. Navigate to: https://grafana.nerdsbythehour.com
2. Login with admin credentials (check Grafana data directory or reset password)
3. Prometheus datasource is already configured and set as default

### View Prometheus Metrics

1. Navigate to: https://prometheus.jimwilleke.com
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

**To import:**
1. Grafana → Dashboards → Import
2. Enter dashboard ID
3. Select "Prometheus" as data source
4. Click Import

## Configuration

### Prometheus Scrape Configs

Located in: `apps/production/monitoring/prometheus/config/`

**Current scrape configs:**
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

**Example:**
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

**Go (with prometheus/client_golang):**
```go
import "github.com/prometheus/client_golang/prometheus/promhttp"

http.Handle("/metrics", promhttp.Handler())
```

**Python (with prometheus-client):**
```python
from prometheus_client import start_http_server, Counter

requests_total = Counter('app_requests_total', 'Total requests')

start_http_server(8080)  # Exposes /metrics on port 8080
```

**Node.js (with prom-client):**
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

**PostgreSQL Exporter:**
```bash
# Deploy postgres_exporter as a sidecar or separate deployment
# Configure to connect to postgresql.database.svc.cluster.local
```

**MQTT Exporter:**
```bash
# Deploy mosquitto_exporter
# Configure to connect to mosquitto.messaging.svc.cluster.local
```

**Node Exporter (System Metrics):**
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

- `alerting-rules.coinpoet.yaml`
- `alerting-rules.tayle.yaml`

**Example alert rule:**
```yaml
groups:
  - name: example
    rules:
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "{{ $labels.pod }} is using {{ $value }}% of memory"
```

### Alertmanager Configuration

Configure notification routing in:
- `apps/production/monitoring/prometheus-alertmanager/config/alertmanager.yaml`

**Supported receivers:**
- Email (SMTP)
- Slack webhooks
- PagerDuty
- Webhook (generic)
- Discord, Telegram, etc.

## Monitoring Best Practices

### 1. Use Labels Wisely

```promql
# Good - specific labels
http_requests_total{service="jimswiki", method="GET", status="200"}

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

- Check Prometheus targets: https://prometheus.jimwilleke.com/targets
- Check Grafana datasource health
- Monitor Prometheus disk usage

## Maintenance

### Backup Prometheus Data

```bash
# Prometheus data is stored on local disk (not backed up)
# For critical metrics, configure remote write to long-term storage

# Backup current data
sudo tar -czf prometheus-backup-$(date +%Y%m%d).tar.gz \
  /mnt/thedatapool/no-backup/app-data/prometheus/storage
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
curl -X POST https://prometheus.jimwilleke.com/-/reload
```

## Troubleshooting

### Prometheus Not Scraping Targets

1. Check target status: https://prometheus.jimwilleke.com/targets
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

**Solutions:**
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
sudo du -sh /mnt/thedatapool/no-backup/app-data/prometheus/storage

# Prometheus auto-manages retention, but can manually clean old data
sudo kubectl exec -n monitoring prometheus-0 -- \
  promtool tsdb list /prometheus
```

## Monitoring Your Apps

### jimswiki (JSPWiki on Tomcat)

JMX metrics can be exposed via jmx_exporter:
- JVM heap usage
- Thread count
- Garbage collection
- Tomcat request rates

### TeslaMate

TeslaMate has built-in Prometheus metrics at `:4000/metrics`:
- Vehicle state updates
- API call rates
- Database connection pool

**Enable scraping:**
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

## Resources

- Prometheus docs: https://prometheus.io/docs/
- Grafana docs: https://grafana.com/docs/grafana/latest/
- PromQL guide: https://prometheus.io/docs/prometheus/latest/querying/basics/
- Grafana dashboards: https://grafana.com/grafana/dashboards/
- Kubernetes monitoring: https://github.com/prometheus-operator/kube-prometheus

## Related Files

- Prometheus config: `apps/production/monitoring/prometheus/`
- Grafana config: `apps/production/monitoring/grafana/`
- Alertmanager config: `apps/production/monitoring/prometheus-alertmanager/`
- Blackbox config: `apps/production/monitoring/prometheus-blackbox-exporter/`
