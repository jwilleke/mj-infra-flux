# OwnTracks

OwnTracks Recorder for phone-location telemetry. Receives HTTP POSTs from the OwnTracks mobile app, stores tracks to disk (LMDB), and republishes received locations onto the shared MQTT bus under `owntracks/<user>/<device>` so consumers like Home Assistant can subscribe. The HTTP→MQTT republish is *not* native recorder behaviour — it's done by the small Lua hook in `recorder-lua-hook-configmap.yaml`, with a loop guard wired into the recorder configmap (see "MQTT republish via Lua hook" below).

- __URL (public + LAN):__ `https://owntracks.nerdsbythehour.com`
- __Backend service:__ `owntracks-recorder.owntracks.svc.cluster.local:8083`
- __Public path:__ Cloudflare Tunnel → connector pods in `cloudflared/` → Traefik → this service. Traefik `basicAuth` middleware (`owntracks-basic-auth`, this app dir) gates all paths with per-user credentials from the `owntracks-basic-auth` Secret. No Cloudflare Access in the path — Cloudflare provides edge TLS + DDoS only.
- __MQTT broker:__ `mosquitto.messaging.svc.cluster.local:1883` (anonymous; see `apps/production/messaging/`)
- __Topic prefix:__ `owntracks/#`
- __Persistent store:__ PV `owntracks-store-pv`, hostPath `/mnt/local-k3s-data/owntracks/store` (5 Gi, Retain)

## Architecture

```text
Phones (LAN + off-LAN)              Browser (anywhere)
       │                                    │
       └─────────► Cloudflare Edge ◄────────┘
                        │ (edge TLS only)
                        ▼ outbound tunnel (existing connectors)
                cloudflared (apps/production/cloudflared/)
                        │
                        ▼ HTTP, Host: owntracks.nerdsbythehour.com
                traefik.kube-system.svc.cluster.local:80
                        │  (basicAuth middleware: owntracks-basic-auth)
                        │  401 unless Authorization: Basic <user:pass>
                        ▼ HTTP
            owntracks-recorder.owntracks.svc.cluster.local:8083
                        │
                        ├──► PVC: /store  (LMDB tracks)
                        └──► Lua otr_hook (recorder-lua-hook-configmap.yaml)
                                 if data._http and _type == "location"
                                       │
                                       ▼ otr.publish(topic, payload, qos=1, retain=true)
                          mosquitto.messaging.svc.cluster.local:1883
                                       ▲
                                       │ subscribes owntracks/#
                                       │
                          Home Assistant @ 192.168.68.20 (LAN)

The recorder itself subscribes to `none/#`, not `owntracks/#` — that's the
loop guard (see "MQTT republish via Lua hook" below). It still receives
HTTP arrivals normally; OTR_TOPICS has no bearing on the HTTP path.
```

The recorder's own built-in viewer is at `/view/`; the standalone OwnTracks Frontend (a separate React app) is not deployed here — add later if the built-in viewer isn't enough.

## MQTT republish via Lua hook

The upstream OwnTracks Recorder does __not__ republish HTTP-arrived messages onto MQTT — upstream `doc/HOOKS.md` calls this out explicitly and suggests a Lua hook as the workaround. We do that here:

- `recorder-lua-hook-configmap.yaml` ships a small self-contained hook (`hook.lua`) with an inline JSON encoder. On every received message the hook checks `data._http` (recorder-set flag indicating HTTP origin); if set and `_type == "location"`, it re-emits the payload via `otr.publish(topic, payload, 1, true)` — same `owntracks/<user>/<device>` topic, QoS 1, `retain=true` so new MQTT subscribers (Home Assistant on (re)start) immediately see last-known position.
- The hook ships as a ConfigMap mounted read-only at `/lua/hook.lua`; the recorder finds it via `OTR_LUASCRIPT: /lua/hook.lua` in `recorder-configmap.yaml`.
- __Loop guard:__ the recorder is configured with `OTR_TOPICS: none/#` (not `owntracks/#`). Otherwise the recorder would receive its own publish back through its MQTT subscription, fire the hook again on the MQTT-arrived copy, store a duplicate, and (since `data._http` is false on MQTT arrivals) only avoid the publish-side loop by accident. Setting `OTR_TOPICS=none/#` removes the entire risk: the recorder still receives HTTP arrivals normally, but does not subscribe to its own publishes. Verified at startup via `+ Subscribing to none/# (qos=2)` in the pod log.
- __Verify:__ `kubectl -n owntracks logs deploy/owntracks-recorder -f` and watch for `otr_publish(owntracks/<user>/<device>, {...}, 1, 0) == 0` after each HTTP `/pub`. The trailing `== 0` is libmosquitto's success code.

If you need to disable the republish (e.g. to debug the HTTP path in isolation), delete the `OTR_LUASCRIPT` line from `recorder-configmap.yaml` and Flux-reconcile; the recorder will skip Lua entirely. The ConfigMap can stay mounted.

## Out-of-band setup (one-time)

These steps live outside this repo and have to be done manually:

1. __Cloudflare Zero Trust → Tunnels → `<existing tunnel>` → Public Hostnames → Add:__
   - Subdomain: `owntracks`
   - Domain: `nerdsbythehour.com`
   - Type: `HTTP`
   - URL: `traefik.kube-system.svc.cluster.local:80`
   - HTTP Settings → HTTP Host Header: `owntracks.nerdsbythehour.com`
   - Confirm there is __no Cloudflare Access application__ attached to this hostname — auth lives in Traefik, not at the edge.
