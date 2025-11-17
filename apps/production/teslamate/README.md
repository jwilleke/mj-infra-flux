# TeslaMate - Tesla Vehicle Tracking

TeslaMate is a self-hosted data logger for Tesla vehicles with real-time tracking, trip history, and performance analytics.

## Overview

- **Namespace**: `teslamate`
- **URL**: https://teslamate.nerdsbythehour.com
- **Database**: Shared PostgreSQL in `database` namespace
- **MQTT**: Shared Mosquitto in `messaging` namespace
- **Grafana**: Monitoring namespace (datasource to be configured)

## Architecture

```
TeslaMate App (teslamate ns)
├── Connects to: PostgreSQL (database ns) → teslamate database
├── Publishes to: Mosquitto MQTT (messaging ns) → teslamate/* topics
└── Integrates with: Grafana (monitoring ns) → dashboards & visualization
```

## Dependencies

**Required Services** (must be running):
1. PostgreSQL with teslamate database (`postgresql.database.svc.cluster.local:5432`)
2. Mosquitto MQTT broker (`mosquitto.messaging.svc.cluster.local:1883`)
3. Grafana for dashboards (`grafana.jimwilleke.com`)

## Deployment

```bash
sudo kubectl apply -k apps/production/teslamate/
```

## Configuration

### Database Connection
- Host: `postgresql.database.svc.cluster.local`
- Database: `teslamate`
- User: `teslamate`
- Password: Stored in `teslamate-secret`

### MQTT Connection
- Host: `mosquitto.messaging.svc.cluster.local`
- Port: `1883`
- Topics: `teslamate/*`

### Security

**Secrets** (`teslamate-secret.yaml`):
- `encryption-key`: Encrypts sensitive Tesla API credentials
- `database-password`: PostgreSQL password

**IMPORTANT**: Update these before production use!

```bash
# Generate encryption key
openssl rand -base64 32

# Update secret
kubectl edit secret teslamate-secret -n teslamate
```

### Authentik Protection

To enable authentication, uncomment in `teslamate-ingress.yaml`:
```yaml
traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd
```

Then create "teslamate" group in Authentik and assign users.

## Data Migration from Docker

### Export from Docker PostgreSQL

```bash
# 1. Export database
docker exec teslamate-db pg_dump -U teslamate teslamate > teslamate-backup.sql

# 2. Copy to k3s PostgreSQL pod
sudo kubectl cp teslamate-backup.sql database/postgresql-0:/tmp/

# 3. Import to k3s database
sudo kubectl exec -n database postgresql-0 -- psql -U teslamate -d teslamate -f /tmp/teslamate-backup.sql

# 4. Restart TeslaMate to pick up existing data
sudo kubectl rollout restart deployment/teslamate -n teslamate
```

### Verify Data Migration

```bash
# Check number of records
sudo kubectl exec -n database postgresql-0 -- psql -U teslamate -d teslamate -c "SELECT COUNT(*) FROM drives;"
sudo kubectl exec -n database postgresql-0 -- psql -U teslamate -d teslamate -c "SELECT COUNT(*) FROM charges;"
```

## Grafana Integration

### Add TeslaMate Data Source

1. Access Grafana: https://grafana.jimwilleke.com
2. Configuration → Data Sources → Add data source → PostgreSQL
3. Settings:
   - **Name**: TeslaMate
   - **Host**: `postgresql.database.svc.cluster.local:5432`
   - **Database**: `teslamate`
   - **User**: `teslamate`
   - **Password**: `teslamate_db_password_changeme`
   - **TLS/SSL Mode**: disable (internal cluster communication)

### Import TeslaMate Dashboards

TeslaMate includes pre-built Grafana dashboards:

```bash
# Dashboard IDs from TeslaMate GitHub
# Import via Grafana UI: Dashboards → Import → Upload JSON
```

Or use the TeslaMate Grafana integration feature (requires configuration).

