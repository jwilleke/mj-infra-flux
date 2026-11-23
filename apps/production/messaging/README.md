## Shared MQTT Messaging Infrastructure

Shared Mosquitto MQTT broker for IoT and telemetry messaging.

## Overview

Single Mosquitto MQTT broker instance serving multiple applications with topic-based isolation.

- __Namespace__: `messaging`
- __Service__: `mosquitto.messaging.svc.cluster.local:1883`
- __Protocol__: MQTT v3.1.1 / v5.0
- __Data Location__: `/mnt/local-k3s-data/mosquitto/data/` (hostPath PV on `deby`)
- __Security__: Runs as mosquitto user (UID 1883, image default), anonymous auth for internal use

## Applications & Topics

Each application uses its own topic prefix for isolation:

| Application | Topic Prefix | Description |
|-------------|--------------|-------------|
| TeslaMate | `teslamate/*` | Tesla vehicle telemetry and state |
| Home Assistant | `homeassistant/*` | Smart home automation (future) |
| Custom Apps | `custom/*` | Custom IoT integrations |

## Connecting Applications

Applications connect using Kubernetes service DNS:

__Connection Example (TeslaMate)__:

```yaml
env:
  - name: MQTT_HOST
    value: "mosquitto.messaging.svc.cluster.local"
  - name: MQTT_PORT
    value: "1883"
```

__Connection Example (Python)__:

```python
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.connect("mosquitto.messaging.svc.cluster.local", 1883, 60)
client.publish("teslamate/status", "online")
```

## Deployment

```bash
sudo kubectl apply -k apps/production/messaging/
```

## Monitoring

### Check MQTT Broker Status

```bash
# Pod status
sudo kubectl get pods -n messaging

# Logs
sudo kubectl logs -n messaging -l app=mosquitto

# Test connection from another pod
sudo kubectl run -it --rm mqtt-client --image=eclipse-mosquitto:2 --restart=Never -- mosquitto_sub -h mosquitto.messaging.svc.cluster.local -t '#' -v
```

### Publish Test Message

```bash
sudo kubectl run -it --rm mqtt-pub --image=eclipse-mosquitto:2 --restart=Never -- mosquitto_pub -h mosquitto.messaging.svc.cluster.local -t 'test/topic' -m 'Hello MQTT'
```

### Subscribe to All Topics (Debug)

```bash
sudo kubectl run -it --rm mqtt-debug --image=eclipse-mosquitto:2 --restart=Never -- mosquitto_sub -h mosquitto.messaging.svc.cluster.local -t '#' -v
```

## Configuration

The Mosquitto configuration is managed via ConfigMap (`mosquitto-configmap.yaml`).

Current settings:

- __Persistence__: Enabled (messages persisted to disk)
- __Authentication__: Anonymous allowed (internal cluster only)
- __Listeners__: 1883 (MQTT)
- __Max message size__: 256MB

### Updating Configuration

1. Edit `mosquitto-configmap.yaml`
2. Apply changes: `sudo kubectl apply -k apps/production/messaging/`
3. Restart deployment: `sudo kubectl rollout restart deployment/mosquitto -n messaging`

## Security Notes

### Current Setup (Internal Only)

- __No authentication__: Safe for internal cluster communication
- __No TLS__: Not exposed outside cluster
- __Topic isolation__: Applications use prefixed topics

### Future Enhancements (If Exposing Externally)

- Add username/password authentication
- Enable TLS/SSL
- Use Network Policies for pod-level access control
- Consider separate listeners for different security zones

## Data Persistence

Message persistence is stored at:

```
/mnt/local-k3s-data/mosquitto/data/
```

This is a hostPath PV on `deby` (local NVMe, not NFS — LMDB-on-NFS was deliberately avoided). Messages survive pod restarts.

## Backup

MQTT data is automatically persisted. For complete backup:

```bash
# Backup MQTT persistence data
sudo tar -czf mosquitto-backup-$(date +%Y%m%d).tar.gz /mnt/local-k3s-data/mosquitto/
```

