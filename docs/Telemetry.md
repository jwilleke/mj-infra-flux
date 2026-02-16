# Telemetry: Sending Metrics to the Monitoring Stack

This guide covers how applications can get their metrics into Prometheus and Grafana.

## Architecture Overview

```
                        ┌──────────────┐
External apps ─OTLP──▶ │              │
  (push over HTTPS)     │    OTEL      │  :8889 /metrics
                        │  Collector   │◀── Prometheus scrapes
In-cluster apps ─OTLP─▶│              │
  (push over gRPC)      └──────────────┘

In-cluster apps ────────────────────────▶ Prometheus scrapes directly
  (pull via pod annotations)               (pod annotation discovery)
```

There are three ways to get metrics in:

| Method | Best for | Protocol | Direction |
|--------|----------|----------|-----------|
| **OTLP push (external)** | Apps outside the cluster | HTTPS | App pushes to collector |
| **OTLP push (in-cluster)** | Apps using OpenTelemetry SDKs | gRPC/HTTP | App pushes to collector |
| **Pod annotations (pull)** | In-cluster apps with `/metrics` endpoint | HTTP | Prometheus scrapes app |

---

## Option 1: Push Metrics via OTLP (OpenTelemetry)

The OpenTelemetry Collector accepts metrics pushed by applications and makes them available to Prometheus.

### Endpoints

| Endpoint | Use case |
|----------|----------|
| `https://otel.nerdsbythehour.com` | External apps (outside cluster) |
| `otel-collector.monitoring.svc.cluster.local:4317` | In-cluster apps (gRPC) |
| `otel-collector.monitoring.svc.cluster.local:4318` | In-cluster apps (HTTP) |

### Python Example

```bash
pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-http
```

```python
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter

# For external apps, push over HTTPS:
exporter = OTLPMetricExporter(endpoint="https://otel.nerdsbythehour.com/v1/metrics")

# For in-cluster apps, push over HTTP:
# exporter = OTLPMetricExporter(endpoint="http://otel-collector.monitoring.svc.cluster.local:4318/v1/metrics")

reader = PeriodicExportingMetricReader(exporter, export_interval_millis=30000)
provider = MeterProvider(metric_readers=[reader])
metrics.set_meter_provider(provider)

meter = metrics.get_meter("my-app")
request_counter = meter.create_counter("app_requests_total", description="Total requests")

# In your app code:
request_counter.add(1, {"method": "GET", "path": "/api/data"})
```

### Go Example

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
    sdkmetric "go.opentelemetry.io/otel/sdk/metric"
)

// For in-cluster apps, push over gRPC:
exporter, _ := otlpmetricgrpc.New(ctx,
    otlpmetricgrpc.WithEndpoint("otel-collector.monitoring.svc.cluster.local:4317"),
    otlpmetricgrpc.WithInsecure(),
)

reader := sdkmetric.NewPeriodicReader(exporter, sdkmetric.WithInterval(30*time.Second))
provider := sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader))
otel.SetMeterProvider(provider)
```

### Node.js Example

```bash
npm install @opentelemetry/sdk-metrics @opentelemetry/exporter-metrics-otlp-http
```

```javascript
const { MeterProvider, PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');

const exporter = new OTLPMetricExporter({
  url: 'https://otel.nerdsbythehour.com/v1/metrics',
});

const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 30000 });
const provider = new MeterProvider({ readers: [reader] });

const meter = provider.getMeter('my-app');
const counter = meter.createCounter('app_requests_total');
counter.add(1, { method: 'GET' });
```

### Test OTLP Endpoint

```bash
# Send an empty payload to verify the endpoint is reachable
curl -i https://otel.nerdsbythehour.com/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{"resourceMetrics":[]}'
```

---

## Option 2: Pod Annotations (In-Cluster Pull)

If your app already exposes a Prometheus `/metrics` endpoint, just add annotations to your pod template. Prometheus discovers and scrapes these automatically.

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
        prometheus.io/port: "8080"        # port your /metrics is on
        prometheus.io/path: "/metrics"    # optional, /metrics is the default
    spec:
      containers:
        - name: myapp
          image: myapp:latest
          ports:
            - containerPort: 8080
```

That's it. Prometheus will find and scrape the pod within its next discovery cycle.

---

## Option 3: Add a Scrape Target to the OTEL Collector

To have the collector pull metrics from a remote URL (e.g., an app that exposes `/metrics` but can't push), add a `prometheus` receiver to the collector config.

Edit `apps/production/monitoring/otel-collector/config/otel-collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

  # Add scrape targets here
  prometheus:
    config:
      scrape_configs:
        - job_name: 'my-remote-app'
          scrape_interval: 30s
          scheme: https
          static_configs:
            - targets: ['myapp.example.com:443']
          # Optional: custom metrics path
          # metrics_path: /custom/metrics
          # Optional: basic auth
          # basic_auth:
          #   username: user
          #   password: pass

service:
  extensions: [health_check]
  pipelines:
    metrics:
      receivers: [otlp, prometheus]    # add prometheus to the list
      processors: [batch]
      exporters: [prometheus]
```

The `scrape_configs` block uses the same syntax as [Prometheus scrape_configs](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config).

Commit and push — Flux will reconcile the change.

---

## Querying Your Metrics

Once metrics are flowing, they appear in Prometheus and can be queried in Grafana.

- **Prometheus UI**: https://prometheus.nerdsbythehour.com/graph
- **Grafana**: https://grafana.nerdsbythehour.com (Prometheus datasource is pre-configured)

Metrics pushed via OTLP will appear with the metric names your app defined. The `resource_to_telemetry_conversion` setting on the collector means OTLP resource attributes (like `service.name`) become Prometheus labels.

```promql
# Example: query a counter pushed via OTLP
rate(app_requests_total[5m])

# Filter by labels
app_requests_total{service_name="my-app", method="GET"}
```

---

## Verify the Pipeline

```bash
# Check the collector pod is running
kubectl get pods -n monitoring -l app=otel-collector

# Check Prometheus is scraping the collector
# Look for otel-collector in the kubernetes-pods job at:
# https://prometheus.nerdsbythehour.com/targets

# Port-forward to the collector health endpoint
kubectl port-forward -n monitoring svc/otel-collector 13133:13133
curl localhost:13133
```

## Related

- OTEL Collector config: `apps/production/monitoring/otel-collector/`
- Prometheus config: `apps/production/monitoring/prometheus/`
- Monitoring stack overview: `apps/production/monitoring/README.md`
