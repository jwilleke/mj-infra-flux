# Flux image automation

ImageRepository, ImagePolicy, and ImageUpdateAutomation objects live here, all in `flux-system`. New image tags are committed to `master` only during the weekly maintenance window (Saturday 22:00 to Sunday 02:00, America/New_York).

`image-automation-window.yaml` is the gate (homelab#118):

- A bootstrap Job suspends every ImageUpdateAutomation as soon as Flux applies this directory.
- CronJobs unsuspend at Saturday 22:00 and suspend at Sunday 02:00 (`timeZone: America/New_York`).
- A guard CronJob every 30 minutes re-applies that desired state, so a missed Sunday job cannot leave automations pushing all week.

`spec.suspend` is intentionally omitted from the ImageUpdateAutomation manifests. If it were set in Git, Flux would overwrite the live patch on the next reconcile. See the comment at the top of `image-automation-window.yaml`.

The yourphr ImagePolicy is capped at `>=3.0.0 <4.0.0`. Raise the ceiling in Git after a 4.x release is approved.
