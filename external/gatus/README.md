# Gatus on jims-test-instance

Off-site watcher for the __public__ nerdsbythehour / yourphr / geohazardwatch
sites. It runs on the GCP VM `jims-test-instance` (Ubuntu, `ssh jim@136.118.119.145`).
Internal services stay watched from inside the LAN. This directory is __not__
Flux-reconciled.

Alerts go by email from Gatus itself, through Resend SMTP, to
`mjsservers@willeke.com`. They do __not__ go through Alertmanager or
Prometheus. `/metrics` is left off, and the web UI listens only on
`127.0.0.1:8080`.

The From address is `alerts@nerdsbythehour.com`, the same verified Resend
sender Alertmanager uses. `deby@nerdsbythehour.com` is reserved for deby's
host-local exim4 path so you can tell which transport delivered a given
message.

## Install (already done for v5.38.0)

GitHub Releases for [TwiN/gatus](https://github.com/TwiN/gatus/releases) do
not attach binaries or checksum files (confirmed for v5.38.0 and earlier).
The published artifact is the container image. The binary on the VM was
built from the official tag after verifying the commit:

```bash
# expected tag commit for v5.38.0
# d255d0cd4d69ce818574cfdb3a7e82407e6559d7
git clone --depth 1 --branch v5.38.0 https://github.com/TwiN/gatus.git
cd gatus
test "$(git rev-parse HEAD)" = "d255d0cd4d69ce818574cfdb3a7e82407e6559d7"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o gatus .
sha256sum gatus
```

The v5.38.0 linux/amd64 binary installed on the VM has SHA-256
`10dc5c773e11106a27c347f9796d75d7f037c106bb9e763345267683c7808181`.

The official linux/amd64 image, if you prefer to extract a binary instead of
building, is:

```
ghcr.io/twin/gatus:v5.38.0@sha256:20f9ae4963ea074521b8da7f438c797d571a58dc51b24abd08d218a6e17b0aca
```

That image digest will not match the SHA-256 above (different build). Either
path is a verified v5.38.0 artifact.

Then, as root on the VM:

```bash
install -m 0755 -o root -g root gatus /usr/local/bin/gatus
useradd --system --user-group --home-dir /var/lib/gatus --shell /usr/sbin/nologin gatus
install -d -m 0755 /etc/gatus
install -d -m 0750 -o gatus -g gatus /var/lib/gatus
install -m 0644 config.yaml /etc/gatus/config.yaml
install -m 0600 -o root -g root gatus.env.example /etc/gatus/gatus.env
# edit /etc/gatus/gatus.env and put the Resend key in GATUS_SMTP_PASSWORD
install -m 0644 gatus.service /etc/systemd/system/gatus.service
systemctl daemon-reload
systemctl enable --now gatus
```

Do not open a firewall or UFW port, and do not run this in Docker. The e2-micro
has 1 GB of RAM and no Docker runtime.

## Maintenance window

`config.yaml` mutes all Gatus emails Saturday 22:00 to Sunday 02:00
America/New_York (`maintenance.start: "22:00"`, `duration: 4h`,
`every: [Saturday]`, `timezone: America/New_York`). That matches the
Alertmanager window in [jwilleke/homelab `docs/maintenance/maintenance-window.md`](https://github.com/jwilleke/homelab/blob/master/docs/maintenance/maintenance-window.md).
Because this directory is not Flux-reconciled, copy the updated
`config.yaml` to `/etc/gatus/config.yaml` on the VM and run
`sudo systemctl restart gatus` for the mute to take effect.

## Update

Repeat the build (or image extract) for the new tag, verify the tag commit or
image digest, install the new `/usr/local/bin/gatus`, and
`sudo systemctl restart gatus`. Keep the existing `/etc/gatus/config.yaml`,
`/etc/gatus/gatus.env`, and `/var/lib/gatus/data.db` unless the release notes
require a config change.

## SSH tunnel to the UI

The UI is bound to localhost only:

```bash
ssh -L 8080:127.0.0.1:8080 jim@136.118.119.145
```

Then open <http://127.0.0.1:8080>. Status JSON is at
<http://127.0.0.1:8080/api/v1/endpoints/statuses>.

## Enter the Resend SMTP key

Gatus starts with a placeholder password. Email provider validation does not
require a real key, so alerting is already configured and enabled in
`config.yaml`. Until the placeholder is replaced, a triggered alert will fail
to send (Resend will reject the login). No key is stored in git.

1. Create a Resend API key yourself. Do not paste it into chat.
2. Store it in OpenBao at `kv/hosts/gcp-watcher/gatus`, key `smtp-password`.
3. On the VM, edit `/etc/gatus/gatus.env` (mode 600, root:root) and set:

   ```
   GATUS_SMTP_PASSWORD=the-key-from-openbao
   ```

4. Restart:

   ```bash
   sudo systemctl restart gatus
   sudo systemctl status gatus --no-pager
   ```

Username is `resend`, host `smtp.resend.com`, port 465 (implicit TLS), From
`alerts@nerdsbythehour.com`, To `mjsservers@willeke.com`. Alerts fire after 3
failures in a row and send a resolved notice after 2 successes.

## relay-ha note

`/healthz` returns `200` and body `ok` from the public internet, so that is
the check. The Flux comment in `apps/production/relay-ha/configmap.yaml` says
this liveness path is kept off the public route, but the Cloudflare tunnel
forwards the whole hostname to the service. Root `/` correctly returns 404.
The Tesla public-key path
`/.well-known/appspecific/com.tesla.3p.public-key.pem` also returns 200.
