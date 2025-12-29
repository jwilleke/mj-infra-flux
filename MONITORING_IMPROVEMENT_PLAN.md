# Infrastructure Monitoring Improvement Plan

**Created**: 2025-12-22
**Issue Tracking**: GitHub jwilleke/mj-infra-flux
**Status**: In Development

---

## Executive Summary

Your infrastructure currently lacks comprehensive health checking and proactive alerting for critical services. The recent cascading failures (TeslaMate data loss, jimswiki 404, Home Assistant offline, Prometheus startup issues) indicate the need for:

1. **Blackbox Monitoring** - External HTTP/HTTPS health checks for all public services
2. **Service Dependency Tracking** - Alerts when dependencies fail (DB, MQTT, caches)
3. **Log Aggregation** - Centralized visibility into pod/service failures
4. **Alerting Escalation** - Automated incident response for critical services
5. **Health Dashboard** - Real-time service status visibility

---

## Current Monitoring State

### What's Working ✅
- Prometheus metrics collection (Kubernetes pods, nodes, system metrics)
- Grafana visualization dashboards
- Alertmanager with Telegram notifications
- Node exporter for system-level metrics
- kube-state-metrics for Kubernetes object tracking
- Blackbox exporter (deployed but underutilized)

### Critical Gaps ❌
1. **No application health checks** - Services can fail silently
2. **No dependency monitoring** - PostgreSQL/MQTT failures not detected
3. **No external endpoint monitoring** - Public services not checked from outside
4. **Limited alerting rules** - Only project-specific rules (coinpoet, tayle)
5. **No service mesh observability** - Pod-to-pod communication failures invisible
6. **No log centralization** - Must SSH to pods to debug issues
7. **No uptime tracking** - No SLA/availability metrics

---

## Infrastructure Issues & Root Causes

### Issue #1: TeslaMate - Data Loss Since November

**Symptoms**: No vehicle data collection since November 2024

**Monitoring Gaps**:
- No alert if TeslaMate pod crashes/restarts
- No check if PostgreSQL connection fails
- No alert if MQTT broker becomes unavailable
- No Prometheus metrics from TeslaMate application

**Root Cause Likely**: Silent failure in one of the dependencies

**Alert Required**:
```yaml
alert: TeslaMateDataCollectionFailed
expr: increase(teslamate_api_calls_total[10m]) == 0
for: 15m
severity: critical
```

---

### Issue #2: AMD Wiki - Server Not Found

**Symptoms**: https://amd.nerdsbythehour.com/ returns "server not found"

**Monitoring Gaps**:
- No external HTTP health check on the endpoint
- No alert if Ingress route misconfigured
- No alert if pod fails to start
- No DNS resolution monitoring

**Root Cause**: Service unreachable (DNS, Ingress, or Pod issue)

**Alert Required**:
```yaml
alert: ServiceEndpointDown
expr: probe_success{endpoint="amd"} == 0
for: 5m
severity: critical
annotations:
  summary: "AMD Wiki endpoint is unreachable"
```

---

### Issue #3: JimsWiki - 404 Error

**Symptoms**: https://jimswiki.nerdsbythehour.com/ returns 404

**Monitoring Gaps**:
- No alert for application initialization failures
- No check if NFS mount is accessible
- No monitoring of disk space
- No Prometheus metrics from JimsWiki (JSPWiki)

**Root Cause**: Likely NFS mount unmounted or data corruption

**Alert Required**:
```yaml
alert: JimsWikiApplicationError
expr: probe_http_status_code{endpoint="jimswiki"} != 200
for: 5m
severity: critical
```

---

### Issue #4: Prometheus - WAL Replay Delay

**Symptoms**: "Replaying WAL (28/805)" message, extended startup

**Monitoring Gaps**:
- No alert if Prometheus takes too long to start
- No monitoring of WAL replay progress
- No alert for unclean shutdown

**Root Cause**: Previous crash or hard shutdown

**Alert Required**:
```yaml
alert: PrometheusStartupDelayed
expr: time() - prometheus_tsdb_symbol_table_size_bytes > 600 AND prometheus_tsdb_wal_replay_status != 1
for: 10m
severity: warning
```

