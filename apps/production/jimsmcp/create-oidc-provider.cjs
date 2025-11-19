// Simple script to create OIDC provider for Home Assistant
const https = require('https');
const fs = require('fs');

// Load config
const config = JSON.parse(
  require('child_process')
    .execSync(
      'SOPS_AGE_KEY_FILE="$HOME/Documents/mj-infra-flux/home-infra-private.agekey" sops decrypt --input-type dotenv --output-type json "$HOME/Documents/mj-infra-flux/.env.secret.mcp-authentik.encrypted"',
      { encoding: 'utf8' }
    )
);

const token = config.AUTHENTIK_TOKEN;

async function createOIDCProvider() {
  console.log('🔧 Creating OIDC Provider in Authentik...\n');

  // Step 1: Get authorization flow
  const flows = await apiCall('/api/v3/flows/instances/?designation=authorization');
  const authFlow = flows.results[0].pk;
  console.log(`✅ Found auth flow: ${authFlow}`);

  // Step 2: Get invalidation flow
  const invFlows = await apiCall('/api/v3/flows/instances/?designation=invalidation');
  const invFlow = invFlows.results[0].pk;
  console.log(`✅ Found invalidation flow: ${invFlow}`);

  // Step 3: Get signing key
  const keys = await apiCall('/api/v3/crypto/certificatekeypairs/?has_key=true');
  const signingKey = keys.results[0].pk;
  console.log(`✅ Found signing key: ${signingKey}`);

  // Step 4: Create OAuth2 provider
  const providerData = {
    name: 'Home Assistant OAuth2',
    authorization_flow: authFlow,
    invalidation_flow: invFlow,
    client_type: 'confidential',
    redirect_uris: [
      { matching_mode: 'strict', url: 'https://ha.nerdsbythehour.com/auth/external/callback' }
    ],
    sub_mode: 'hashed_user_id',
    include_claims_in_id_token: true,
    issuer_mode: 'per_provider',
    signing_key: signingKey,
  };

  try {
    const provider = await apiCall('/api/v3/providers/oauth2/', 'POST', providerData);
    console.log(`\n✅ OAuth2 Provider Created!`);
    console.log(`   Provider ID: ${provider.pk}`);
    console.log(`   Client ID: ${provider.client_id}`);
    console.log(`   Client Secret: ${provider.client_secret}`);

    // Step 5: Update Home Assistant app to use this provider
    const apps = await apiCall('/api/v3/core/applications/');
    const haApp = apps.results.find(a => a.slug === 'ha');

    if (haApp) {
      await apiCall(`/api/v3/core/applications/${haApp.pk}/`, 'PATCH', {
        provider: provider.pk
      });
      console.log(`\n✅ Updated Home Assistant app to use OAuth2 provider`);
    }

    // Print configuration
    console.log('\n' + '='.repeat(70));
    console.log('📋 HOME ASSISTANT CONFIGURATION');
    console.log('='.repeat(70));
    console.log('\nAdd this to /homeassistant/configuration.yaml:\n');
    console.log('```yaml');
    console.log('http:');
    console.log('  use_x_forwarded_for: true');
    console.log('  trusted_proxies:');
    console.log('    - 10.42.0.0/16');
    console.log('    - 10.43.0.0/16');
    console.log('    - 192.168.68.71');
    console.log('');
    console.log('# Install hass-openid custom component first!');
    console.log('# https://github.com/christiaangoossens/hass-oidc-auth');
    console.log('auth_oidc:');
    console.log(`  client_id: "${provider.client_id}"`);
    console.log(`  client_secret: "${provider.client_secret}"`);
    console.log('  issuer: "https://auth.nerdsbythehour.com/application/o/ha/"');
    console.log('  scope: "openid profile email"');
    console.log('  username_claim: "preferred_username"');
    console.log('```');
    console.log('\n' + '='.repeat(70));
    console.log('\n📝 Next Steps:');
    console.log('1. Install hass-openid custom component in Home Assistant');
    console.log('2. Add the configuration above to configuration.yaml');
    console.log('3. Create users in Home Assistant (usernames must match Authentik)');
    console.log('4. Restart Home Assistant');
    console.log('5. Remove ForwardAuth middleware from ingress:');
    console.log('   kubectl annotate ingress home-assistant -n home-assistant-proxy \\');
    console.log('     traefik.ingress.kubernetes.io/router.middlewares-');
    console.log('\n');

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Provider already exists. Fetching existing provider...');
      const providers = await apiCall('/api/v3/providers/all/');
      const existing = providers.results.find(p => p.name.includes('Home Assistant'));
      if (existing && existing.assigned_application_slug === 'ha') {
        const details = await apiCall(`/api/v3/providers/oauth2/${existing.pk}/`);
        console.log(`\n✅ Found existing OAuth2 provider (ID: ${existing.pk})`);
        console.log(`   Client ID: ${details.client_id}`);
        console.log(`   Client Secret: ${details.client_secret}`);
      }
    } else {
      throw error;
    }
  }
}

function apiCall(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'auth.nerdsbythehour.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    };

    const postData = data ? JSON.stringify(data) : null;
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          const error = new Error(`HTTP ${res.statusCode}`);
          try {
            error.response = JSON.parse(body);
          } catch (e) {
            error.response = body;
          }
          reject(error);
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

createOIDCProvider().catch(err => {
  console.error('❌ Error:', err.message);
  if (err.response) console.error(JSON.stringify(err.response, null, 2));
  process.exit(1);
});
