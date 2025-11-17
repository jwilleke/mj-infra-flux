## Shared MQTT Messaging Infrastructure

Shared Mosquitto MQTT broker for IoT and telemetry messaging.

## Overview

Single Mosquitto MQTT broker instance serving multiple applications with topic-based isolation.

- **Namespace**: `messaging`
- **Service**: `mosquitto.messaging.svc.cluster.local:1883`
- **Protocol**: MQTT v3.1.1 / v5.0
- **Data Location**: `/home/jim/docs/data/systems/mj-infra-flux/mosquitto/`
- **Security**: Runs as apps:apps (3003:3003), anonymous auth for internal use

## Applications & Topics

Each application uses its own topic prefix for isolation:

| Application | Topic Prefix | Description |
|-------------|--------------|-------------|
| TeslaMate | `teslamate/*` | Tesla vehicle telemetry and state |
| Home Assistant | `homeassistant/*` | Smart home automation (future) |
| Custom Apps | `custom/*` | Custom IoT integrations |

## Connecting Applications

Applications connect using Kubernetes service DNS:

**Connection Example (TeslaMate)**:
```yaml
env:
  - name: MQTT_HOST
    value: "mosquitto.messaging.svc.cluster.local"
  - name: MQTT_PORT
    value: "1883"
```

**Connection Example (Python)**:
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
- **Persistence**: Enabled (messages persisted to disk)
- **Authentication**: Anonymous allowed (internal cluster only)
- **Listeners**: 1883 (MQTT)
- **Max message size**: 256MB

### Updating Configuration

1. Edit `mosquitto-configmap.yaml`
2. Apply changes: `sudo kubectl apply -k apps/production/messaging/`
3. Restart deployment: `sudo kubectl rollout restart deployment/mosquitto -n messaging`

## Security Notes

### Current Setup (Internal Only)
- **No authentication**: Safe for internal cluster communication
- **No TLS**: Not exposed outside cluster
- **Topic isolation**: Applications use prefixed topics

### Future Enhancements (If Exposing Externally)
- Add username/password authentication
- Enable TLS/SSL
- Use Network Policies for pod-level access control
- Consider separate listeners for different security zones

## Data Persistence

Message persistence is stored at:
```
/home/jim/docs/data/systems/mj-infra-flux/mosquitto/data/
```

This ensures messages survive pod restarts.

## Backup

MQTT data is automatically persisted. For complete backup:

```bash
# Backup MQTT persistence data
sudo tar -czf mosquitto-backup-$(date +%Y%m%d).tar.gz /home/jim/docs/data/systems/mj-infra-flux/mosquitto/
```

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
  /home/jim/docs/data/systems/mj-infra-flux/mosquitto/data/

# 3. Set ownership
sudo chown -R 3003:3003 /home/jim/docs/data/systems/mj-infra-flux/mosquitto/

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
