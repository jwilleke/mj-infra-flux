#!/usr/bin/env bash
# Configure OpenBao after the pod is up. Idempotent. Writes no file in git
# and prints a secret only when you need to store it (recovery key, root
# token if OIDC is skipped, AppRole secret_id on first create or --mint).
#
# Runbook: apps/production/openbao/README.md
#
#   scripts/openbao-bootstrap.sh
#   scripts/openbao-bootstrap.sh approle <name> <kv-logical-path> [--mint]
#
# Requires kubectl to the deby cluster. bao runs inside the pod.
# When OpenBao is already initialized, export BAO_TOKEN first.
set -euo pipefail
umask 077

NS=openbao
POD=openbao-0
OIDC_GROUP="${OPENBAO_OIDC_GROUP:-mj}"
KV_MOUNT=kv

usage() {
  cat <<'EOF'
usage: openbao-bootstrap.sh
       openbao-bootstrap.sh approle <name> <kv-logical-path> [--mint]

Configures kv-v2, kubernetes auth (ESO + raft snapshot), the audit file
device, AppRole, and (unless OPENBAO_SKIP_OIDC=1) Authentik OIDC.

approle creates a read-only policy and role for one logical path under
kv, for example ngdpbase/jimstest/page-token. A secret_id is printed
only when the role has none, or when --mint is set.
EOF
}

bao() {
  if [[ -n "${BAO_TOKEN:-}" ]]; then
    kubectl -n "$NS" exec -i "$POD" -- env BAO_TOKEN="$BAO_TOKEN" HOME=/tmp bao "$@"
  else
    kubectl -n "$NS" exec -i "$POD" -- env HOME=/tmp bao "$@"
  fi
}

# bao status and list commands exit 2 for sealed, empty, or missing mounts.
bao_capture() {
  local rc
  set +e
  BAO_CAPTURE=$(bao "$@" 2>&1)
  rc=$?
  set -e
  if [[ "$rc" -ne 0 && "$rc" -ne 2 ]]; then
    echo "bao $* failed (exit $rc)" >&2
    printf '%s\n' "$BAO_CAPTURE" >&2
    exit 1
  fi
  return 0
}

require_token() {
  if [[ -z "${BAO_TOKEN:-}" ]]; then
    echo "OpenBao is already initialized. Export BAO_TOKEN (root or admin) and re-run." >&2
    echo "The recovery key in the LastPass note can mint a root token: bao operator generate-root." >&2
    exit 1
  fi
}

enable_auth() {
  local path="$1"
  shift
  bao_capture auth list
  if printf '%s\n' "$BAO_CAPTURE" | grep -q "^${path}/"; then
    echo "auth ${path}/ already enabled"
    return 0
  fi
  bao auth enable "$@" >/dev/null
  echo "enabled auth ${path}/"
}

enable_kv() {
  bao_capture secrets list
  if printf '%s\n' "$BAO_CAPTURE" | grep -q "^${KV_MOUNT}/"; then
    echo "secrets engine ${KV_MOUNT}/ already enabled"
    return 0
  fi
  bao secrets enable -path="$KV_MOUNT" kv-v2 >/dev/null
  echo "enabled kv-v2 at ${KV_MOUNT}/"
}

write_policies() {
  bao policy write external-secrets-read - <<'EOF' >/dev/null
# One role until the first migration splits per-app roles.
# No ExternalSecret exists yet. Narrow this when an app is wired up.
path "kv/data/apps/*" {
  capabilities = ["read"]
}
path "kv/metadata/apps/*" {
  capabilities = ["read", "list"]
}
path "kv/data/ngdpbase/*" {
  capabilities = ["read"]
}
path "kv/metadata/ngdpbase/*" {
  capabilities = ["read", "list"]
}
EOF

  bao policy write raft-snapshot - <<'EOF' >/dev/null
path "sys/storage/raft/snapshot" {
  capabilities = ["read"]
}
EOF

  bao policy write admin - <<'EOF' >/dev/null
path "*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
EOF
  echo "wrote policies external-secrets-read, raft-snapshot, admin"
}

