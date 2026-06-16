#!/usr/bin/env node
/**
 * Provision Authentik OAuth2/OIDC provider + application + service account for
 * ngdpbase agent ingest. Resolves mj-infra-flux#123.
 *
 * Creates (idempotent):
 *   1. OAuth2/OIDC Provider "ngdpbase"            — confidential, RS256, per-provider issuer
 *   2. Application "ngdpbase"                     — slug: ngdpbase
 *   3. Service account user "svc-ingest-jim"      — named identity record (not the CC principal)
 *   4. Custom scope mapping "ngdpbase: service account identity"
 *      — hard-codes name/preferred_username since Authentik's CC synthetic user
 *        (ak-ngdpbase-client_credentials) resets name on each grant
 *   5. Provider property_mappings: openid + email + custom profile
 *
 * Authentik CC grant mechanics (discovered during setup):
 *   - CC grant uses the PROVIDER's client_id + client_secret (not a user token)
 *   - Authentik auto-creates a synthetic user "ak-ngdpbase-client_credentials" on first CC grant
 *   - That synthetic user's name resets on each grant; email persists after PATCH
 *   - The custom scope mapping overrides name/preferred_username with stable values
 *
 * Outputs the four ngdpbase server-side config values and the CC credential for the SOPS secret.
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
    const e = new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
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
  const CUSTOM_MAPPING_NAME = 'ngdpbase: service account identity';

  // Built-in scope mapping PKs (openid + email — stable managed UUIDs)
  const SCOPE_OPENID = 'bcfbb6aa-efb9-4e90-9e96-8615779abbc1';
  const SCOPE_EMAIL  = '9e83b5d5-f6f7-49e7-a4ea-fba58998c12c';

  // --- 1. OAuth2/OIDC Provider ---
  let providerPk, providerClientId, providerClientSecret;
  const existingProviders = (await api(`/providers/oauth2/?name=${PROVIDER_NAME}`)).results;
  if (existingProviders.length) {
    ({ pk: providerPk, client_id: providerClientId, client_secret: providerClientSecret } =
      existingProviders[0]);
    console.log(`✅ Provider already exists (pk: ${providerPk})`);
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
      redirect_uris: [], // required by API even for CC-only providers; never used
    });
    providerPk = provider.pk;
    providerClientId = provider.client_id;
    providerClientSecret = provider.client_secret;
    console.log(`✅ Created provider "${PROVIDER_NAME}" (pk: ${providerPk})`);
  }
  console.log(`   client_id (= audience): ${providerClientId}`);

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

  // --- 3. Named service account user (identity record for svc-ingest-jim) ---
  const existingUsers = (await api(`/core/users/?username=${SVC_USERNAME}`)).results;
  if (existingUsers.length) {
    console.log(`✅ Service account "${SVC_USERNAME}" already exists (pk: ${existingUsers[0].pk})`);
  } else {
    const svcUser = await api('/core/users/', 'POST', {
      username: SVC_USERNAME,
      name: SVC_NAME,
      email: SVC_EMAIL,
      type: 'service_account',
      is_active: true,
    });
    console.log(`✅ Created service account "${SVC_USERNAME}" (pk: ${svcUser.pk})`);
  }

  // --- 4. Custom scope mapping (overrides profile claims for CC synthetic user) ---
  // Authentik auto-creates "ak-ngdpbase-client_credentials" on first CC grant and resets
  // its name on every grant. We provide stable name/preferred_username via this mapping.
  const allMappings = await api('/propertymappings/provider/scope/?page_size=100');
  const existingMapping = allMappings.results.find((m) => m.name === CUSTOM_MAPPING_NAME);
  let customMappingPk;
  if (existingMapping) {
    customMappingPk = existingMapping.pk;
    console.log(`✅ Custom scope mapping already exists (pk: ${customMappingPk})`);
  } else {
    const mapping = await api('/propertymappings/provider/scope/', 'POST', {
      name: CUSTOM_MAPPING_NAME,
      scope_name: 'profile',
      description: `Stable identity for ngdpbase CC grant — ${SVC_NAME} <${SVC_EMAIL}>`,
      expression: `return {
    "name": "${SVC_NAME}",
    "given_name": "${SVC_NAME}",
    "preferred_username": "${SVC_USERNAME}",
    "nickname": "${SVC_USERNAME}",
    "groups": [group.name for group in request.user.ak_groups.all()],
}`,
    });
    customMappingPk = mapping.pk;
    console.log(`✅ Created custom scope mapping (pk: ${customMappingPk})`);
  }

  // --- 5. Wire scope mappings onto provider ---
  const currentProvider = await api(`/providers/oauth2/${providerPk}/`);
  const desiredMappings = [customMappingPk, SCOPE_OPENID, SCOPE_EMAIL];
  const alreadyWired =
    desiredMappings.every((pk) => currentProvider.property_mappings.includes(pk)) &&
    currentProvider.property_mappings.length === desiredMappings.length;
  if (alreadyWired) {
    console.log('✅ Provider property_mappings already correct');
  } else {
    await api(`/providers/oauth2/${providerPk}/`, 'PATCH', {
      property_mappings: desiredMappings,
    });
    console.log('✅ Provider property_mappings updated (openid + email + custom profile)');
  }

  // --- 6. Service account API token (retrieve key if newly created) ---
  let tokenKey = null;
  const existingTokens = (await api(`/core/tokens/?identifier=${TOKEN_IDENTIFIER}`)).results;
  if (existingTokens.length) {
    try {
      const tokenView = await api(`/core/tokens/${TOKEN_IDENTIFIER}/view_key/`);
      tokenKey = tokenView.key;
      console.log(`✅ Retrieved service account token key`);
    } catch {
      console.log(`⚠️  Token "${TOKEN_IDENTIFIER}" exists — retrieve key from Authentik UI if needed.`);
    }
  } else {
    const svcUsers = (await api(`/core/users/?username=${SVC_USERNAME}`)).results;
    if (svcUsers.length) {
      await api('/core/tokens/', 'POST', {
        identifier: TOKEN_IDENTIFIER,
        user: svcUsers[0].pk,
        intent: 'api',
        description: 'API token for svc-ingest-jim (informational; CC grant uses provider creds)',
        expiring: false,
      });
      const tokenView = await api(`/core/tokens/${TOKEN_IDENTIFIER}/view_key/`);
      tokenKey = tokenView.key;
      console.log(`✅ Created service account token`);
    }
  }

  // --- Summary ---
  const baseUrl = cfg.baseUrl.replace(/\/$/, '');
  const issuer = `${baseUrl}/application/o/${APP_SLUG}/`;
  const jwksUrl = `${baseUrl}/application/o/${APP_SLUG}/jwks/`;
  const tokenEndpoint = `${baseUrl}/application/o/token/`;

  // Fetch client_secret if not in memory (existing provider path)
  if (!providerClientSecret) {
    const p = await api(`/providers/oauth2/${providerPk}/`);
    providerClientSecret = p.client_secret;
  }

  console.log('\n── ngdpbase config (server-side — no secret needed) ──────────────────────────');
  console.log(`  issuer:         ${issuer}`);
  console.log(`  jwks-url:       ${jwksUrl}`);
  console.log(`  token-endpoint: ${tokenEndpoint}`);
  console.log(`  audience:       ${providerClientId}`);

  console.log('\n── CC credential → SOPS secret ngdpbase-ingest-creds.sops.yaml ──────────────');
  console.log(`  client-id:      ${providerClientId}`);
  console.log(`  client-secret:  ${providerClientSecret}`);

  console.log('\n── Verification curl ──────────────────────────────────────────────────────────');
  console.log(`  curl -s -X POST ${tokenEndpoint} \\`);
  console.log(`    -d grant_type=client_credentials \\`);
  console.log(`    -d client_id=${providerClientId} \\`);
  console.log(`    -d 'client_secret=<secret>' \\`);
  console.log(`    -d 'scope=openid profile email' | jq '.access_token | split(".")[1] | @base64d | fromjson'`);
  console.log('\n  Confirm: iss, aud, sub=jim@willeke.com, email=jim@willeke.com, name=Jim Willeke');
  console.log(`\n  Authentik admin: ${baseUrl}/if/admin/`);
}

main().catch((err) => {
  console.error('❌ failed:', err.message || err);
  process.exit(1);
});
