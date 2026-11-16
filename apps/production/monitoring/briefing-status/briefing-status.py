"""Write a 5-line infra status for the ~05:10 ET morning briefing (jwilleke/deby#69).

Queries Prometheus in-cluster and stores the result as data["status.md"] in
the monitoring/briefing-status ConfigMap via the Kubernetes API. Standard
library only (runs on python:3-alpine with no pip installs).
"""
import datetime
import json
import os
import ssl
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

PROM = os.environ.get("PROM_URL", "http://prometheus-service.monitoring.svc")
NAMESPACE = os.environ.get("POD_NAMESPACE", "monitoring")
CONFIGMAP = os.environ.get("CONFIGMAP", "briefing-status")
TZ = ZoneInfo("America/New_York")
SA = "/var/run/secrets/kubernetes.io/serviceaccount"
# deby's node-exporter is scraped by two jobs; use one.
DEBY = 'job="kubernetes-service-endpoints",service="node-exporter"'
CLARA = 'job="clara-node"'


def q(expr):
    url = PROM + "/api/v1/query?" + urllib.parse.urlencode({"query": expr})
    with urllib.request.urlopen(url, timeout=20) as r:
        d = json.load(r)
    return d["data"]["result"]


def scalar(expr):
    r = q(expr)
    return float(r[0]["value"][1]) if r else None


def fmt_n(v):
    return "?" if v is None else str(int(v))


def ago(ts):
    if ts is None:
        return "no data"
    h = (datetime.datetime.now(TZ).timestamp() - ts) / 3600
    return f"{h:.0f}h ago" if h < 48 else f"{h / 24:.1f}d ago"


def when(ts):
    if ts is None:
        return "no data"
    return datetime.datetime.fromtimestamp(ts, TZ).strftime("%a %b %-d %H:%M ET")


def line_reboot():
    parts = []
    for host, sel in (("deby", DEBY), ("clara", CLARA)):
        v = scalar(f"max(node_reboot_required{{{sel}}})")
        parts.append(f"{host} {'YES' if v == 1 else ('no' if v == 0 else 'no data')}")
    return "Reboot pending: " + ", ".join(parts)


def line_backups():
    # backup-deby stamps its success marker by date, so report the date.
    deby = scalar("max(deby_backup_deby_last_success_timestamp_seconds)")
    deby_s = datetime.datetime.fromtimestamp(deby, TZ).strftime("%a %b %-d") if deby else "no data"
    nas = scalar("max(deby_nas_backup_rsync_last_success_timestamp_seconds)")
    return f"Backups: backup-deby last OK {deby_s}; nas-backup-rsync last OK {when(nas)} ({ago(nas)})"


def line_down():
    down = sorted(
        {r["metric"].get("instance", "?") + " (" + r["metric"].get("job", "?") + ")" for r in q("up == 0")}
        | {r["metric"].get("instance", "?") for r in q("probe_success == 0")}
    )
    alerts = q('count by (alertname, severity) (ALERTS{alertstate="firing"})')
    crit = sorted(r["metric"]["alertname"] for r in alerts if r["metric"].get("severity") == "critical")
    warn = sorted(r["metric"]["alertname"] for r in alerts if r["metric"].get("severity") != "critical")
    down_s = ", ".join(down) if down else "none"
    al = []
    if crit:
        al.append("critical: " + ", ".join(crit))
    if warn:
        al.append("warning: " + ", ".join(warn))
    return f"Down checks: {down_s}. Firing alerts: {'; '.join(al) if al else 'none'}"


def line_packages():
    parts = []
    for host, sel in (("deby", DEBY), ("clara", CLARA)):
        deb = scalar(f'sum(apt_upgrades_pending{{{sel},origin=~"Debian.*"}}) or vector(0)')
        other = scalar(f'sum(apt_upgrades_pending{{{sel},origin!~"Debian.*",origin!=""}}) or vector(0)')
        seen = q(f"apt_package_cache_timestamp_seconds{{{sel}}}")
        if not seen:
            parts.append(f"{host} no data")
        else:
            parts.append(f"{host} {fmt_n(deb)} Debian + {fmt_n(other)} third-party")
    return "Package updates pending: " + "; ".join(parts)


def line_images_firmware():
    docker = scalar(f"max(deby_docker_image_updates_pending{{{DEBY}}})")
    fw = scalar(f"max(deby_fwupd_updates_pending{{{DEBY}}})")
    docker_s = "Diun not installed" if docker is None or docker < 0 else f"{int(docker)} Docker image(s) with a newer version (Diun, last 7d)"
    fw_s = "no data" if fw is None or fw < 0 else f"{int(fw)} on deby (fwupd; not auto-applied)"
    return f"Image/firmware updates: {docker_s}; firmware {fw_s}"


def main():
    now = datetime.datetime.now(TZ)
    lines = []
    for fn in (line_reboot, line_backups, line_down, line_packages, line_images_firmware):
        try:
            lines.append(fn())
        except Exception as e:  # one broken query must not lose the other lines
            lines.append(f"{fn.__name__}: ERROR {e}")
    body = f"# Infra status {now:%Y-%m-%d %H:%M} ET\n\n" + "\n".join(f"- {l}" for l in lines) + "\n"
    print(body)

    token = open(f"{SA}/token").read().strip()
    ctx = ssl.create_default_context(cafile=f"{SA}/ca.crt")
    host = os.environ["KUBERNETES_SERVICE_HOST"]
    port = os.environ.get("KUBERNETES_SERVICE_PORT", "443")
    patch = json.dumps({"data": {"status.md": body, "generated": now.isoformat()}}).encode()
    req = urllib.request.Request(
        f"https://{host}:{port}/api/v1/namespaces/{NAMESPACE}/configmaps/{CONFIGMAP}",
        data=patch,
        method="PATCH",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/merge-patch+json"},
    )
    with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
        print("configmap patched:", r.status)


if __name__ == "__main__":
    main()