write_kubernetes_auth() {
  # No reviewer JWT: OpenBao uses its own ServiceAccount token
  # (system:auth-delegator on the chart). disable_iss_validation covers
  # the k3s issuer mismatch. Audience is left unset; ESO's TokenRequest
  # uses the API server default audience.
  kubectl -n "$NS" exec "$POD" -- env BAO_TOKEN="$BAO_TOKEN" HOME=/tmp bao write auth/kubernetes/config \
    kubernetes_host="https://kubernetes.default.svc:443" \
    kubernetes_ca_cert="@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt" \
    disable_iss_validation=true >/dev/null

  bao write auth/kubernetes/role/external-secrets \
    bound_service_account_names=external-secrets \
    bound_service_account_namespaces=external-secrets \
    policies=external-secrets-read \
    ttl=1h >/dev/null

  bao write auth/kubernetes/role/raft-snapshot \
    bound_service_account_names=openbao-snapshot \
    bound_service_account_namespaces=openbao \
    policies=raft-snapshot \
    ttl=10m >/dev/null
  echo "configured kubernetes auth roles external-secrets and raft-snapshot"
}

enable_audit() {
  bao_capture audit list
  if printf '%s\n' "$BAO_CAPTURE" | grep -q '^file/'; then
    echo "file audit device already enabled"
    return 0
  fi
  echo "audit device is declared in the server config (helmrelease.yaml); not enabling via API" >&2
}

configure_oidc() {
  if [[ "${OPENBAO_SKIP_OIDC:-}" == "1" ]]; then
    echo "OPENBAO_SKIP_OIDC=1: OIDC left unconfigured."
    return 1
  fi
  bao_capture auth list
  if printf '%s\n' "$BAO_CAPTURE" | grep -q '^oidc/'; then
    bao_capture read auth/oidc/config || true
    if printf '%s\n' "$BAO_CAPTURE" | grep -q oidc_discovery_url; then
      echo "OIDC auth already configured; leaving it."
      return 0
    fi
  else
    bao auth enable oidc >/dev/null
    echo "enabled auth oidc/"
  fi
  if [[ ! "$OIDC_GROUP" =~ ^[A-Za-z0-9_-]+$ ]]; then
    echo "OPENBAO_OIDC_GROUP must match [A-Za-z0-9_-]+" >&2
    exit 1
  fi
  if [[ -z "${OPENBAO_OIDC_CLIENT_ID:-}" || -z "${OPENBAO_OIDC_CLIENT_SECRET:-}" ]]; then
    if [[ ! -t 0 ]]; then
      echo "OIDC client not in the environment and stdin is not a terminal. Skipping OIDC." >&2
      echo "Re-run with OPENBAO_OIDC_CLIENT_ID and OPENBAO_OIDC_CLIENT_SECRET, or from a terminal." >&2
      return 1
    fi
    echo "Create an Authentik OAuth2/OIDC provider. Application slug openbao."
    echo "Redirect URIs:"
    echo "  https://stuff.nerdsbythehour.com/ui/vault/auth/oidc/oidc/callback"
    echo "  http://localhost:8250/oidc/callback"
    echo "Include the groups scope. Bound group is ${OIDC_GROUP} (OPENBAO_OIDC_GROUP)."
    read -rp "Authentik client_id: " OPENBAO_OIDC_CLIENT_ID
    read -rsp "Authentik client_secret: " OPENBAO_OIDC_CLIENT_SECRET
    echo
  fi
  if [[ -z "$OPENBAO_OIDC_CLIENT_ID" || -z "$OPENBAO_OIDC_CLIENT_SECRET" ]]; then
    echo "client_id and client_secret are both required" >&2
    exit 1
  fi
  export OPENBAO_OIDC_CLIENT_ID OPENBAO_OIDC_CLIENT_SECRET OIDC_GROUP
  python3 - <<'PY' | bao write auth/oidc/config - >/dev/null
import json, os
print(json.dumps({
    "oidc_discovery_url": "https://auth.nerdsbythehour.com/application/o/openbao/",
    "oidc_client_id": os.environ["OPENBAO_OIDC_CLIENT_ID"],
    "oidc_client_secret": os.environ["OPENBAO_OIDC_CLIENT_SECRET"],
    "default_role": os.environ["OIDC_GROUP"],
}))
PY
  python3 - <<'PY' | bao write "auth/oidc/role/${OIDC_GROUP}" - >/dev/null
import json, os
group = os.environ["OIDC_GROUP"]
cid = os.environ["OPENBAO_OIDC_CLIENT_ID"]
print(json.dumps({
    "bound_audiences": [cid],
    "allowed_redirect_uris": [
        "https://stuff.nerdsbythehour.com/ui/vault/auth/oidc/oidc/callback",
        "http://localhost:8250/oidc/callback",
    ],
    "user_claim": "sub",
    "groups_claim": "groups",
    "bound_claims": {"groups": [group]},
    "token_policies": ["admin"],
    "token_ttl": "8h",
}))
PY
  unset OPENBAO_OIDC_CLIENT_SECRET
  echo "configured OIDC role ${OIDC_GROUP}"
  return 0
}