2. __Remove any pre-existing redirect or page rule for `owntracks.nerdsbythehour.com`.__ Before this change the hostname 301-redirected to `deby.nerdsbythehour.com/pub`; that redirect (Page Rule / Bulk Redirect / Worker) must be deleted or it will shadow the new tunnel route.
3. __Rotate the basic-auth credentials in `recorder-basic-auth.sops.yaml` when a phone is lost:__ generate a new bcrypt hash with `htpasswd -nbB <user> <new-pass>`, replace the line for that user inside the (decrypted) Secret, re-encrypt with `sops`, commit. Flux rolls the Secret; Traefik picks up the new hash immediately. The plaintext goes into the password manager and onto the remaining phones.
4. __OwnTracks mobile app__ (per phone) — Mode: HTTP. URL: `https://owntracks.nerdsbythehour.com/pub`. Username = `jim` or `molly` (matches the bcrypt line). Password = the corresponding plaintext from the password manager. Set a unique Device ID per phone.
5. __Home Assistant @ 192.168.68.20__ — Enable the __OwnTracks__ integration (subscribes to `owntracks/#` on the existing MQTT integration; no extra wiring needed beyond having the MQTT integration already pointed at `deby.nerdsbythehour.com:1883`).

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

Tag is set by Flux image-automation (`apps/production/image-automation/owntracks-policy.yaml`) — ImagePolicy semver range `>=1.0.0 <2.0.0`. Manifest-side marker is `# {"$imagepolicy": "flux-system:owntracks-recorder"}` on the `image:` line of `recorder-deployment.yaml`; the controller scans every hour and pushes a `chore(image-automation): bump owntracks-recorder to <tag>` commit when a newer in-range tag appears. To pin manually (e.g. to roll back), remove the marker comment and set the tag by hand. OwnTracks also publishes `1.0.1-43`-style tags; those are treated as semver pre-releases and excluded automatically.

## Operations summary

*Moved from homelab `network/apps/owntracks.md` (last changed 2026-11-16) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

### What it is and does

OwnTracks Recorder receives location updates from family phones (OwnTracks
app, HTTP mode) and stores them. A small Lua hook republishes each location to
MQTT, so Home Assistant can track who is home.

### Access

| Item | Value |
| --- | --- |
| URL | <https://owntracks.nerdsbythehour.com> (phones post to `/pub`) |
| Reach | Meant to be public through Cloudflare Tunnel → Traefik, and LAN. Public DNS pointed at the LAN address on 2026-11-23; see "For users" below |
| Sign-in | Traefik basic auth, one user per person |

### Where it runs / where data lives

deby, namespace `owntracks`, Deployment `owntracks-recorder` (1.0.4,
image-automated). Store on hostPath `/mnt/local-k3s-data/owntracks/store`,
included in the deby-backup rsync.

### Secrets

| Secret | Where |
| --- | --- |
| Basic auth users | OpenBao `apps/owntracks/owntracks-basic-auth` → Secret `owntracks/owntracks-basic-auth` |
| Phone passwords | Password manager |

### Dependencies

[cloudflared](../cloudflared/README.md), Traefik, [Mosquitto](../messaging/README.md), Home Assistant bridge.

### Recovery

(a) Pod broken:

```bash
kubectl -n owntracks rollout restart deploy/owntracks-recorder
```

(b) Data lost: copy back
`/deby-backup/host/daily/latest/rootfs/mnt/local-k3s-data/owntracks/store/`.

(c) deby rebuilt: restore `/mnt/local-k3s-data`, Flux redeploys.

### Health checks

```bash
curl -o /dev/null -w "%{http_code}\n" https://owntracks.nerdsbythehour.com/   # 401 without login
mosquitto_sub -h mqtt.nerdsbythehour.com -t 'owntracks/#' -C 1 -W 30 -v
```

### Known gaps

- Public endpoint protected only by basic auth.

## For users: OwnTracks — owntracks.nerdsbythehour.com

*Moved from homelab `docs/services-provided/owntracks.md` (last changed 2026-08-17) for [homelab#87](https://github.com/jwilleke/homelab/issues/87).*

Phone location tracking. The OwnTracks mobile app sends location updates over HTTPS; the Recorder stores tracks and republishes them to the MQTT broker so Home Assistant can display device positions in real time.

### How to reach it

__URL:__ <https://owntracks.nerdsbythehour.com>

Designed to be reachable from anywhere through the Cloudflare Tunnel. __Contradiction found 2026-11-23:__ public DNS (`dig @1.1.1.1`) returns `deby.nerdsbythehour.com` → `192.168.68.71` for this name, not Cloudflare, so off-LAN phones may not reach it. Check the tunnel route and the DNS record in Cloudflare.

### Authentication

__HTTP Basic Auth__ — username and password per device, set at app configuration time. This is Traefik-layer auth, independent of Authentik.

| User | Notes |
|---|---|
| `jim` | Jim's devices |
| `molly` | Molly's devices |

Credentials are stored in the `owntracks-basic-auth` Secret (SOPS-encrypted in `mj-infra-flux`). Plaintext lives in the password manager.

### Mobile app setup

1. Install the [OwnTracks app](https://owntracks.org) (iOS or Android).
2. Settings → Mode: __HTTP__.
3. URL: `https://owntracks.nerdsbythehour.com/pub`
4. Username: your username (see above). Password: from the password manager.
5. Device ID: set a unique name per phone (e.g. `phonejsw`).

### What the Recorder does

- Stores incoming locations to a persistent LMDB database.
- Republishes each HTTP-arrived location to the MQTT broker under `owntracks/<user>/<device>` via a Lua hook — this is what Home Assistant subscribes to.
- Built-in track viewer is at `https://owntracks.nerdsbythehour.com/view/`.

### MQTT topic

`owntracks/#` — subscribed to by Home Assistant (`192.168.68.20`).

### Operator reference

[`mj-infra-flux/apps/production/owntracks/README.md`](README.md)
