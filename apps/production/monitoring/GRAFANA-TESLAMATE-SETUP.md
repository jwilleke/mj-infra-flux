# Grafana + TeslaMate Configuration Guide

This guide walks through configuring Grafana to visualize TeslaMate data.

## Prerequisites

- Grafana deployed and accessible at https://grafana.jimwilleke.com
- TeslaMate deployed with data in shared PostgreSQL
- PostgreSQL database `teslamate` with data migrated

## Step 1: Access Grafana

1. Open https://grafana.jimwilleke.com
2. Default credentials:
   - Username: `admin`
   - Password: `admin` (you'll be prompted to change this)

## Step 2: Add TeslaMate PostgreSQL Data Source

1. In Grafana, click **Configuration** (gear icon) → **Data Sources**
2. Click **Add data source**
3. Select **PostgreSQL**
4. Configure the data source:

   | Field | Value |
   |-------|-------|
   | **Name** | `TeslaMate` |
   | **Host** | `postgresql.database.svc.cluster.local:5432` |
   | **Database** | `teslamate` |
   | **User** | `teslamate` |
   | **Password** | `teslamate_db_password_changeme` |
   | **TLS/SSL Mode** | `disable` (internal cluster traffic) |
   | **Version** | `17.0` |

5. Click **Save & Test** - you should see "Database Connection OK"

## Step 3: Import TeslaMate Dashboards

TeslaMate provides pre-built dashboards. You can import them individually or use the automated import feature.

### Option A: Manual Import via Grafana UI

1. In Grafana, click **Dashboards** → **Import**
2. Import each dashboard from the official TeslaMate repository:

**Available Dashboards**:
- **Overview**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/overview.json
- **Drives**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/drives.json
- **Charges**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/charges.json
- **Charging Stats**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/charging-stats.json
- **Charge Level**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/charge-level.json
- **Battery Health**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/battery-health.json
- **Drive Stats**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/drive-stats.json
- **Updates**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/updates.json
- **Efficiency**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/efficiency.json
- **Vampire Drain**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/vampire-drain.json
- **Visited**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/visited.json
- **Drive Details**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/drive-details.json
- **Charge Details**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/charge-details.json
- **Projected Range**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/projected-range.json
- **States**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/states.json
- **Trip**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/trip.json
- **Timeline**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/timeline.json
- **Locations**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/locations.json
- **Degradation**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/degradation.json
- **Drive Mileage**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/mileage.json
- **Database Info**: https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/database-info.json

3. For each dashboard:
   - Paste the URL in the "Import via grafana.com" field
   - Click **Load**
   - Select the **TeslaMate** data source you created
   - Click **Import**

### Option B: Download All Dashboards

```bash
# Download all dashboards to a local directory
mkdir -p /tmp/teslamate-dashboards
cd /tmp/teslamate-dashboards

curl -s https://api.github.com/repos/teslamate-org/teslamate/contents/grafana/dashboards | \
  grep -o '"download_url": "[^"]*"' | \
  cut -d'"' -f4 | \
  xargs -n 1 wget

# Then import each JSON file via Grafana UI: Dashboards → Import → Upload JSON file
```

## Step 4: Configure TeslaMate to Link to Grafana

Update the TeslaMate deployment to know about Grafana:

```bash
# The deployment already has GRAFANA_URL configured:
# GRAFANA_URL: "https://grafana.jimwilleke.com"
```

This allows TeslaMate to provide direct links to relevant Grafana dashboards.

## Step 5: Verify Everything Works

1. Access TeslaMate: https://teslamate.nerdsbythehour.com
2. Sign in with your Tesla credentials
3. Once vehicles are logging data, check Grafana dashboards
4. Recommended starting dashboards:
   - **Overview**: High-level view of all vehicles
   - **Drives**: Recent trip history
   - **Charges**: Charging session history

## Data Migration Confirmation

Verify your migrated data appears in Grafana:

```bash
# Check database has data
sudo kubectl exec -n database postgresql-0 -- psql -U teslamate -d teslamate -c \
  "SELECT COUNT(*) AS drives FROM drives;"

# Expected output: 1002 drives (from Docker migration)
```

If dashboards show data from before the migration, it worked! 🎉

## Troubleshooting

### Data Source Connection Failed

**Error**: "dial tcp: lookup postgresql.database.svc.cluster.local"

**Solution**: Ensure PostgreSQL service exists and is running:
```bash
sudo kubectl get svc -n database postgresql
sudo kubectl get pods -n database
```

### No Data in Dashboards

1. **Check TeslaMate is signed in**:
   - Visit https://teslamate.nerdsbythehour.com
   - Sign in with Tesla credentials
   - Verify vehicles appear and are logging

2. **Check data exists in database**:
   ```bash
   sudo kubectl exec -n database postgresql-0 -- psql -U teslamate -d teslamate -c \
     "SELECT COUNT(*) FROM positions;"
   ```

3. **Check data source in Grafana**:
   - Configuration → Data Sources → TeslaMate
   - Click "Test" - should show green success

### Dashboard Shows Wrong Data Source

If you imported dashboards before creating the data source:

1. Go to each dashboard settings (gear icon)
2. Click **JSON Model**
3. Find `"datasource"` entries
4. Change to `"datasource": "TeslaMate"`
5. Save

Or re-import the dashboard and select the correct data source.

## Security Recommendations

1. **Change Grafana admin password** immediately after first login
2. **Restrict Grafana access** with Authentik ForwardAuth:
   ```yaml
   # In grafana-ingress.yaml, uncomment:
   traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd
   ```
3. **Change PostgreSQL password**:
   ```bash
   # Update teslamate-secret.yaml with new password
   kubectl edit secret teslamate-secret -n teslamate

   # Update Grafana datasource to use new password
   ```

## Useful Grafana Features

- **Favorites**: Star your most-used dashboards
- **Playlists**: Auto-rotate through dashboards on a display
- **Alerts**: Set up notifications for battery level, charging issues, etc.
- **Annotations**: Mark special events on timelines
- **Variables**: Filter dashboards by vehicle, date range, etc.

## Resources

- TeslaMate Dashboard Gallery: https://docs.teslamate.org/docs/guides/dashboards
- Grafana Documentation: https://grafana.com/docs/grafana/latest/
- PostgreSQL Data Source: https://grafana.com/docs/grafana/latest/datasources/postgres/