check_unseal_file() {
  if ! kubectl -n "$NS" exec "$POD" -- test -r /openbao/unseal/unseal.key; then
    echo "Pod cannot read /openbao/unseal/unseal.key." >&2
    echo "On deby the file must be mode 0400 and owned by uid 3003. See the README." >&2
    exit 1
  fi
  local bytes
  bytes=$(kubectl -n "$NS" exec "$POD" -- wc -c /openbao/unseal/unseal.key | awk '{print $1}')
  if [[ "$bytes" != "32" ]]; then
    echo "unseal.key is ${bytes} bytes; the static seal needs 32." >&2
    exit 1
  fi
}

init_if_needed() {
  bao_capture status
  local initialized
  initialized=$(printf '%s\n' "$BAO_CAPTURE" | awk '$1 == "Initialized" {print $2; exit}')
  if [[ "$initialized" == "true" ]]; then
    echo "Already initialized."
    require_token
    FRESH_INIT=0
    return 0
  fi
  echo "Initializing (recovery-shares=1). Store the recovery key in the LastPass note."
  local init_out recovery
  set +e
  init_out=$(bao operator init -recovery-shares=1 -recovery-threshold=1 2>&1)
  local rc=$?
  set -e
  if [[ "$rc" -ne 0 ]]; then
    echo "bao operator init failed (exit $rc)" >&2
    # Init failure text does not include key material. The success path is captured above.
    printf '%s\n' "$init_out" >&2
    exit 1
  fi
  recovery=$(printf '%s\n' "$init_out" | awk -F': ' '/Recovery Key/ {print $2}')
  BAO_TOKEN=$(printf '%s\n' "$init_out" | awk -F': ' '/Initial Root Token/ {print $2}')
  unset init_out
  if [[ -z "$recovery" || -z "$BAO_TOKEN" ]]; then
    echo "init output did not include a recovery key and root token. Stop and read the pod log." >&2
    exit 1
  fi
  echo "----- recovery key (one line; LastPass secure note; then clear this terminal) -----"
  printf '%s\n' "$recovery"
  echo "----- end recovery key -----"
  unset recovery
  FRESH_INIT=1
  echo "Root token is in this process only."
}

core_setup() {
  echo "Waiting for ${POD} (sealed or uninitialized is fine; a missing pod is not)..."
  kubectl -n "$NS" rollout status "statefulset/openbao" --timeout=180s
  check_unseal_file
  init_if_needed
  enable_kv
  enable_auth kubernetes kubernetes
  write_policies
  write_kubernetes_auth
  enable_auth approle approle
  enable_audit
  local oidc_ok=0
  if configure_oidc; then
    oidc_ok=1
  fi
  cat <<'EOF'

No secret values were copied. SOPS stays. The secret inventory in
apps/production/openbao/README.md is still empty on purpose.

Log in at https://stuff.nerdsbythehour.com before revoking the root token.
If OIDC is down later: recovery key, then `bao operator generate-root`.
EOF
  local revoked=0
  if [[ "$FRESH_INIT" -eq 1 && "$oidc_ok" -eq 1 && -t 0 ]]; then
    local ok
    read -rp "OIDC login verified? Revoke the root token now [y/N] " ok
    if [[ "${ok:-}" == "y" ]]; then
      bao token revoke -self >/dev/null || true
      unset BAO_TOKEN
      revoked=1
      echo "Root token revoked."
    fi
  fi
  if [[ "$FRESH_INIT" -eq 1 && "$revoked" -eq 0 ]]; then
    echo "----- root token (LastPass note until OIDC works, then revoke it) -----"
    printf '%s\n' "$BAO_TOKEN"
    echo "----- end root token -----"
  fi
  echo "Done."
}

