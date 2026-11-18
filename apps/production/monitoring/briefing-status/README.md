# briefing-status

A daily 04:45 ET CronJob that writes a five-line infra status for News-Guy's ~05:10 ET spoken briefing ([deby#69](https://github.com/jwilleke/deby/issues/69)).

## What it reports

1. __Reboot pending__ per host (`node_reboot_required`, deby and clara).
2. __Backups__: last `backup-deby` success (by date) and last `nas-backup-rsync` success.
3. __Down checks__: scrape targets with `up == 0`, blackbox probes with `probe_success == 0`, and firing alerts by severity.
4. __Package updates pending__ per host, Debian origins vs third-party (`apt_upgrades_pending`).
5. __Image / firmware updates__: Docker images Diun saw updated in the last 7 days and fwupd devices with firmware available (deby textfile metrics).

deby's apt, reboot, Diun and fwupd lines read `no data` until the host producers in jwilleke/deby (`docs/custom-services/host-maintenance.md`) are installed.

## Where it goes

The Job patches `data["status.md"]` in the `monitoring/briefing-status` ConfigMap. Flux creates that ConfigMap once with `kustomize.toolkit.fluxcd.io/ssa: IfNotPresent`, so it never reverts the daily content. The Job's ServiceAccount can only `get`/`patch` that one ConfigMap, and it queries Prometheus over the in-cluster Service (no auth needed there; the Authentik gate is on the Ingress).

Read it from any machine with deby SSH access:

```bash
ssh deby "kubectl --kubeconfig ~/.kube/config -n monitoring get configmap briefing-status -o jsonpath='{.data.status\.md}'"
```

## Getting it to the shared box

The shared agent box reaches the LAN only through Jim's Mac (jminim4), which already has `ssh deby`. The simplest path is a box routine at ~04:50 ET that runs the command above on the Mac and saves the output to `/workspace/handoffs/infra-YYYY-MM-DD.md`, beside the GitHub digest News-Guy already reads. No new Ingress, port, or credential is needed.

Run once by hand to test:

```bash
kubectl -n monitoring create job --from=cronjob/briefing-status briefing-status-manual
kubectl -n monitoring logs job/briefing-status-manual
```
