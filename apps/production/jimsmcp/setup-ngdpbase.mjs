#!/usr/bin/env node
/**
 * Provision Authentik OAuth2/OIDC provider + application + service account for
 * ngdpbase agent ingest. Resolves mj-infra-flux#123.
 *
 * Creates (idempotent):
 *   1. OAuth2/OIDC Provider "ngdpbase"      — confidential, RS256, per-provider issuer
 *   2. Application "ngdpbase"               — slug: ngdpbase
 *   3. Service account user "svc-ingest-jim" — email=jim@willeke.com, name="Jim Willeke"
 *      + an API token for that user (stored as the SOPS client_secret)
 *
 * Outputs (after successful run):
 *   - Four ngdpbase server-side config values (issuer, jwks-url, token-endpoint, audience)
 *   - Service account client_id + client_secret for the SOPS secret
 *
 * Usage:
 *   node apps/production/jimsmcp/setup-ngdpbase.mjs
 *
 * Prerequisite: SOPS-encrypted env at <repo>/.env.secret.mcp-authentik.encrypted
 * with AUTHENTIK_BASE_URL and AUTHENTIK_TOKEN.
 */
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const repoDir = join(homedir(), 'Documents', 'mj-infra-flux');
const encryptedFile = join(repoDir, '.env.secret.mcp-authentik.encrypted');
const ageKeyFile = join(repoDir, 'home-infra-private.agekey');

function loadConfig() {
  const decrypted = execSync(
    `SOPS_AGE_KEY_FILE="${ageKeyFile}" sops decrypt --input-type dotenv --output-type dotenv "${encryptedFile}"`,
    { encoding: 'utf8' }
  );
  const cfg = {};
  for (const line of decrypted.split('\n')) {
    const [k, ...rest] = line.split('=');
    const v = rest.join('=').trim();
    if (k === 'AUTHENTIK_BASE_URL') cfg.baseUrl = v;
    if (k === 'AUTHENTIK_TOKEN') cfg.token = v;
  }
  if (!cfg.baseUrl || !cfg.token) throw new Error('Missing AUTHENTIK_BASE_URL or AUTHENTIK_TOKEN');
  return cfg;
}

