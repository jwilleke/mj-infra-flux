#!/usr/bin/env bash
# One-time OpenBao init for deby, then load of every secret ESO will sync.
#
# Run from a workstation with cluster-admin kubectl, AFTER Flux has applied
# infrastructure/prod/openbao and Secret openbao/openbao-unseal-key exists.
# See infrastructure/prod/openbao/README.md for the order. Do not run this
# until Phase 1 is up and before Phase 2 prunes the old Secrets.
#
# Nothing this script creates is written into the git tree. Secret values are
# not printed, except the recovery key from a first init (that is the
# break-glass record) and prompts you type yourself.
set -euo pipefail
umask 077

if [[ ! -t 0 ]]; then
  echo "Run this in a terminal. It prompts for the Authentik client and for root-token revocation." >&2
  exit 1
fi

NS=openbao
REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

bao() {
  if [[ -n "${BAO_TOKEN:-}" ]]; then
    kubectl -n "$NS" exec -i openbao-0 -- env BAO_TOKEN="$BAO_TOKEN" bao "$@"
  else
    kubectl -n "$NS" exec -i openbao-0 -- bao "$@"
  fi
}

# kv put echoes values. Drop stdout. Failures still show on stderr.
kv_put_json() {
  local path="$1" file="$2"
  kubectl -n "$NS" exec -i openbao-0 -- sh -c 'cat > /tmp/bao-payload.json && chmod 600 /tmp/bao-payload.json' < "$file"
  bao kv put "$path" @/tmp/bao-payload.json >/dev/null
  kubectl -n "$NS" exec openbao-0 -- rm -f /tmp/bao-payload.json
}

kv_exists() {
  local path="$1"
  bao kv get -format=json "$path" >/dev/null 2>&1
}

echo "Waiting for openbao-0 to answer (sealed is fine, missing pod is not)..."
kubectl -n "$NS" rollout status statefulset/openbao --timeout=180s

status_file="$TMP/status.json"
set +e
bao status -format=json >"$status_file"
status_rc=$?
set -e
# 0 unsealed, 2 sealed or uninitialized. Anything else is a real error.
if [[ "$status_rc" -ne 0 && "$status_rc" -ne 2 ]]; then
  echo "bao status failed (exit $status_rc)" >&2
  cat "$status_file" >&2
  exit 1
fi

initialized=$(jq -r '.initialized' "$status_file")
if [[ "$initialized" != "true" ]]; then
  echo "Initializing (recovery-shares=1). Copy the recovery key into the break-glass record now."
  bao operator init -recovery-shares=1 -recovery-threshold=1 -format=json >"$TMP/init.json"
  echo "----- recovery key (one line, store it offline, then it is shredded here) -----"
  jq -r '.recovery_keys_b64[0]' "$TMP/init.json"
  echo "----- end recovery key -----"
  BAO_TOKEN=$(jq -r '.root_token' "$TMP/init.json")
  rm -f "$TMP/init.json"
  echo "Root token is only in this process. It will be revoked after OIDC if you say so."
else
  echo "Already initialized."
  if [[ -z "${BAO_TOKEN:-}" ]]; then
    echo "Export BAO_TOKEN to a root or admin token and re-run. Do not paste it into git." >&2
    exit 1
  fi
fi

if ! bao secrets list -format=json | jq -e '."kv/"' >/dev/null; then
  bao secrets enable -path=kv kv-v2 >/dev/null
fi

if ! bao auth list -format=json | jq -e '."kubernetes/"' >/dev/null; then
  bao auth enable kubernetes >/dev/null
fi

# Reviewer JWT is left unset on purpose: OpenBao uses the pod ServiceAccount
# token (system:auth-delegator) and re-reads it. A JWT baked into this config
# would expire. disable_iss_validation covers k3s issuer mismatch.
kubectl -n "$NS" exec openbao-0 -- sh -c \
  "bao write auth/kubernetes/config kubernetes_host=https://kubernetes.default.svc:443 kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt disable_iss_validation=true" \
  >/dev/null

bao policy write external-secrets-read - <<'P' >/dev/null
path "kv/data/deby/*"     { capabilities = ["read"] }
path "kv/metadata/deby/*" { capabilities = ["read", "list"] }
P

bao policy write raft-snapshot - <<'P' >/dev/null
path "sys/storage/raft/snapshot" { capabilities = ["read"] }
P

bao policy write admin - <<'P' >/dev/null
path "*" { capabilities = ["create", "read", "update", "delete", "list", "sudo"] }
P

bao write auth/kubernetes/role/external-secrets \
  bound_service_account_names=external-secrets \
  bound_service_account_namespaces=external-secrets \
  policies=external-secrets-read ttl=1h >/dev/null

bao write auth/kubernetes/role/raft-snapshot \
  bound_service_account_names=openbao-snapshot \
  bound_service_account_namespaces=openbao \
  policies=raft-snapshot ttl=10m >/dev/null

