#!/usr/bin/env node
/**
 * Provision the Authentik forward-auth Application + Proxy Provider for Fasten
 * (mj-infra-flux#99). Self-contained: decrypts AUTHENTIK_BASE_URL/TOKEN from
 * the SOPS env and drives the /api/v3 REST API directly.
 * Idempotent: exits cleanly if the `fasten` application already exists.
 *
 * fasten.nerdsbythehour.com — internal-only health record aggregator.
 * forward_single mode (single app, not domain-level).
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

async function main() {
  // Idempotency
  try {
    const existing = await api('/core/applications/fasten/');
    if (existing?.slug === 'fasten') {
      console.log('ℹ️  Application "fasten" already exists — nothing to do.');
      console.log(`   provider pk: ${existing.provider}`);
      return;
    }
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  // Flows
  const authFlows = (await api('/flows/instances/?designation=authorization')).results;
  const authFlow =
    (authFlows.find((f) => f.slug.includes('implicit') || f.name.toLowerCase().includes('implicit')) ||
      authFlows[0]).pk;
  const invFlow = (await api('/flows/instances/?designation=invalidation')).results[0].pk;

  // Proxy provider (forward_single = single application forward auth)
  const provider = await api('/providers/proxy/', 'POST', {
    name: 'Fasten Provider',
    authorization_flow: authFlow,
    invalidation_flow: invFlow,
    external_host: 'https://fasten.nerdsbythehour.com',
    mode: 'forward_single',
    access_token_validity: 'hours=24',
  });
  console.log(`✅ provider pk: ${provider.pk}`);

  // Application
  const app = await api('/core/applications/', 'POST', {
    name: 'Fasten',
    slug: 'fasten',
    provider: provider.pk,
    meta_launch_url: 'https://fasten.nerdsbythehour.com',
    group: '',
  });
  console.log(`✅ application slug: ${app.slug}`);

  // Bind to embedded outpost
  const outposts = (await api('/outposts/instances/')).results;
  const embedded =
    outposts.find(
      (o) => o.name.toLowerCase().includes('embedded') || o.managed === 'goauthentik.io/outposts/embedded'
    ) || outposts[0];
  const providers = embedded.providers || [];
  if (!providers.includes(provider.pk)) {
    providers.push(provider.pk);
    await api(`/outposts/instances/${embedded.pk}/`, 'PATCH', { providers });
  }
  console.log(`✅ bound provider to outpost: ${embedded.name}`);

  console.log('\nDone.');
  console.log(`   app:      ${cfg.baseUrl}/if/admin/#/core/applications/fasten`);
  console.log(`   provider: ${cfg.baseUrl}/if/admin/#/core/providers/${provider.pk}`);
}

main().catch((err) => {
  console.error('❌ failed:', err.message || err);
  process.exit(1);
});