const cfg = loadConfig();
const API = `${cfg.baseUrl.replace(/\/$/, '')}/api/v3`;

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = new Error(`${method} ${path} -> ${res.status}: ${text}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

async function getFlow(designation) {
  const flows = (await api(`/flows/instances/?designation=${designation}`)).results;
  if (!flows.length) throw new Error(`No ${designation} flow found.`);
  const preferred = flows.find(
    (f) => f.slug.includes('implicit') || f.name.toLowerCase().includes('implicit')
  );
  return (preferred || flows[0]).pk;
}

async function getSigningKey() {
  const keys = (await api('/crypto/certificatekeypairs/?has_key=true')).results;
  if (!keys.length) throw new Error('No signing keys — create one in Authentik UI first.');
  return keys[0].pk;
}

async function main() {
  const PROVIDER_NAME = 'ngdpbase';
  const APP_SLUG = 'ngdpbase';
  const SVC_USERNAME = 'svc-ingest-jim';
  const SVC_EMAIL = 'jim@willeke.com';
  const SVC_NAME = 'Jim Willeke';
  const TOKEN_IDENTIFIER = 'svc-ingest-jim-cc';

  // --- 1. OAuth2/OIDC Provider ---
  let providerPk, providerClientId, providerClientSecret;
  const existingProviders = (await api(`/providers/oauth2/?name=${PROVIDER_NAME}`)).results;
  if (existingProviders.length) {
    ({ pk: providerPk, client_id: providerClientId, client_secret: providerClientSecret } =
      existingProviders[0]);
    console.log(`✅ Provider already exists (pk: ${providerPk})`);
    console.log(`   client_id: ${providerClientId}`);
  } else {
    const [authFlow, invFlow, signingKey] = await Promise.all([
      getFlow('authorization'),
      getFlow('invalidation'),
      getSigningKey(),
    ]);
    const provider = await api('/providers/oauth2/', 'POST', {
      name: PROVIDER_NAME,
      client_type: 'confidential',
      authorization_flow: authFlow,
      invalidation_flow: invFlow,
      signing_key: signingKey,
      sub_mode: 'user_email',
      include_claims_in_id_token: true,
      issuer_mode: 'per_provider',
    });
    providerPk = provider.pk;
    providerClientId = provider.client_id;
    providerClientSecret = provider.client_secret;
    console.log(`✅ Created provider "${PROVIDER_NAME}" (pk: ${providerPk})`);
    console.log(`   client_id: ${providerClientId}`);
  }

  // --- 2. Application ---
  let appExists = false;
  try {
    await api(`/core/applications/${APP_SLUG}/`);
    appExists = true;
    console.log(`✅ Application "${APP_SLUG}" already exists`);
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  if (!appExists) {
    await api('/core/applications/', 'POST', {
      name: 'ngdpbase',
      slug: APP_SLUG,
      provider: providerPk,
    });
    console.log(`✅ Created application "${APP_SLUG}"`);
  }

  // --- 3. Service account user ---
  // type=service_account creates a non-interactive user whose attributes (email, name)
  // flow into CC-granted JWTs via Authentik's scope mappings.
  let svcUser;
  const existingUsers = (await api(`/core/users/?username=${SVC_USERNAME}`)).results;
  if (existingUsers.length) {
    svcUser = existingUsers[0];
    console.log(`✅ Service account "${SVC_USERNAME}" already exists (pk: ${svcUser.pk})`);
  } else {
    svcUser = await api('/core/users/', 'POST', {
      username: SVC_USERNAME,
      name: SVC_NAME,
      email: SVC_EMAIL,
      type: 'service_account',
      is_active: true,
    });
    console.log(`✅ Created service account "${SVC_USERNAME}" (pk: ${svcUser.pk})`);
  }

  // --- 4. Service account API token ---
  // This token serves as the client_secret for the client_credentials grant.
  // Authentik CC flow: client_id=svc_username, client_secret=token_key, grant_type=client_credentials.
  let tokenKey = null;
  const existingTokens = (await api(`/core/tokens/?user=${svcUser.pk}&identifier=${TOKEN_IDENTIFIER}`))
    .results;
  if (existingTokens.length) {
    console.log(`⚠️  Token "${TOKEN_IDENTIFIER}" already exists — cannot retrieve key via API.`);
    console.log(
      '    Authentik UI → Directory → Tokens → svc-ingest-jim-cc → Copy Token to get the key.'
    );
  } else {
    const token = await api('/core/tokens/', 'POST', {
      identifier: TOKEN_IDENTIFIER,
      user: svcUser.pk,
      intent: 'api',
      description: 'client_credentials token for ngdpbase agent ingest (mj-infra-flux#123)',
      expiring: false,
    });
    const tokenView = await api(`/core/tokens/${token.identifier}/view_key/`, 'POST');
    tokenKey = tokenView.key;
    console.log(`✅ Created service account token "${TOKEN_IDENTIFIER}"`);
    console.log('   ⚠️  Save the client_secret below — it cannot be retrieved again via API.');
  }

  // --- Summary ---
  const baseUrl = cfg.baseUrl.replace(/\/$/, '');
  const issuer = `${baseUrl}/application/o/${APP_SLUG}/`;
  const jwksUrl = `${baseUrl}/application/o/${APP_SLUG}/jwks/`;
  const tokenEndpoint = `${baseUrl}/application/o/token/`;

  console.log('\n── ngdpbase config (server-side — no secret needed) ──────────────────────────');
  console.log(`  issuer:         ${issuer}`);
  console.log(`  jwks-url:       ${jwksUrl}`);
  console.log(`  token-endpoint: ${tokenEndpoint}`);
  console.log(`  audience:       ${providerClientId}`);

  console.log('\n── Service account credential → SOPS secret (mj-infra-flux#123 step 5) ──────');
  console.log(`  client_id:      ${SVC_USERNAME}`);
  if (tokenKey) {
    console.log(`  client_secret:  ${tokenKey}`);
  } else {
    console.log(`  client_secret:  (retrieve from Authentik UI — see warning above)`);
  }

  console.log('\n── Verification curl ──────────────────────────────────────────────────────────');
  console.log(`  curl -s -X POST ${tokenEndpoint} \\`);
  console.log(`    -d grant_type=client_credentials \\`);
  console.log(`    -d client_id=${SVC_USERNAME} \\`);
  console.log(`    -d client_secret=<token_key> | jq .`);
  console.log('\n  Decode JWT: paste access_token at https://jwt.io and confirm iss, aud, email, name.');
  console.log(`\n  Authentik admin: ${baseUrl}/if/admin/`);
}

main().catch((err) => {
  console.error('❌ failed:', err.message || err);
  process.exit(1);
});
