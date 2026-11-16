# unifi-mcp

UniFi Network MCP server from [sirkirby/unifi-mcp](https://github.com/sirkirby/unifi-mcp)
(`apps/network`). It lets Jim's assistants list clients, devices and settings on the
Dream Machine Pro. It starts read-only.

## URL

- MCP endpoint: `https://unifi-mcp.nerdsbythehour.com/mcp` (Streamable HTTP)
- Header on every request: `Authorization: Bearer <mcp-auth-token>`
- LAN/VPN only: Traefik `lan-only` middleware (192.168.68.0/24, 192.168.11.0/24).
  Other sources get 403. There is no Cloudflare Tunnel hostname.
- A wrong `Host` header gets 421 (upstream DNS-rebinding protection), and no
  token gets 401.

DNS: a UniFi local DNS record is required; there is no wildcard and no public
record. `unifi-mcp.nerdsbythehour.com` is a CNAME to `deby.nerdsbythehour.com`
(192.168.68.71), the same as `stuff` and `auth`. It was added on 2026-11-16 in
UniFi Network (Settings, Policy Engine, DNS: Create Entry, type CNAME), or through
the Integration API with
`POST /proxy/network/integration/v1/sites/<site-id>/dns/policies` and body
`{"type":"CNAME_RECORD","enabled":true,"domain":"unifi-mcp.nerdsbythehour.com","targetDomain":"deby.nerdsbythehour.com","ttlSeconds":0}`.
cert-manager issues the certificate by DNS-01, so it needs no record.

## Image

`ghcr.io/sirkirby/unifi-network-mcp:0.46.0` (git tag `network/v0.46.0`), public
GHCR, amd64 and arm64. Flux image automation bumps patch releases only
(`apps/production/image-automation/unifi-mcp-policy.yaml`). Widen the range by
hand after reading the upstream changelog.

## Data paths

None. The server is stateless; `/tmp` is an `emptyDir`.

## Dependencies

- OpenBao and the `openbao` ClusterSecretStore (credentials)
- cert-manager `letsencrypt-production` (certificate)
- The UniFi console at `net.nerdsbythehour.com`, pinned to 192.168.68.1 by
  `hostAliases`

## Configuration

All settings are upstream's documented env vars, set in `deployment.yaml`.

### Controller host, TLS and site

- Host: `net.nerdsbythehour.com`, pinned to 192.168.68.1 in the pod. DNS returns
  three gateway interfaces (192.168.68.1, 192.168.20.1, 192.168.101.1) plus an
  AAAA record, so the pin keeps the pod on the LAN interface.
- TLS: `UNIFI_NETWORK_VERIFY_SSL=true`. The console serves a Let's Encrypt
  `*.nerdsbythehour.com` certificate on 192.168.68.1:443 (checked 2026-11-16),
  so it verifies by name. If the console ever falls back to its self-signed
  certificate, the pod fails to connect. Fix the certificate, or set
  `UNIFI_NETWORK_SSL_FINGERPRINT` (a pin breaks on every renewal) or
  `UNIFI_NETWORK_VERIFY_SSL=false`.
- Site: `default`. Legacy `/api/s/<site>` calls need the site's short name, not
  its display name (`butler`) or its Integration API UUID. The first site on a
  console is always `default`. Integration API tools resolve the configured value
  to the UUID themselves, and fall back to the only site when there is one.

### Read-only, and how to enable writes

Writes are refused on the server by policy gates, whatever the client asks:

```yaml
- name: UNIFI_POLICY_NETWORK_CREATE
  value: "false"
- name: UNIFI_POLICY_NETWORK_UPDATE
  value: "false"
- name: UNIFI_POLICY_NETWORK_DELETE
  value: "false"
```

`UNIFI_NETWORK_TOOL_PERMISSION_MODE=confirm` keeps preview-then-confirm on
anything a gate allows. Never set it to `bypass`.

To allow client renames and fixed IPs only (after Jim's OK), add this to the
container `env` in `deployment.yaml`. The most specific rule wins, so the three
`false` gates still hold for everything else:

```yaml
- name: UNIFI_POLICY_NETWORK_CLIENTS_UPDATE
  value: "true"
```

The `clients` category also covers block, unblock, reconnect, forget, guest
authorize and fixed-AP.

## Secrets

OpenBao KV v2, mount `kv`, path `apps/unifi-mcp/unifi-mcp` (full CLI path
`kv/apps/unifi-mcp/unifi-mcp`). The ExternalSecret `unifi-mcp` syncs it into
Secret `unifi-mcp` in namespace `unifi-mcp`.

| Key | Value |
| --- | --- |
| `username` | Dedicated local-only UniFi admin (no 2FA) |
| `password` | That admin's password |
| `api-key` | UniFi API key (Settings, Control Plane, Integrations). Optional |
| `mcp-auth-token` | Bearer token for the MCP endpoint, at least 32 printable characters, no spaces |

Generate the token on the Mac:

```bash
openssl rand -hex 32
```

UI: open `https://stuff.nerdsbythehour.com`, sign in with OIDC (role `mj`), open
the `kv` secrets engine, select Create secret, set the path to
`apps/unifi-mcp/unifi-mcp`, add the four keys above, and save.

CLI alternative (the leading space keeps it out of zsh history when
`HIST_IGNORE_SPACE` is set):

```bash
export BAO_ADDR=https://stuff.nerdsbythehour.com
bao login -method=oidc role=mj
 bao kv put -mount=kv apps/unifi-mcp/unifi-mcp username='REPLACE_WITH_UNIFI_USERNAME' password='REPLACE_WITH_UNIFI_PASSWORD' api-key='REPLACE_WITH_UNIFI_API_KEY' mcp-auth-token='REPLACE_WITH_OUTPUT_OF_openssl_rand_hex_32'
```

ESO refreshes hourly. To pick up a change now, then restart the pod (env vars are
read only at start):

```bash
ssh deby 'sudo -n k3s kubectl annotate externalsecret unifi-mcp -n unifi-mcp force-sync=$(date +%s) --overwrite'
ssh deby 'sudo -n k3s kubectl rollout restart deployment/unifi-mcp -n unifi-mcp'
```

## Deployment

Flux applies `apps/production/unifi-mcp` from `master`. Load the OpenBao secret
first: until the Secret exists the pod waits in `CreateContainerConfigError`.

## Troubleshooting

- `CreateContainerConfigError`: the Secret is missing. Check
  `ssh deby 'sudo -n k3s kubectl get externalsecret unifi-mcp -n unifi-mcp'`.
- Crash at start, exit 6 or "auth token": `mcp-auth-token` is empty or shorter
  than 32 characters.
- 401: missing or wrong bearer token. 403: client not on the LAN/VPN. 421: the
  `Host` header is not `unifi-mcp.nerdsbythehour.com`.
- TLS or certificate error to the controller: see "Controller host, TLS and site".
- A tool reports a denied policy gate: expected while read-only. The error names
  the variable that would allow it.
