# Shared Database Infrastructure

Shared PostgreSQL instance for multiple applications.

## Overview

Single PostgreSQL 17 instance serving multiple applications with isolated databases.

- **Namespace**: `database`
- **Service**: `postgresql.database.svc.cluster.local:5432`
- **Data Location**: `/home/jim/docs/data/systems/mj-infra-flux/postgresql/data`
- **Security**: Runs as apps:apps (3003:3003)

## Databases

Each application gets its own database within this shared instance:

| Database | Application | User | Notes |
|----------|-------------|------|-------|
| `teslamate` | TeslaMate | `teslamate` | Tesla vehicle tracking data |
| *future* | *future apps* | *app-specific* | Add as needed |

## Initial Setup

### 1. Deploy PostgreSQL

```bash
sudo kubectl apply -k apps/production/database/
```

### 2. Create Application Databases

Connect to PostgreSQL and create databases for each app:

```bash
# Connect to PostgreSQL pod
sudo kubectl exec -it -n database postgresql-0 -- psql -U postgres

# In psql:
CREATE DATABASE teslamate;
CREATE USER teslamate WITH PASSWORD 'teslamate_db_password_changeme';
GRANT ALL PRIVILEGES ON DATABASE teslamate TO teslamate;

# Grant schema permissions (PostgreSQL 15+)
\c teslamate
GRANT ALL ON SCHEMA public TO teslamate;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO teslamate;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO teslamate;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO teslamate;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO teslamate;

\q
```

## Connecting Applications

Applications connect using Kubernetes service DNS:

**Connection String Format**:
```
postgresql://username:password@postgresql.database.svc.cluster.local:5432/dbname
```

**Example (TeslaMate)**:
```yaml
env:
  - name: DATABASE_HOST
    value: "postgresql.database.svc.cluster.local"
  - name: DATABASE_NAME
    value: "teslamate"
  - name: DATABASE_USER
    value: "teslamate"
  - name: DATABASE_PASS
    valueFrom:
      secretKeyRef:
        name: postgresql-secret
        key: teslamate-password
```

## Data Migration

### Migrating from Docker PostgreSQL

```bash
# 1. Export from Docker
docker exec teslamate-db pg_dump -U teslamate teslamate > teslamate-backup.sql

# 2. Copy to PostgreSQL pod
sudo kubectl cp teslamate-backup.sql database/postgresql-0:/tmp/

# 3. Import to new database
sudo kubectl exec -it -n database postgresql-0 -- psql -U teslamate -d teslamate -f /tmp/teslamate-backup.sql
```

## Backup & Restore

### Backup All Databases

```bash
sudo kubectl exec -n database postgresql-0 -- pg_dumpall -U postgres > postgresql-backup-$(date +%Y%m%d).sql
```

### Backup Single Database

```bash
sudo kubectl exec -n database postgresql-0 -- pg_dump -U postgres teslamate > teslamate-backup-$(date +%Y%m%d).sql
```

### Restore

```bash
sudo kubectl cp backup.sql database/postgresql-0:/tmp/
sudo kubectl exec -it -n database postgresql-0 -- psql -U postgres -f /tmp/backup.sql
```

## Monitoring

Check PostgreSQL status:

```bash
# Pod status
sudo kubectl get pods -n database

# Logs
sudo kubectl logs -n database postgresql-0

# Check connections
sudo kubectl exec -n database postgresql-0 -- psql -U postgres -c "SELECT datname, usename, client_addr FROM pg_stat_activity;"
```

## Security Notes

- **Password Management**: Update passwords in `postgresql-secret.yaml`
- **User Isolation**: Each app has its own database user
- **Network Isolation**: Only accessible within cluster (ClusterIP)
- **Data Persistence**: PersistentVolume with Retain policy

## Scaling Considerations

This is a single-instance PostgreSQL deployment. For high availability:
- Consider PostgreSQL operators (e.g., CloudNativePG, Zalando Postgres Operator)
- Implement automated backups
- Set up replication

Current design prioritizes simplicity for homelab use.

## Troubleshooting

### Connection Issues

```bash
# Test from another pod
sudo kubectl run -it --rm postgres-client --image=postgres:17 --restart=Never -- psql -h postgresql.database.svc.cluster.local -U postgres

# Check service
sudo kubectl get svc -n database

# Check endpoints
sudo kubectl get endpoints -n database postgresql
```

### Permission Issues

If apps can't access their databases, re-grant permissions:

```bash
sudo kubectl exec -it -n database postgresql-0 -- psql -U postgres -d teslamate -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO teslamate;"
```

### Data Recovery

Data is stored on host at `/home/jim/docs/data/systems/mj-infra-flux/postgresql/data`

If the pod is deleted, data persists and will be reused when pod restarts.

## Maintenance

### PostgreSQL Version Upgrades

When upgrading PostgreSQL major versions:
1. Backup all databases
2. Use pg_upgrade or logical replication
3. Test thoroughly before production cutover

Current version: PostgreSQL 17
