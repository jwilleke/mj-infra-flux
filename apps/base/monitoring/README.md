# Kube State Metrics

Used to monitor the state of installed objects within Kubernetes, rather than the Kubernetes cluster itself (like metrics-server).

The **available metrics** are documented at: https://github.com/kubernetes/kube-state-metrics/tree/main/docs

## Installation / Deployment

> To deploy this project, you can simply run kubectl apply -f examples/standard and a Kubernetes service and deployment will be created
> – https://github.com/kubernetes/kube-state-metrics#kubernetes-deployment

They publish a kustomization file there, so we can just use kustomize to import it directly: https://github.com/kubernetes/kube-state-metrics/blob/v2.15.0/examples/standard/kustomization.yaml

Then we need to patch a couple things:

### 1. Resource Limits

> As a general rule, you should allocate:
> 250MiB memory
> 0.1 cores
> – https://github.com/kubernetes/kube-state-metrics#resource-recommendation

### 2. Metrics Scrape Endpoints

As described in my metrics setup for prometheus at https://github.com/activescott/home-infra/blob/main/k8s/apps/monitoring/README.md, we can add a couple annotations to the service. Kube State Metrics [explains](https://github.com/kubernetes/kube-state-metrics#overview) that that their _metrics are exported on the HTTP endpoint `/metrics` on the listening port (default 8080)._
So:

```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "8080"
prometheus.io/path: "/metrics"
```