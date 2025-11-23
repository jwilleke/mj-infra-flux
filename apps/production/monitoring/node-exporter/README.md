# Node Exporter - Host Metrics Collection

## Overview

Node Exporter exposes hardware and kernel-level metrics from the host system to Prometheus, providing comprehensive insights into system performance.

- **Namespace**: `monitoring`
- **Deployment Type**: DaemonSet (one pod per node)
- **Port**: 9100
- **Metrics Endpoint**: `http://node-exporter.monitoring.svc.cluster.local:9100/metrics`

## What It Monitors

### CPU Metrics
- CPU usage per core
- CPU time by mode (user, system, idle, iowait)
- Context switches
- Interrupts

### Memory Metrics
- Total, available, used memory
- Swap usage
- Page faults
- Memory pressure

### Disk Metrics
- Disk I/O operations
- Read/write throughput
- Disk space usage per filesystem
- Inode usage

### Network Metrics
- Network traffic (bytes in/out)
- Packet counts
- Network errors and drops
- Connection states

### System Metrics
- System load averages (1m, 5m, 15m)
- Uptime
- Number of processes
- File descriptors

### Additional Collectors
- Systemd unit states
- Temperature sensors (if available)
- Network statistics
- Filesystem statistics

## Deployment

### Apply with kubectl

```bash
kubectl apply -k apps/production/monitoring/node-exporter/
```

### Verify Deployment

```bash
# Check DaemonSet status
kubectl get daemonset -n monitoring node-exporter

# Check pods (should be one per node)
kubectl get pods -n monitoring -l app=node-exporter

# Check metrics endpoint
kubectl exec -n monitoring $(kubectl get pod -n monitoring -l app=node-exporter -o jsonpath='{.items[0].metadata.name}') -- wget -qO- localhost:9100/metrics | head -20
```

## Prometheus Integration

Node Exporter is automatically discovered by Prometheus via the pod annotations:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "9100"
  prometheus.io/path: "/metrics"
```

### Verify Scraping

1. Go to Prometheus: https://prometheus.nerdsbythehour.com/targets
2. Look for `kubernetes-pods` job
3. Find `node-exporter` targets - should show as "UP"

## Grafana Dashboards

### Recommended Pre-built Dashboards

Import these dashboard IDs in Grafana (Dashboards → Import):

1. **Node Exporter Full** - Dashboard ID: **1860**
   - Most comprehensive, shows all metrics
   - CPU, Memory, Disk, Network in detail
   - Best for general monitoring

2. **Node Exporter Server Metrics** - Dashboard ID: **11074**
   - Clean, modern layout
   - Focus on key metrics

3. **Node Exporter for Prometheus Dashboard** - Dashboard ID: **13978**
   - Simple, easy to read
   - Good for quick overviews

### Import Steps

1. Navigate to Grafana: https://grafana.nerdsbythehour.com
2. Click **Dashboards** → **Import**
3. Enter dashboard ID (e.g., `1860`)
4. Select **Prometheus** as data source
5. Click **Import**

## Common Queries

### CPU Usage

```promql
# CPU usage percentage per core
100 - (avg by (cpu) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Overall CPU usage
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### Memory Usage

```promql
# Memory usage percentage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Available memory in GB
node_memory_MemAvailable_bytes / 1024 / 1024 / 1024
```

### Disk Usage

```promql
# Disk space used percentage
(1 - (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"})) * 100

# Disk I/O operations per second
rate(node_disk_io_time_seconds_total[5m])
```

### Network Traffic

```promql
# Network receive bandwidth (MB/s)
rate(node_network_receive_bytes_total{device!~"lo|veth.*"}[5m]) / 1024 / 1024

# Network transmit bandwidth (MB/s)
rate(node_network_transmit_bytes_total{device!~"lo|veth.*"}[5m]) / 1024 / 1024
```

### System Load

```promql
# Load average (1 minute)
node_load1

# Load average (5 minutes)
node_load5

# Load average (15 minutes)
node_load15
```

## Configuration

### Enabled Collectors

The following collectors are enabled:
- `processes` - Process statistics
- `systemd` - Systemd unit status
- Default collectors (cpu, memory, disk, network, etc.)

### Disabled Collectors

- `ipvs` - IPVS stats (not needed for most setups)

### Resource Limits

```yaml
resources:
  limits:
    cpu: 250m
    memory: 180Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -n monitoring <node-exporter-pod>

# Check logs
kubectl logs -n monitoring <node-exporter-pod>
```

### Metrics Not Appearing in Prometheus

1. Verify pod annotations:
   ```bash
   kubectl get pod -n monitoring -l app=node-exporter -o yaml | grep prometheus
   ```

2. Check Prometheus targets:
   - Go to https://prometheus.nerdsbythehour.com/targets
   - Search for "node-exporter"

3. Test metrics endpoint directly:
   ```bash
   kubectl port-forward -n monitoring <node-exporter-pod> 9100:9100
   curl localhost:9100/metrics
   ```

### No Systemd Metrics

If systemd metrics aren't appearing, ensure:
- The pod has `hostPID: true`
- Volume mount for `/host/sys` is correct
- Running with proper privileges

## Security

Node Exporter runs with:
- `runAsNonRoot: true`
- `runAsUser: 65534` (nobody user)
- Minimal capabilities (all dropped)
- Read-only volume mounts

It requires:
- `hostNetwork: true` - To see host network stats
- `hostPID: true` - To see all processes
- `hostIPC: true` - For complete system view

## Maintenance

### Update Version

Edit `node-exporter-daemonset.yaml`:

```yaml
image: prom/node-exporter:v1.8.2  # Change version here
```

Then apply:

```bash
kubectl apply -k apps/production/monitoring/node-exporter/
```

### Check Available Metrics

```bash
# See all available metrics
kubectl exec -n monitoring <node-exporter-pod> -- \
  wget -qO- localhost:9100/metrics | grep "^node_" | cut -d' ' -f1 | sort | uniq
```

## References

- [Node Exporter GitHub](https://github.com/prometheus/node_exporter)
- [Node Exporter Documentation](https://prometheus.io/docs/guides/node-exporter/)
- [Grafana Dashboard Gallery](https://grafana.com/grafana/dashboards/?search=node+exporter)