The host-level `backup-deby.sh` already covers `/mnt/local-k3s-data/` as part of its rsync block (see deby#16), so MQTT data is included in the nightly backup automatically.

## Troubleshooting

### Connection Refused

Check that the service is running:

```bash
sudo kubectl get svc -n messaging
sudo kubectl get endpoints -n messaging mosquitto
```

### Messages Not Persisting

Check PVC is bound:

```bash
sudo kubectl get pvc -n messaging
```

Check logs for errors:

```bash
sudo kubectl logs -n messaging -l app=mosquitto --tail=50
```

### High Memory Usage

Adjust retain limits in ConfigMap if needed:

```conf
max_queued_messages 1000
max_inflight_messages 20
```

## Performance Tuning

For high-throughput scenarios, adjust resources in `mosquitto-deployment.yaml`:

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "2000m"
    memory: "2Gi"
```

## Migration from Docker

If migrating from Docker Mosquitto:

```bash
# 1. Stop Docker Mosquitto
docker stop teslamate-mosquitto

# 2. Copy persistence data
sudo cp -r /var/lib/docker/volumes/teslamate_mosquitto-data/_data/* \
  /mnt/local-k3s-data/mosquitto/data/

# 3. Set ownership (mosquitto user, UID 1883)
sudo chown -R 1883:1883 /mnt/local-k3s-data/mosquitto/

# 4. Deploy k8s Mosquitto
sudo kubectl apply -k apps/production/messaging/
```

## Use Cases

### TeslaMate Telemetry

- Real-time vehicle state updates
- Location tracking
- Charging status
- Climate control state

### Home Assistant (Future)

- Smart home device state
- Automation triggers
- Sensor readings

### Custom IoT Projects

- Weather stations
- Custom sensors
- Integration bridges

## Operations summary

*Moved from homelab `network/apps/messaging-mosquitto.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

An MQTT message broker in the cluster. TeslaMate publishes car data to it and
OwnTracks republishes phone locations to it. Home Assistant's own broker pulls
those topics across with a bridge.

### Access

| Item | Value |
| --- | --- |
| Address | `mqtt.nerdsbythehour.com:1883` (= `192.168.68.71`, LoadBalancer `messaging/mosquitto`) |
| In cluster | `mosquitto.messaging.svc:1883` |
| Reach | LAN only, plain MQTT (no TLS) |
| Sign-in | None, `allow_anonymous true` |

### Where it runs / where data lives

deby, namespace `messaging`, Mosquitto 2.0.22. Retained messages and
persistence at hostPath `/mnt/local-k3s-data/mosquitto/data`, included in the
nightly deby-backup rsync.

### Secrets

None.

### Dependencies

Used by [TeslaMate](../teslamate/README.md), [OwnTracks](../owntracks/README.md), and the bridge in
[Home Assistant](../home-assistant-proxy/README.md).

### Recovery

(a) Pod broken:

```bash
kubectl -n messaging get pods,svc
kubectl -n messaging rollout restart deploy/mosquitto
```

(b) Data lost: only retained messages; they refill as devices publish. Or copy
back `/deby-backup/host/daily/latest/rootfs/mnt/local-k3s-data/mosquitto/`.

(c) deby rebuilt: restore `/mnt/local-k3s-data`, Flux redeploys.

### Health checks

```bash
mosquitto_sub -h mqtt.nerdsbythehour.com -t 'teslamate/#' -C 1 -W 10 -v
```

### Known gaps

- Anyone on the LAN can read and publish (no auth, no TLS), including car and location topics.

## For users: MQTT Broker — mqtt.nerdsbythehour.com

*Moved from homelab `docs/services-provided/mqtt.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Shared MQTT message broker for IoT telemetry, vehicle tracking, and home-automation integrations.

### What it is

A single [Eclipse Mosquitto 2](https://mosquitto.org/) broker running as a pod in the `messaging` namespace of the k3s cluster on `deby`. All messages are persisted to disk and survive broker restarts.

### How to reach it

| From | Address | Port | Protocol |
|---|---|---|---|
| LAN / host | `mqtt.nerdsbythehour.com` or `deby.nerdsbythehour.com` | `1883` | plain MQTT TCP |
| Inside k3s cluster | `mosquitto.messaging.svc.cluster.local` | `1883` | plain MQTT TCP |

__No TLS, no WebSocket listener.__ Port 1883 only. The broker is reachable only from within the LAN (192.168.68.0/24) — it is not exposed to the internet.

### Authentication

None. The broker allows anonymous connections. Any client on the LAN can publish or subscribe to any topic without a username or password.

### Topics in use

Applications are isolated by topic-prefix convention (not enforced by ACLs):

| Topic prefix | Published by | Consumed by |
|---|---|---|
| `teslamate/#` | TeslaMate pod (`apps/production/teslamate/`) | Home Assistant @ 192.168.68.20 |
| `owntracks/#` | OwnTracks Recorder (`apps/production/owntracks/`) | Home Assistant @ 192.168.68.20 |
| `homeassistant/#` | Reserved for HA auto-discovery | (not active yet) |
| `custom/#` | Ad-hoc / custom integrations | — |

### Quick-connect examples

```bash
# Subscribe to all topics (from host or LAN machine with mosquitto-clients installed)
mosquitto_sub -h mqtt.nerdsbythehour.com -p 1883 -t '#' -v

# Publish a test message
mosquitto_pub -h mqtt.nerdsbythehour.com -p 1883 -t custom/test -m "hello"

# Subscribe from inside the cluster
kubectl run -it --rm mqtt-sub -n messaging --image=eclipse-mosquitto:2 --restart=Never -- \
  mosquitto_sub -h mosquitto.messaging.svc.cluster.local -t '#' -v
```

__Python (paho-mqtt):__

```python
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.connect("mqtt.nerdsbythehour.com", 1883, 60)
client.publish("custom/my-sensor", "value=42")
```

__Home Assistant YAML:__

```yaml
mqtt:
  broker: mqtt.nerdsbythehour.com
  port: 1883
```

### Security notes

- Access is LAN-only. Do not expose port 1883 to the internet without first adding TLS and authentication (see the auth section in this README for how to add credentials).
- There are no per-client ACLs; any LAN device can read every topic.

### Operator reference

For deployment details, ConfigMap layout, backup, and troubleshooting see:

- Connection URLs, auth posture and quick checks: the operator notes in this README
- [`mj-infra-flux/apps/production/messaging/README.md`](README.md) — Flux manifests and topic conventions

## Operator notes: MQTT (Mosquitto)

*Moved from homelab `docs/apps/mqtt.md` (last changed 2026-11-23) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Operator-side reference for the shared MQTT broker on `deby`. The Flux-side README at [`mj-infra-flux/apps/production/messaging/README.md`](README.md) is the source of truth for manifests and topic conventions; this page captures the connection URLs and credentials a client needs to talk to the broker.

### What's running

A single `eclipse-mosquitto:2` pod in k3s namespace `messaging`, deployed by Flux from `apps/production/messaging/` (Deployment `mosquitto`, 1 replica). Backed by hostPath PV `mosquitto-data-pv` (5 Gi) mounted at `/mosquitto/data` — the on-host directory is `/mnt/local-k3s-data/mosquitto/data/` (see [ARCHITECTURE.md §`/mnt/local-k3s-data`](https://github.com/jwilleke/homelab/blob/master/hosts/deby/ARCHITECTURE.md)). The `mosquitto.conf` ConfigMap is rendered into `/mosquitto/config/mosquitto.conf`; the on-host `/mnt/local-k3s-data/mosquitto/config/` directory exists from the 2026-05-04 migration but is now empty and unused.

### URLs

| From | URL | Notes |
| --- | --- | --- |
| Inside the k3s cluster | `mqtt://mosquitto.messaging.svc.cluster.local:1883` | Preferred for in-cluster pods; uses ClusterIP `10.43.225.202`. |
| From the host or LAN | `mqtt://deby.nerdsbythehour.com:1883` | LoadBalancer external IP is `192.168.68.71` (= `deby`). |
| From any cluster node | `mqtt://<node-ip>:30196` | NodePort fallback that the LoadBalancer also exposes. |

Protocol is plain MQTT v3.1.1 / v5.0 on TCP. __No TLS, no WebSocket listener__ — port 1883 only.

### User data / authentication

There is no authentication. The broker config sets `allow_anonymous true` and ships no `password_file` or `acl_file`, so every client connects as the anonymous user with full publish/subscribe rights on every topic. No usernames, no passwords, no per-client ACLs are configured.

Application isolation is by __topic-prefix convention only__, not enforced:

| Prefix | Publisher | Subscriber(s) |
| --- | --- | --- |
| `teslamate/*` | TeslaMate pod (`apps/production/teslamate/`) | HA @ 192.168.68.20 (LAN) |
| `owntracks/*` | OwnTracks Recorder (`apps/production/owntracks/`) — fed by phones via Cloudflare tunnel | HA @ 192.168.68.20 (LAN) |
| `homeassistant/*` | Reserved for HA auto-discovery; not in use yet | — |
| `custom/*` | Ad-hoc / custom integrations | — |

This is safe __only__ because the LoadBalancer IP is on the trusted LAN. Anything routable from outside the LAN must not reach `192.168.68.71:1883` — there is no broker-side defence.

HA itself does not need topic filtering configured: each HA integration declares the prefix it subscribes to (TeslaMate integration → `teslamate/#`, OwnTracks integration → `owntracks/#`), so HA naturally reads only the prefixes it's been told about.

### Quick connection checks

```bash
# From inside the cluster
k3s kubectl run -it --rm mqtt-sub --image=eclipse-mosquitto:2 --restart=Never -- \
  mosquitto_sub -h mosquitto.messaging.svc.cluster.local -t '#' -v

# From the host (LAN)
mosquitto_pub -h deby.nerdsbythehour.com -p 1883 -t test/ping -m "hello $(date -Is)"
mosquitto_sub -h deby.nerdsbythehour.com -p 1883 -t 'test/#' -v
```

### If you need to add auth later

The current "anonymous + LAN-only" posture is intentional but fragile. To add per-user credentials: edit the `mosquitto-config` ConfigMap in `apps/production/messaging/mosquitto-configmap.yaml` to set `allow_anonymous false` and add `password_file /mosquitto/config/passwd`, mount a Secret containing the `mosquitto_passwd`-hashed file at that path, and roll out the Deployment. Existing publishers (TeslaMate, anything publishing under `custom/*`) will need credentials at the same time or they will start failing immediately.
