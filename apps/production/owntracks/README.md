# OwnTracks

OwnTracks Recorder for phone-location telemetry. Receives HTTP POSTs from the OwnTracks mobile app, stores tracks to disk (LMDB), and republishes received locations onto the shared MQTT bus under `owntracks/<user>/<device>` so consumers like Home Assistant can subscribe. The HTTP→MQTT republish is *not* native recorder behaviour — it's done by the small Lua hook in `recorder-lua-hook-configmap.yaml`, with a loop guard wired into the recorder configmap (see "MQTT republish via Lua hook" below).

- **URL (public + LAN):** `https://owntracks.nerdsbythehour.com`
- **Backend service:** `owntracks-recorder.owntracks.svc.cluster.local:8083`
- **Public path:** Cloudflare Tunnel → connector pods in `cloudflared/` → Traefik → this service. Traefik `basicAuth` middleware (`owntracks-basic-auth`, this app dir) gates all paths with per-user credentials from the `owntracks-basic-auth` Secret. No Cloudflare Access in the path — Cloudflare provides edge TLS + DDoS only.
- **MQTT broker:** `mosquitto.messaging.svc.cluster.local:1883` (anonymous; see `apps/production/messaging/`)
- **Topic prefix:** `owntracks/#`
- **Persistent store:** PV `owntracks-store-pv`, hostPath `/mnt/local-k3s-data/owntracks/store` (5 Gi, Retain)

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

The upstream OwnTracks Recorder does **not** republish HTTP-arrived messages onto MQTT — upstream `doc/HOOKS.md` calls this out explicitly and suggests a Lua hook as the workaround. We do that here:

- `recorder-lua-hook-configmap.yaml` ships a small self-contained hook (`hook.lua`) with an inline JSON encoder. On every received message the hook checks `data._http` (recorder-set flag indicating HTTP origin); if set and `_type == "location"`, it re-emits the payload via `otr.publish(topic, payload, 1, true)` — same `owntracks/<user>/<device>` topic, QoS 1, `retain=true` so new MQTT subscribers (Home Assistant on (re)start) immediately see last-known position.
- The hook ships as a ConfigMap mounted read-only at `/lua/hook.lua`; the recorder finds it via `OTR_LUASCRIPT: /lua/hook.lua` in `recorder-configmap.yaml`.
- **Loop guard:** the recorder is configured with `OTR_TOPICS: none/#` (not `owntracks/#`). Otherwise the recorder would receive its own publish back through its MQTT subscription, fire the hook again on the MQTT-arrived copy, store a duplicate, and (since `data._http` is false on MQTT arrivals) only avoid the publish-side loop by accident. Setting `OTR_TOPICS=none/#` removes the entire risk: the recorder still receives HTTP arrivals normally, but does not subscribe to its own publishes. Verified at startup via `+ Subscribing to none/# (qos=2)` in the pod log.
- **Verify:** `kubectl -n owntracks logs deploy/owntracks-recorder -f` and watch for `otr_publish(owntracks/<user>/<device>, {...}, 1, 0) == 0` after each HTTP `/pub`. The trailing `== 0` is libmosquitto's success code.

If you need to disable the republish (e.g. to debug the HTTP path in isolation), delete the `OTR_LUASCRIPT` line from `recorder-configmap.yaml` and Flux-reconcile; the recorder will skip Lua entirely. The ConfigMap can stay mounted.

## Out-of-band setup (one-time)

These steps live outside this repo and have to be done manually:

1. **Cloudflare Zero Trust → Tunnels → `<existing tunnel>` → Public Hostnames → Add:**
   - Subdomain: `owntracks`
   - Domain: `nerdsbythehour.com`
   - Type: `HTTP`
   - URL: `traefik.kube-system.svc.cluster.local:80`
   - HTTP Settings → HTTP Host Header: `owntracks.nerdsbythehour.com`
   - Confirm there is **no Cloudflare Access application** attached to this hostname — auth lives in Traefik, not at the edge.
2. **Remove any pre-existing redirect or page rule for `owntracks.nerdsbythehour.com`.** Before this change the hostname 301-redirected to `deby.nerdsbythehour.com/pub`; that redirect (Page Rule / Bulk Redirect / Worker) must be deleted or it will shadow the new tunnel route.
3. **Rotate the basic-auth credentials in `recorder-basic-auth.sops.yaml` when a phone is lost:** generate a new bcrypt hash with `htpasswd -nbB <user> <new-pass>`, replace the line for that user inside the (decrypted) Secret, re-encrypt with `sops`, commit. Flux rolls the Secret; Traefik picks up the new hash immediately. The plaintext goes into the password manager and onto the remaining phones.
4. **OwnTracks mobile app** (per phone) — Mode: HTTP. URL: `https://owntracks.nerdsbythehour.com/pub`. Username = `jim` or `molly` (matches the bcrypt line). Password = the corresponding plaintext from the password manager. Set a unique Device ID per phone.
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

Tag is set by Flux image-automation (`apps/production/image-automation/owntracks-policy.yaml`) — ImagePolicy semver range `>=1.0.0 <2.0.0`. Manifest-side marker is `# {"$imagepolicy": "flux-system:owntracks-recorder"}` on the `image:` line of `recorder-deployment.yaml`; the controller scans every hour and pushes a `chore(image-automation): bump owntracks-recorder to <tag>` commit when a newer in-range tag appears. To pin manually (e.g. to roll back), remove the marker comment and set the tag by hand. OwnTracks also publishes `1.0.1-43`-style tags; those are treated as semver pre-releases and excluded automatically.