valid_name() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]
}

valid_logical_path() {
  local p="$1"
  [[ -n "$p" ]] || return 1
  [[ "$p" != /* ]] || return 1
  [[ "$p" != *..* ]] || return 1
  [[ "$p" != *\"* ]] || return 1
  [[ "$p" =~ ^[A-Za-z0-9_./~*-]+$ ]] || return 1
  return 0
}

approle_setup() {
  local name="$1" logical="$2" mint="${3:-}"
  if ! valid_name "$name"; then
    echo "role name must match [a-z0-9][a-z0-9-]{0,62}" >&2
    exit 1
  fi
  if ! valid_logical_path "$logical"; then
    echo "path must be a kv logical path such as ngdpbase/jimstest/page-token" >&2
    exit 1
  fi
  echo "Waiting for ${POD}..."
  kubectl -n "$NS" rollout status "statefulset/openbao" --timeout=180s
  bao_capture status
  local initialized
  initialized=$(printf '%s\n' "$BAO_CAPTURE" | awk '$1 == "Initialized" {print $2; exit}')
  if [[ "$initialized" != "true" ]]; then
    echo "OpenBao is not initialized. Run scripts/openbao-bootstrap.sh first." >&2
    exit 1
  fi
  require_token
  enable_auth approle approle
  local policy="approle-${name}"
  bao policy write "$policy" - <<EOF >/dev/null
path "kv/data/${logical}" {
  capabilities = ["read"]
}
path "kv/metadata/${logical}" {
  capabilities = ["read"]
}
EOF
  bao write "auth/approle/role/${name}" \
    token_policies="$policy" \
    token_ttl=1h \
    token_max_ttl=4h \
    secret_id_num_uses=0 >/dev/null
  local role_id
  role_id=$(bao read -field=role_id "auth/approle/role/${name}/role-id")
  echo "role ${name} policy ${policy} path kv/data/${logical}"
  echo "role_id ${role_id}"
  local have_sid=0
  bao_capture list -format=json "auth/approle/role/${name}/secret-id"
  if printf '%s\n' "$BAO_CAPTURE" | python3 -c 'import json,sys
raw=sys.stdin.read().strip()
try:
    val=json.loads(raw)
except json.JSONDecodeError:
    sys.exit(1)
sys.exit(0 if isinstance(val, list) and len(val) > 0 else 1)'; then
    have_sid=1
  fi
  if [[ "$have_sid" -eq 0 || "$mint" == "--mint" ]]; then
    local secret_id
    secret_id=$(bao write -f -field=secret_id "auth/approle/role/${name}/secret-id")
    echo "----- secret_id (store with the agent; do not commit; shown once) -----"
    printf '%s\n' "$secret_id"
    echo "----- end secret_id -----"
    unset secret_id
  else
    echo "secret_id already exists; not minting another. Pass --mint to add one."
  fi
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required" >&2
    exit 1
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required (OIDC config is written as JSON)" >&2
    exit 1
  fi
  if [[ "${1:-}" == "approle" ]]; then
    if [[ $# -lt 3 || $# -gt 4 ]]; then
      usage >&2
      exit 1
    fi
    approle_setup "$2" "$3" "${4:-}"
    exit 0
  fi
  if [[ $# -ne 0 ]]; then
    usage >&2
    exit 1
  fi
  FRESH_INIT=0
  core_setup
}

main "$@"