if ! bao auth list -format=json | jq -e '."oidc/"' >/dev/null; then
  echo "Create an Authentik OAuth2/OIDC provider with slug openbao first."
  echo "Redirect URIs:"
  echo "  https://stuff.nerdsbythehour.com/ui/vault/auth/oidc/oidc/callback"
  echo "  http://localhost:8250/oidc/callback"
  echo "Scope must include groups. The mj group is the bound claim."
  read -rp "Authentik client_id: " CID
  read -rsp "Authentik client_secret: " CSEC
  echo
  bao auth enable oidc >/dev/null
  bao write auth/oidc/config \
    oidc_discovery_url="https://auth.nerdsbythehour.com/application/o/openbao/" \
    oidc_client_id="$CID" oidc_client_secret="$CSEC" default_role=mj >/dev/null
  bao write auth/oidc/role/mj - <<JSON >/dev/null
{
  "bound_audiences": ["$CID"],
  "allowed_redirect_uris": [
    "https://stuff.nerdsbythehour.com/ui/vault/auth/oidc/oidc/callback",
    "http://localhost:8250/oidc/callback"
  ],
  "user_claim": "sub",
  "groups_claim": "groups",
  "bound_claims": { "groups": ["mj"] },
  "token_policies": ["admin"],
  "token_ttl": "8h"
}
JSON
  unset CID CSEC
else
  echo "OIDC auth already enabled; leaving it."
fi

if ! bao audit list >/dev/null 2>&1; then
  bao audit enable file file_path=stdout >/dev/null || true
fi

# --- loads -------------------------------------------------------------------
# Skip a path that already has data so a second run does not rotate passwords.

load_generated_db() {
  if kv_exists kv/deby/database/postgresql && kv_exists kv/deby/teslamate/teslamate-secret; then
    echo "database and teslamate secrets already in OpenBao; not regenerating."
    echo "The git history still holds the old changeme strings. Rotate by hand if this was a copy."
    return
  fi
  local pg tm ek
  pg=$(openssl rand -base64 32 | tr -d '\n')
  tm=$(openssl rand -base64 32 | tr -d '\n')
  ek=$(openssl rand -base64 32 | tr -d '\n')
  jq -n --arg pg "$pg" --arg tm "$tm" \
    '{data: {"postgres-password": $pg, "teslamate-password": $tm}}' >"$TMP/pg.json"
  jq -n --arg tm "$tm" --arg ek "$ek" \
    '{data: {"database-password": $tm, "encryption-key": $ek}}' >"$TMP/tm.json"
  # kv CLI wants the inner object, not the API envelope.
  jq '.data' "$TMP/pg.json" >"$TMP/pg-data.json"
  jq '.data' "$TMP/tm.json" >"$TMP/tm-data.json"
  kv_put_json kv/deby/database/postgresql "$TMP/pg-data.json"
  kv_put_json kv/deby/teslamate/teslamate-secret "$TMP/tm-data.json"
  echo "Generated new postgres, teslamate, and TeslaMate encryption-key values in OpenBao."
  echo "Applying ALTER USER inside postgresql-0. TeslaMate ENCRYPTION_KEY is NOT applied"
  echo "until Phase 2 syncs the Secret. Existing TeslaMate ciphertext will not decrypt."
  kubectl -n database exec -i postgresql-0 -- psql -U postgres -v ON_ERROR_STOP=1 \
    -c "ALTER USER postgres WITH PASSWORD '${pg}';" \
    -c "ALTER USER teslamate WITH PASSWORD '${tm}';"
  unset pg tm ek
  rm -f "$TMP/pg.json" "$TMP/tm.json" "$TMP/pg-data.json" "$TMP/tm-data.json"
}

copy_k8s_secret() {
  local ns="$1" name="$2" path="$3"
  if kv_exists "$path"; then
    echo "exists, skip $path"
    return
  fi
  local actual="$name"
  if ! kubectl -n "$ns" get secret "$name" >/dev/null 2>&1; then
    actual=$(kubectl -n "$ns" get secrets -o json \
      | jq -r --arg p "$name" '.items[].metadata.name | select(startswith($p + "-"))' \
      | head -n 1)
  fi
  if [[ -z "${actual:-}" ]]; then
    echo "MISSING $ns/$name (looked for an exact name and a kustomize hash suffix)" >&2
    return 1
  fi
  echo "copy $ns/$actual -> $path"
  kubectl -n "$ns" get secret "$actual" -o json \
    | jq '.data | map_values(@base64d) | with_entries(if .key == ".dockerconfigjson" then .key = "dockerconfigjson" else . end)' \
    >"$TMP/payload.json"
  kv_put_json "$path" "$TMP/payload.json"
  rm -f "$TMP/payload.json"
}

load_generated_db

