# Import Node Exporter Dashboard to Grafana

## Quick Import Instructions

1. **Open Grafana**: https://grafana.nerdsbythehour.com

2. **Navigate to Import**:
   - Click the **+** icon (or menu) in the left sidebar
   - Select **Import dashboard**
   - Or go directly to: https://grafana.nerdsbythehour.com/dashboard/import

3. **Import Dashboard 1860 (Node Exporter Full)**:
   - Enter dashboard ID: `1860`
   - Click **Load**
   - Select **Prometheus** as the data source
   - Click **Import**

## Recommended Dashboards

### 1. Node Exporter Full (Dashboard ID: 1860) ⭐ RECOMMENDED
**Best comprehensive dashboard for host metrics**

Shows:
- CPU Usage (per core and overall)
- Memory Usage (RAM, Swap, Cache)
- Disk I/O and Space
- Network Traffic
- System Load
- Disk Latency
- File Descriptors
- Context Switches

**Features:**
- Multiple time ranges
- Per-node view
- Detailed breakdowns
- Most popular Node Exporter dashboard (1M+ downloads)

### 2. Node Exporter Server Metrics (Dashboard ID: 11074)
**Clean, modern alternative**

Shows:
- CPU, Memory, Disk overview
- Clean card-based layout
- Less cluttered than 1860

### 3. Node Exporter for Prometheus (Dashboard ID: 13978)
**Simple and focused**

Shows:
- Key metrics only
- Easy to read at a glance
- Good for NOC displays

## Manual Import via JSON (Advanced)

If you prefer to import via JSON:

1. Download dashboard JSON:
   ```bash
   curl -o node-exporter-full.json \
     https://grafana.com/api/dashboards/1860/revisions/latest/download
   ```

2. In Grafana:
   - Dashboards → Import
   - Click **Upload JSON file**
   - Select the downloaded file
   - Choose Prometheus datasource
   - Click Import

## Verify Metrics Are Available

Before importing dashboards, verify Node Exporter metrics in Prometheus:

1. Go to: https://prometheus.nerdsbythehour.com/graph

2. Run these test queries:

```promql
# Check if node_exporter metrics exist
up{job="kubernetes-pods", app="node-exporter"}

# CPU usage
rate(node_cpu_seconds_total{mode="idle"}[5m])

# Memory available
node_memory_MemAvailable_bytes

# Disk space
node_filesystem_avail_bytes

# Network traffic
rate(node_network_receive_bytes_total[5m])
```

If these queries return data, you're ready to import dashboards!

## Customizing Dashboards

After importing, you can customize:

1. **Click the dashboard settings** (gear icon)
2. **Make a copy** if you want to modify it
3. **Edit panels** to show only what you need
4. **Set refresh intervals**
5. **Add alerts** to panels

## Troubleshooting

### Dashboard Shows "No Data"

1. **Check Node Exporter is running**:
   ```bash
   kubectl get pods -n monitoring -l app=node-exporter
   ```

2. **Check Prometheus targets**:
   - Go to: https://prometheus.nerdsbythehour.com/targets
   - Look for node-exporter targets
   - Should show as "UP"

3. **Verify time range**:
   - Dashboard time range picker (top right)
   - Try "Last 5 minutes" or "Last 1 hour"

4. **Check datasource**:
   - Dashboard Settings → Variables
   - Ensure `datasource` is set to your Prometheus instance

### Panels Show "N/A" or Empty

- Some metrics may not be available on your system
- Check which collectors are enabled in Node Exporter
- Try querying the metric directly in Prometheus first

### High CPU/Memory from Grafana

- Reduce dashboard refresh rate (default: 30s)
- Limit time range (don't use "Last 30 days")
- Disable panels you don't need

## Next Steps

After importing the dashboard:

1. **Set up alerts** for critical metrics
2. **Create dashboard links** in your main navigation
3. **Share dashboard** with your team
4. **Export modified dashboard** to save your customizations

## References

- [Dashboard 1860 on Grafana.com](https://grafana.com/grafana/dashboards/1860)
- [Node Exporter Documentation](https://github.com/prometheus/node_exporter)
- [PromQL Query Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)