---

### Issue #5: Grafana - Login Loop

**Symptoms**: TeslaMate dashboard link redirects to Grafana login instead of serving dashboard

**Monitoring Gaps**:
- No health check for Grafana-Prometheus datasource connection
- No alert if authentication middleware fails
- No check if Authentik is accessible

**Root Cause**: Authentik session/authentication misconfiguration

**Alert Required**:
```yaml
alert: GrafanaAuthenticationFailure
expr: increase(grafana_dashboard_access_total{status="401"}[5m]) > 10
for: 5m
severity: warning
```

---

### Issue #6: Home Assistant - Connection Failed

**Symptoms**: "Unable to connect to Home Assistant. Retrying in 23 seconds..."

**Monitoring Gaps**:
- No alert for pod crash/restart
- No check if port binding failed
- No alert for OOM kills
- No storage mount verification

**Root Cause**: Pod not running or not responding on configured port

**Alert Required**:
```yaml
alert: HomeAssistantPodDown
expr: up{job="home-assistant"} == 0
for: 2m
severity: critical
```

---

## Recommended Solutions

### 1. Enhanced Blackbox Monitoring (HIGH PRIORITY)

**Objective**: Monitor all public endpoints from outside the cluster

**Implementation**:

Create `apps/production/monitoring/prometheus/config/scrape-configs.blackbox.yaml`:

```yaml
global:
  external_labels:
    service: "endpoint-health-check"

scrape_configs:
  - job_name: 'blackbox-http'
    metrics_path: /probe
    params:
      module: [http_2xx]  # HTTP 2xx response expected
    static_configs:
      - targets:
          - https://amd.nerdsbythehour.com/
          - https://jimswiki.nerdsbythehour.com/
          - https://teslamate.nerdsbythehour.com/
          - https://ha.nerdsbythehour.com/
          - https://grafana.nerdsbythehour.com/
          - https://prometheus.nerdsbythehour.com/
          - https://cdn.nerdsbythehour.com/
          - https://nerdsbythehour.com/
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter.monitoring.svc.cluster.local:9115

  # SSL Certificate expiration checks
  - job_name: 'blackbox-ssl'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - https://nerdsbythehour.com/
          - https://teslamate.nerdsbythehour.com/
          - https://grafana.nerdsbythehour.com/
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter.monitoring.svc.cluster.local:9115

  # TCP port checks for internal services
  - job_name: 'blackbox-tcp'
    metrics_path: /probe
    params:
      module: [tcp_connect]
    static_configs:
      - targets:
          - 'postgresql.database.svc.cluster.local:5432'
          - 'mosquitto.messaging.svc.cluster.local:1883'
          - 'authentik.authentik.svc.cluster.local:9000'
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter.monitoring.svc.cluster.local:9115
```

**Alert Rules** (`apps/production/monitoring/prometheus/config/alerting-rules.blackbox.yaml`):

```yaml
groups:
  - name: blackbox_alerts
    interval: 30s
    rules:
      # External endpoint failures
      - alert: EndpointDown
        expr: probe_success == 0
        for: 5m
        labels:
          severity: critical
          component: "{{ $labels.instance }}"
        annotations:
          summary: "Endpoint {{ $labels.instance }} is down"
          description: "{{ $labels.instance }} has been unreachable for 5 minutes"

      # SSL certificate expiration warning
      - alert: SSLCertificateExpiringSoon
        expr: probe_ssl_earliest_cert_expiry - time() < 7 * 24 * 60 * 60
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "SSL cert for {{ $labels.instance }} expires in < 7 days"
          description: "Certificate expires at {{ $value | humanizeTimestamp }}"

      # SSL certificate already expired
      - alert: SSLCertificateExpired
        expr: probe_ssl_earliest_cert_expiry - time() < 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "SSL cert for {{ $labels.instance }} has expired!"

      # Service dependency failures (internal)
      - alert: ServiceDependencyDown
        expr: probe_success{job="blackbox-tcp"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service dependency {{ $labels.instance }} is unreachable"
          description: "Cannot connect to {{ $labels.instance }}"

      # High HTTP response time
      - alert: EndpointResponseTimeHigh
        expr: probe_http_duration_seconds > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.instance }} response time is slow"
          description: "Response took {{ $value | humanize }}s"
```

