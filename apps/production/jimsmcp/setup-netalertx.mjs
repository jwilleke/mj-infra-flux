#!/usr/bin/env node
/**
 * Provision the Authentik forward-auth Application + Proxy Provider for NetAlertX
 * (deby#24). Self-contained: decrypts AUTHENTIK_BASE_URL/TOKEN from the SOPS env
 * (same source as src/authentik.ts) and drives the /api/v3 REST API directly with
 * global fetch — avoids the CJS/ESM mismatch when importing the compiled client.
 * Idempotent: exits cleanly if the `netalertx` application already exists.
 *
 * NetAlertX runs on the deby host (192.168.68.71:20211); Traefik proxies, Authentik
 * (forward_domain mode) authenticates. See apps/production/netalertx-proxy/.
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
    const existing = await api('/core/applications/netalertx/');
    if (existing?.slug === 'netalertx') {
      console.log('ℹ️  Application "netalertx" already exists — nothing to do.');
      console.log(`   provider pk: ${existing.provider}`);
      return;
    }
  } catch (e) {
    if (e.status !== 404) throw e; // 404 = not present, proceed
  }

  // Flows
  const authFlows = (await api('/flows/instances/?designation=authorization')).results;
  const authFlow =
    (authFlows.find((f) => f.slug.includes('implicit') || f.name.toLowerCase().includes('implicit')) ||
      authFlows[0]).pk;
  const invFlow = (await api('/flows/instances/?designation=invalidation')).results[0].pk;

  // Proxy provider (forward_domain = domain-level forward auth)
  const provider = await api('/providers/proxy/', 'POST', {
    name: 'NetAlertX Provider',
    authorization_flow: authFlow,
    invalidation_flow: invFlow,
    external_host: 'https://netalertx.nerdsbythehour.com',
    internal_host: 'http://192.168.68.71:20211',
    internal_host_ssl_validation: false,
    mode: 'forward_domain',
    access_token_validity: 'hours=24',
  });
  console.log(`✅ provider pk: ${provider.pk}`);

  // Application
  const app = await api('/core/applications/', 'POST', {
    name: 'NetAlertX',
    slug: 'netalertx',
    provider: provider.pk,
    meta_launch_url: 'https://netalertx.nerdsbythehour.com',
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
  console.log(`   app:      ${cfg.baseUrl}/if/admin/#/core/applications/netalertx`);
  console.log(`   provider: ${cfg.baseUrl}/if/admin/#/core/providers/${provider.pk}`);
  console.log('   Next: bind authorized users/groups to the app, and add the DNS record.');
}

main().catch((err) => {
  console.error('❌ failed:', err.message || err);
  process.exit(1);
});