# Live objects. Values are copied so Phase 2 does not blank a running app.
# They were in git (plaintext changeme, or SOPS ciphertext). Rotating the
# copied value is a follow-up at the system that issued it. The checklist
# at the end names each one. Do not treat a copy as a rotation.
copy_k8s_secret authentik authentik-secrets kv/deby/authentik/authentik-secrets
copy_k8s_secret cert-manager cloudflare-api-token kv/deby/cert-manager/cloudflare-api-token
copy_k8s_secret cloudflared cloudflared-token kv/deby/cloudflared/cloudflared-token
copy_k8s_secret demo-yourphr demo-yourphr-sandbox-credentials kv/deby/demo-yourphr/demo-yourphr-sandbox-credentials
copy_k8s_secret demo-yourphr demo-yourphr-relay kv/deby/demo-yourphr/demo-yourphr-relay
copy_k8s_secret geohazardwatch ngdpbase-ingest-creds kv/deby/geohazardwatch/ngdpbase-ingest-creds
copy_k8s_secret flux-system flux-system-git-auth kv/deby/flux-system/flux-system-git-auth
copy_k8s_secret jimsmcp ghcr-jimsmcp kv/deby/jimsmcp/ghcr-jimsmcp
copy_k8s_secret maps maps-secret kv/deby/maps/maps-secret
copy_k8s_secret monitoring grafana-oauth kv/deby/monitoring/grafana-oauth
copy_k8s_secret monitoring alertmanager-secrets kv/deby/monitoring/alertmanager-secrets
copy_k8s_secret owntracks owntracks-basic-auth kv/deby/owntracks/owntracks-basic-auth
copy_k8s_secret yourphr yourphr-sandbox-credentials kv/deby/yourphr/yourphr-sandbox-credentials
copy_k8s_secret yourphr yourphr-relay kv/deby/yourphr/yourphr-relay

if ! kv_exists kv/deby/flux-system/webhook-token; then
  tok=$(openssl rand -hex 32)
  jq -n --arg tok "$tok" '{token: $tok}' >"$TMP/wh.json"
  kv_put_json kv/deby/flux-system/webhook-token "$TMP/wh.json"
  unset tok
  rm -f "$TMP/wh.json"
  echo "New flux webhook token is in kv/deby/flux-system/webhook-token key token."
  echo "Read it with bao and paste it into the GitHub webhook. The Secret in-cluster"
  echo "today is SOPS ciphertext (age recipient age1nur86, and infra-configs has no"
  echo "decryption), so there is no working value to copy."
fi

mcp_enc="$REPO_ROOT/.env.secret.mcp-authentik.encrypted"
if ! kv_exists kv/deby/workstation/mcp-authentik; then
  if [[ -f "$mcp_enc" ]] && command -v sops >/dev/null; then
    if sops decrypt --input-type dotenv --output-type dotenv "$mcp_enc" >"$TMP/mcp.env"; then
      jq -R -s '
        split("\n")
        | map(select(length > 0 and (startswith("#") | not) and (startswith("sops_") | not)))
        | map(split("="))
        | map({(.[0]): (.[1:] | join("="))})
        | add
      ' <"$TMP/mcp.env" >"$TMP/mcp.json"
      kv_put_json kv/deby/workstation/mcp-authentik "$TMP/mcp.json"
      rm -f "$TMP/mcp.env" "$TMP/mcp.json"
      echo "Loaded workstation MCP credentials into kv/deby/workstation/mcp-authentik."
    else
      echo "sops could not decrypt the MCP env file. Load it before Phase 2 deletes it." >&2
    fi
  else
    echo "MCP env file or sops is absent. Load kv/deby/workstation/mcp-authentik from a checkout that still has the encrypted file."
  fi
fi

cat <<'EOF'

Copied secrets still need a real rotation. Git history has the changeme
strings in the clear, and it has the SOPS ciphertext forever. Destroy the
age key only after each value below has been re-issued at its source and
written back with `bao kv put`.

  - authentik secret_key and postgresql_password (rotating secret_key logs sessions out)
  - cloudflare-api-token (Let's Encrypt DNS-01 for every other host)
  - cloudflared TUNNEL_TOKEN
  - demo-yourphr sandbox client id/secret and relay secret
  - geohazardwatch ngdpbase-ingest client id/secret
  - flux-system githubAppID, githubAppInstallationID, githubAppPrivateKey
  - jimsmcp ghcr dockerconfigjson (OpenBao property name: dockerconfigjson)
  - maps postgres-password (ALTER USER in the maps database) and secret-key-base
  - grafana-oauth client-secret
  - alertmanager resend_api_key
  - owntracks basic-auth users
  - yourphr sandbox credentials and relay secret
  - workstation mcp AUTHENTIK_TOKEN

Not in git, not loaded here: monitoring/netalertx-api-token,
monitoring/homeassistant-api-token, optional geohazardwatch-secrets.
The unseal key is not in OpenBao.

Log in with OIDC at https://stuff.nerdsbythehour.com before revoking root.
Break-glass if OIDC is broken: recovery key, then `bao operator generate-root`.
EOF

read -rp "OIDC login verified? Revoke the root token now [y/N] " ok
if [[ "${ok:-}" == "y" ]]; then
  bao token revoke -self >/dev/null || true
  unset BAO_TOKEN
  echo "Root token revoked."
else
  echo "Root token left in this process only. Revoke it after OIDC works."
fi
echo "Done."