---

### 2. Application Health Checks (HIGH PRIORITY)

**Objective**: Monitor application-level metrics for each service

**TeslaMate Metrics** - Enable in `apps/production/teslamate/teslamate-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: teslamate
spec:
  template:
    metadata:
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "4000"
        prometheus.io/path: "/metrics"
```

**Alert Rules** (`apps/production/monitoring/prometheus/config/alerting-rules.teslamate.yaml`):

```yaml
groups:
  - name: teslamate_alerts
    interval: 30s
    rules:
      # TeslaMate pod crash detection
      - alert: TeslaMateDown
        expr: up{job="teslamate"} == 0
        for: 2m
        labels:
          severity: critical
          service: teslamate
        annotations:
          summary: "TeslaMate pod is down"

      # Data collection stopped
      - alert: TeslaMateDataCollectionStopped
        expr: increase(teslamate_updates_total[10m]) == 0
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "TeslaMate has not received updates for 15 minutes"
          description: "No vehicle data collection detected"

      # Database connection failure
      - alert: TeslaMateDBConnectionFailed
        expr: teslamate_db_connection_errors_total > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "TeslaMate cannot connect to database"

      # API rate limit warnings
      - alert: TeslaMateAPIRateLimited
        expr: increase(teslamate_api_rate_limit_exceeded_total[5m]) > 0
        labels:
          severity: warning
        annotations:
          summary: "TeslaMate API rate limit exceeded"
```

---

### 3. Service Dependency Monitoring (MEDIUM PRIORITY)

**PostgreSQL Health Check**:

```yaml
# In apps/production/monitoring/prometheus/config/alerting-rules.postgres.yaml
groups:
  - name: postgres_alerts
    rules:
      - alert: PostgreSQLDown
        expr: up{job="postgres"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL is unreachable"

      - alert: PostgreSQLHighConnections
        expr: pg_stat_activity_count > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "PostgreSQL connection pool nearing limit (80/100)"

      - alert: PostgreSQLDiskFull
        expr: pg_disk_space_available_bytes < 1 * 1024^3
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL disk space < 1GB"
```

**MQTT (Mosquitto) Health Check**:

```yaml
# In apps/production/monitoring/prometheus/config/alerting-rules.mqtt.yaml
groups:
  - name: mqtt_alerts
    rules:
      - alert: MQTTBrokerDown
        expr: up{job="mosquitto"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "MQTT broker is unreachable"

      - alert: MQTTHighMessageRate
        expr: rate(mosquitto_messages_publish_sent_total[5m]) > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "MQTT message rate unusually high"
```

---

### 4. Log Aggregation (MEDIUM PRIORITY)

**Recommended**: Deploy Loki + Promtail for centralized logging

**Benefits**:
- Single source for all pod logs
- Search by labels (namespace, pod, container)
- Linked to Prometheus metrics
- Retention and compression

**Implementation Steps**:
1. Deploy Promtail to collect logs from all pods (DaemonSet)
2. Deploy Loki to store logs
3. Add Loki as Grafana datasource
4. Create dashboard for error logs and warnings

---

### 5. Enhanced Alerting Rules (HIGH PRIORITY)

**Create these alert rule files**:

`apps/production/monitoring/prometheus/config/alerting-rules.kubernetes.yaml`:
```yaml
groups:
  - name: kubernetes_alerts
    rules:
      # Pod crash loop
      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod {{ $labels.pod }} in {{ $labels.namespace }} is crashing"

      # Pod stuck in pending
      - alert: PodPending
        expr: min_over_time(kube_pod_info{phase="Pending"}[1h]) == 1
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Pod {{ $labels.pod }} stuck in Pending state"

      # Node disk pressure
      - alert: NodeDiskPressure
        expr: kube_node_status_condition{condition="DiskPressure",status="true"} == 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Node {{ $labels.node }} has disk pressure"

      # Node memory pressure
      - alert: NodeMemoryPressure
        expr: kube_node_status_condition{condition="MemoryPressure",status="true"} == 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Node {{ $labels.node }} has memory pressure"
```

