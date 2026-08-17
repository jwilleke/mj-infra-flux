# Grafana + TeslaMate Configuration Guide

This guide walks through configuring Grafana to visualize TeslaMate data.

## Prerequisites

- Grafana deployed and accessible at <https://grafana.nerdsbythehour.com>
- TeslaMate deployed with data in shared PostgreSQL
- PostgreSQL database `teslamate` with data migrated

## Step 1: Access Grafana

1. Open <https://grafana.nerdsbythehour.com>
2. Default credentials:
   - Username: `admin`
   - Password: `admin` (you'll be prompted to change this)

## Step 2: Add TeslaMate PostgreSQL Data Source

1. In Grafana, click __Configuration__ (gear icon) → __Data Sources__
2. Click __Add data source__
3. Select __PostgreSQL__
4. Configure the data source:

   | Field | Value |
   |-------|-------|
   | __Name__ | `TeslaMate` |
   | __Host__ | `10.43.136.252:5432` (PostgreSQL ClusterIP) |
   | __Database__ | `teslamate` |
   | __User__ | `teslamate` |
   | __Password__ | `teslamate_db_password_changeme` |
   | __TLS/SSL Mode__ | `disable` (internal cluster traffic) |
   | __Version__ | `15.0` (or highest available) |

   __Note__: We use the ClusterIP directly due to DNS resolution issues in the Grafana container.
   To find the current ClusterIP: `kubectl get svc -n database postgresql -o jsonpath='{.spec.clusterIP}'`

5. Click __Save & Test__ - you should see "Database Connection OK"

## Step 3: Import TeslaMate Dashboards

TeslaMate provides pre-built dashboards. You can import them individually or use the automated import feature.

### Option A: Manual Import via Grafana UI

1. In Grafana, click __Dashboards__ → __Import__
2. Import each dashboard from the official TeslaMate repository:

__Available Dashboards__:

- __Overview__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/overview.json>
- __Drives__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/drives.json>
- __Charges__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/charges.json>
- __Charging Stats__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/charging-stats.json>
- __Charge Level__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/charge-level.json>
- __Battery Health__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/battery-health.json>
- __Drive Stats__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/drive-stats.json>
- __Updates__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/updates.json>
- __Efficiency__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/efficiency.json>
- __Vampire Drain__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/vampire-drain.json>
- __Visited__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/visited.json>
- __Drive Details__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/drive-details.json>
- __Charge Details__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/charge-details.json>
- __Projected Range__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/projected-range.json>
- __States__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/states.json>
- __Trip__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/trip.json>
- __Timeline__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/timeline.json>
- __Locations__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/locations.json>
- __Degradation__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/degradation.json>
- __Drive Mileage__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/mileage.json>
- __Database Info__: <https://raw.githubusercontent.com/teslamate-org/teslamate/main/grafana/dashboards/database-info.json>

1. For each dashboard:
   - Paste the URL in the "Import via grafana.com" field
   - Click __Load__
   - Select the __TeslaMate__ data source you created
   - Click __Import__

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

1. Access TeslaMate: <https://teslamate.nerdsbythehour.com>
2. Sign in with your Tesla credentials
3. Once vehicles are logging data, check Grafana dashboards
4. Recommended starting dashboards:
   - __Overview__: High-level view of all vehicles
   - __Drives__: Recent trip history
   - __Charges__: Charging session history

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

__Error__: "dial tcp: lookup postgresql.database.svc.cluster.local"

__Solution__: Ensure PostgreSQL service exists and is running:

```bash
sudo kubectl get svc -n database postgresql
sudo kubectl get pods -n database
```

### No Data in Dashboards

1. __Check TeslaMate is signed in__:
   - Visit <https://teslamate.nerdsbythehour.com>
   - Sign in with Tesla credentials
   - Verify vehicles appear and are logging

2. __Check data exists in database__:

   ```bash
   sudo kubectl exec -n database postgresql-0 -- psql -U teslamate -d teslamate -c \
     "SELECT COUNT(*) FROM positions;"
   ```

3. __Check data source in Grafana__:
   - Configuration → Data Sources → TeslaMate
   - Click "Test" - should show green success

### Dashboard Shows Wrong Data Source

If you imported dashboards before creating the data source:

1. Go to each dashboard settings (gear icon)
2. Click __JSON Model__
3. Find `"datasource"` entries
4. Change to `"datasource": "TeslaMate"`
5. Save

Or re-import the dashboard and select the correct data source.

## Security Recommendations

1. __Change Grafana admin password__ immediately after first login
2. __Restrict Grafana access__ with Authentik ForwardAuth:

   ```yaml
   # In grafana-ingress.yaml, uncomment:
   traefik.ingress.kubernetes.io/router.middlewares: authentik-authentik-forwardauth@kubernetescrd
   ```

3. __Change PostgreSQL password__:

   ```bash
   # Update teslamate-secret.yaml with new password
   kubectl edit secret teslamate-secret -n teslamate

   # Update Grafana datasource to use new password
   ```

## Useful Grafana Features

- __Favorites__: Star your most-used dashboards
- __Playlists__: Auto-rotate through dashboards on a display
- __Alerts__: Set up notifications for battery level, charging issues, etc.
- __Annotations__: Mark special events on timelines
- __Variables__: Filter dashboards by vehicle, date range, etc.

## Resources

- TeslaMate Dashboard Gallery: <https://docs.teslamate.org/docs/guides/dashboards>
- Grafana Documentation: <https://grafana.com/docs/grafana/latest/>
- PostgreSQL Data Source: <https://grafana.com/docs/grafana/latest/datasources/postgres/>
