# OwnTracks

OwnTracks Recorder for phone-location telemetry. Receives HTTP POSTs from the OwnTracks mobile app, stores tracks to disk (LMDB), and republishes received locations onto the shared MQTT bus under `owntracks/<user>/<device>` so consumers like Home Assistant can subscribe.

- **URL (public + LAN):** `https://owntracks.nerdsbythehour.com`
- **Backend service:** `owntracks-recorder.owntracks.svc.cluster.local:8083`
- **Public path:** Cloudflare Tunnel → connector pods in `cloudflared/` → this service. Bypasses Traefik. Cloudflare Access policy gates `/pub` with a service-token and everything else with interactive SSO.
- **MQTT broker:** `mosquitto.messaging.svc.cluster.local:1883` (anonymous; see `apps/production/messaging/`)
- **Topic prefix:** `owntracks/#`
- **Persistent store:** PV `owntracks-store-pv`, hostPath `/mnt/local-k3s-data/owntracks/store` (5 Gi, Retain)

## Architecture

```text
Phones (LAN + off-LAN)              Browser (anywhere)
       │                                    │
       └─────────► Cloudflare Edge ◄────────┘
                        │
       (Cloudflare Access:
          /pub  → service token       (phones)
          else  → interactive SSO     (browser viewers))
                        │
                        ▼ outbound tunnel (existing connectors)
                cloudflared (apps/production/cloudflared/)
                        │
                        ▼ HTTP
            owntracks-recorder.owntracks.svc.cluster.local:8083
                        │
                        ├──► PVC: /store  (LMDB tracks)
                        └──► MQTT publish: owntracks/<user>/<device>
                                       │
                                       ▼
                          mosquitto.messaging.svc.cluster.local:1883
                                       ▲
                                       │ subscribes owntracks/#
                                       │
                          Home Assistant @ 192.168.68.20 (LAN)
```

The recorder's own built-in viewer is at `/view/`; the standalone OwnTracks Frontend (a separate React app) is not deployed here — add later if the built-in viewer isn't enough.

## Out-of-band setup (one-time)

These steps live outside this repo and have to be done manually:

1. **Cloudflare Zero Trust → Tunnels → `<existing tunnel>` → Public Hostnames → Add:**
   - Subdomain: `owntracks`
   - Domain: `nerdsbythehour.com`
   - Type: `HTTP`
   - URL: `owntracks-recorder.owntracks.svc.cluster.local:8083`
2. **Cloudflare Zero Trust → Access → Service Auth → Service Tokens → Create:** name it `owntracks-mobile`. Save the Client ID + Client Secret — needed once per phone.
3. **Cloudflare Zero Trust → Access → Applications → Add application → Self-hosted:**
   - Application domain: `owntracks.nerdsbythehour.com`
   - Add two policies:
     - **Phone publish** — Action: Service Auth. Include: Service Token = `owntracks-mobile`. Path: `/pub`.
     - **Browser view** — Action: Allow. Include: Emails = `jim@willeke.com` (or your IdP group). Path: everything else.
4. **OwnTracks mobile app** (per phone) — Mode: HTTP. URL: `https://owntracks.nerdsbythehour.com/pub`. Add custom headers `CF-Access-Client-Id` and `CF-Access-Client-Secret` from step 2. Set a unique Device ID per phone.
5. **Home Assistant @ 192.168.68.20** — Enable the **OwnTracks** integration (subscribes to `owntracks/#` on the existing MQTT integration; no extra wiring needed beyond having the MQTT integration already pointed at `deby.nerdsbythehour.com:1883`).

## Topic isolation

The shared broker has no ACLs; topic separation is by convention. The recorder publishes only under `owntracks/`. See `~/thishost/docs/mqtt.md` for the full tenant table.

## Operating

```bash
kubectl -n owntracks get pods
kubectl -n owntracks logs deploy/owntracks-recorder -f

# Quick smoke test from inside the cluster
kubectl -n owntracks run -it --rm curl --image=curlimages/curl --restart=Never -- \
  curl -s http://owntracks-recorder:8083/api/0/version
```

To verify end-to-end after a phone publishes, watch MQTT:

```bash
kubectl run -it --rm mqtt-sub --image=eclipse-mosquitto:2 --restart=Never -- \
  mosquitto_sub -h mosquitto.messaging.svc.cluster.local -t 'owntracks/#' -v
```

## Image

Pinned to `owntracks/recorder:0.9.10`. Image-automation is not wired up for this app yet; bump the tag in `recorder-deployment.yaml` and let Flux roll.