---

### 6. Real-Time Status Dashboard (LOW PRIORITY)

**Create Service Health Dashboard in Grafana**:

Components:
- Service status table (probe_success by instance)
- Availability % for each service (past 24h, 7d, 30d)
- Response time graph
- SSL certificate expiration countdown
- Pod restart count
- Database connection pool usage

---

## Implementation Roadmap

### Phase 1: Immediate (Week 1-2) - CRITICAL
- [ ] Enable Blackbox monitoring for public endpoints
- [ ] Add alert rules for endpoint failures
- [ ] Add TeslaMate metrics scraping
- [ ] Add PostgreSQL/MQTT connectivity checks
- [ ] Test Telegram notifications work for critical alerts

### Phase 2: Short-term (Week 3-4) - HIGH
- [ ] Add pod health/restart tracking
- [ ] Create Kubernetes cluster health rules
- [ ] Add JimsWiki/AMD Wiki application-level checks
- [ ] Create service dependency graph visualization
- [ ] Document runbooks for each alert

### Phase 3: Medium-term (Month 2) - MEDIUM
- [ ] Deploy log aggregation (Loki + Promtail)
- [ ] Create central status dashboard
- [ ] Add SLA/uptime tracking
- [ ] Set up trace collection (optional)

### Phase 4: Long-term (Month 3+) - LOW
- [ ] Service mesh observability (Istio/Linkerd)
- [ ] Advanced anomaly detection
- [ ] Cost tracking per service
- [ ] Automated remediation for common failures

---

## Alert Priority Levels

| Level | Response Time | Examples |
|-------|---------------|----------|
| **Critical** | Immediate (< 5 min) | Service down, data loss, security |
| **Warning** | Quick (< 30 min) | Performance issues, cert expiration soon |
| **Info** | Routine (< 1 day) | Planned maintenance, minor issues |

---

## GitHub Issues to Create

1. **[CRITICAL] TeslaMate: Missing data collection since November**
   - Investigate pod logs and database connectivity
   - Implement metrics scraping and alerting

2. **[CRITICAL] AMD Wiki: Server not found**
   - Check deployment/ingress/DNS configuration
   - Add endpoint monitoring

3. **[CRITICAL] JimsWiki: 404 error**
   - Verify NFS mount and application startup
   - Add application-level monitoring

4. **[HIGH] Prometheus: Slow WAL replay on startup**
   - Investigate previous crashes
   - Monitor startup time and trigger alerts

5. **[HIGH] Grafana: Authentication loop issue**
   - Verify Authentik session handling
   - Check middleware configuration

6. **[CRITICAL] Home Assistant: Connection failures**
   - Check pod health and port binding
   - Implement pod restart alerts

---

## Files to Create/Modify

### New Files
```
apps/production/monitoring/prometheus/config/
├── scrape-configs.blackbox.yaml        # Endpoint monitoring
├── alerting-rules.blackbox.yaml        # Endpoint alerts
├── alerting-rules.teslamate.yaml       # TeslaMate alerts
├── alerting-rules.postgres.yaml        # PostgreSQL alerts
├── alerting-rules.mqtt.yaml            # MQTT alerts
├── alerting-rules.kubernetes.yaml      # K8s cluster alerts
└── alerting-rules.general.yaml         # General infra alerts
```

### Modified Files
```
apps/production/monitoring/prometheus/kustomization.yaml  # Include new configs
apps/production/teslamate/teslamate-deployment.yaml       # Add Prometheus metrics
apps/production/monitoring/grafana/                       # Add health dashboards
```

---

## Expected Outcomes

✅ **Immediate visibility** into service failures
✅ **Proactive alerting** for dependent services
✅ **Root cause analysis** with centralized logs
✅ **SLA tracking** for critical services
✅ **Improved MTTR** (Mean Time To Recovery)

---

## References

- Prometheus alerting rules: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
- Blackbox exporter: https://github.com/prometheus/blackbox_exporter
- Alertmanager routing: https://prometheus.io/docs/alerting/latest/configuration/
- Grafana dashboards: https://grafana.com/grafana/dashboards/