## Monitoring

### Check TeslaMate Status

```bash
# Pod status
sudo kubectl get pods -n teslamate

# Logs
sudo kubectl logs -n teslamate -l app=teslamate --tail=50

# Follow logs
sudo kubectl logs -n teslamate -l app=teslamate -f
```

### Check MQTT Messages

```bash
# Subscribe to TeslaMate MQTT topics
sudo kubectl run -it --rm mqtt-sub --image=eclipse-mosquitto:2 --restart=Never -- \
  mosquitto_sub -h mosquitto.messaging.svc.cluster.local -t 'teslamate/#' -v
```

### Check Database Connection

```bash
# Connect to database
sudo kubectl exec -it -n database postgresql-0 -- psql -U teslamate -d teslamate

# Check tables
\dt

# Query recent drives
SELECT * FROM drives ORDER BY start_date DESC LIMIT 5;
```

## Troubleshooting

### TeslaMate Won't Start

**Error**: Permission denied creating extensions
```
Solution: Grant superuser to teslamate user
sudo kubectl exec -n database postgresql-0 -- psql -U postgres -d teslamate -c "ALTER USER teslamate WITH SUPERUSER;"
```

**Error**: Can't connect to database
```
Check PostgreSQL is running:
sudo kubectl get pods -n database

Check service DNS:
sudo kubectl get svc -n database postgresql
```

### No MQTT Data

```
Check Mosquitto is running:
sudo kubectl get pods -n messaging

Test MQTT connection:
sudo kubectl run -it --rm mqtt-test --image=eclipse-mosquitto:2 --restart=Never -- \
  mosquitto_pub -h mosquitto.messaging.svc.cluster.local -t 'test' -m 'hello'
```

### No Data in Grafana

1. Verify datasource connection in Grafana
2. Check TeslaMate has logged into Tesla account
3. Ensure vehicle is awake and sending data
4. Check database has data: `SELECT COUNT(*) FROM positions;`

## Features

- Real-time vehicle tracking
- Trip history and statistics
- Charging session tracking
- Battery degradation monitoring
- Cost tracking
- Geofencing
- MQTT real-time updates
- Comprehensive Grafana dashboards

## Tesla API

TeslaMate uses your Tesla account credentials to access vehicle data:
1. Access https://teslamate.nerdsbythehour.com
2. Sign in with your Tesla credentials
3. Grant access to your vehicle(s)
4. Data logging begins automatically

## Security Notes

- **Credentials**: Tesla credentials encrypted with `ENCRYPTION_KEY`
- **Database**: Isolated teslamate database with own user
- **MQTT**: Topic prefix `teslamate/*` for isolation
- **Network**: All internal cluster communication
- **Ingress**: HTTPS with Let's Encrypt TLS
- **Auth**: Protect with Authentik ForwardAuth (optional but recommended)

## Maintenance

### Backup TeslaMate Data

```bash
# Backup database
sudo kubectl exec -n database postgresql-0 -- \
  pg_dump -U teslamate teslamate > teslamate-backup-$(date +%Y%m%d).sql
```

### Update TeslaMate

```bash
# Update image version in deployment.yaml, then:
sudo kubectl apply -k apps/production/teslamate/
sudo kubectl rollout restart deployment/teslamate -n teslamate
```

### Reset TeslaMate (Fresh Start)

```bash
# WARNING: This deletes all data
sudo kubectl exec -n database postgresql-0 -- psql -U postgres -c "DROP DATABASE teslamate;"
sudo kubectl exec -n database postgresql-0 -- psql -U postgres -c "CREATE DATABASE teslamate OWNER teslamate;"
sudo kubectl rollout restart deployment/teslamate -n teslamate
```

## Resources

- TeslaMate GitHub: https://github.com/teslamate-org/teslamate
- Documentation: https://docs.teslamate.org/
- Community: https://github.com/teslamate-org/teslamate/discussions
