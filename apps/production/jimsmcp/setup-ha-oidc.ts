/**
 * Setup Home Assistant with OAuth2/OIDC provider in Authentik
 * This replaces the proxy provider approach with proper OIDC
 */

import { AuthentikClient } from './src/authentik.js';

interface OAuth2ProviderResponse {
  pk: number;
  name: string;
  authorization_flow: string;
  client_type: string;
  client_id: string;
  client_secret: string;
  redirect_uris: string;
  signing_key: string;
}

class AuthentikOIDCClient extends AuthentikClient {
  /**
   * Get default authorization flow (public wrapper)
   */
  async getAuthFlow(): Promise<string> {
    const response = await this['client'].get('/flows/instances/?designation=authorization');
    const flows = response.data.results;

    // Try to find implicit consent flow first
    const implicitFlow = flows.find((f: any) =>
      f.slug.includes('implicit') || f.name.toLowerCase().includes('implicit')
    );

    if (implicitFlow) {
      return implicitFlow.pk;
    }

    // Fallback to first authorization flow
    if (flows.length > 0) {
      return flows[0].pk;
    }

    throw new Error('No authorization flow found');
  }

  /**
   * Create an OAuth2/OpenID Provider for Home Assistant
   */
  async createOAuth2Provider(options: {
    name: string;
    redirectUris: string[];
  }): Promise<OAuth2ProviderResponse> {
    // Get default authorization flow
    const authFlow = await this.getAuthFlow();

    // Get invalidation flow
    const invalidationFlow = await this.getInvalidationFlow();

    const providerData = {
      name: options.name,
      authorization_flow: authFlow,
      invalidation_flow: invalidationFlow,
      client_type: 'confidential',
      redirect_uris: options.redirectUris.map(uri => ({
        matching_mode: 'strict',
        url: uri
      })),
      sub_mode: 'hashed_user_id',
      include_claims_in_id_token: true,
      issuer_mode: 'per_provider',
      signing_key: await this.getDefaultSigningKey(),
    };

    const response = await this['client'].post('/providers/oauth2/', providerData);
    return response.data;
  }

  /**
   * Get invalidation flow
   */
  async getInvalidationFlow(): Promise<string> {
    const response = await this['client'].get('/flows/instances/?designation=invalidation');
    const flows = response.data.results;

    if (flows.length === 0) {
      throw new Error('No invalidation flow found');
    }

    return flows[0].pk;
  }

  /**
   * Get the default signing key for OIDC tokens
   */
  private async getDefaultSigningKey(): Promise<string> {
    const response = await this['client'].get('/crypto/certificatekeypairs/?has_key=true');
    const keys = response.data.results;

    if (keys.length === 0) {
      throw new Error('No signing keys found. Please create one in Authentik.');
    }

    // Use the first available key
    return keys[0].pk;
  }

  /**
   * Update Home Assistant application to use OAuth2 provider
   */
  async updateApplicationProvider(appPk: string, providerId: number) {
    // Update the application to use the new provider
    const response = await this['client'].patch(`/core/applications/${appPk}/`, {
      provider: providerId,
    });

    return response.data;
  }

  /**
   * Get provider details including client_id and client_secret
   */
  async getOAuth2ProviderDetails(providerId: number) {
    const response = await this['client'].get(`/providers/oauth2/${providerId}/`);
    return response.data;
  }

  /**
   * Delete a provider (for cleanup)
   */
  async deleteProvider(providerId: number) {
    await this['client'].delete(`/providers/all/${providerId}/`);
  }
}

async function main() {
  const client = new AuthentikOIDCClient();

  console.log('🔧 Setting up Home Assistant with OIDC...\n');

  try {
    // Step 1: Check for existing or create OAuth2/OpenID Provider
    console.log('1️⃣  Checking for existing OAuth2/OpenID Provider...');
    let provider: any;

    // Check if provider already exists
    const providers = await client.listProviders();
    const existingProvider = providers.find((p: any) =>
      p.name === 'Home Assistant OIDC' || p.name === 'Home Assistant OAuth2'
    );

    if (existingProvider) {
      console.log(`✅ Found existing OAuth2 provider: ${existingProvider.name} (ID: ${existingProvider.pk})`);
      provider = await client.getOAuth2ProviderDetails(existingProvider.pk);
    } else {
      console.log('   Creating new OAuth2/OpenID Provider...');
      provider = await client.createOAuth2Provider({
        name: 'Home Assistant OAuth2',
        redirectUris: [
          'https://ha.nerdsbythehour.com/auth/external/callback',
        ],
      });
      console.log(`✅ Created OAuth2 provider with ID: ${provider.pk}`);
    }

    console.log(`   Client ID: ${provider.client_id}`);
    console.log(`   Client Secret: ${provider.client_secret}\n`);

    // Step 2: Check if Home Assistant app exists
    console.log('2️⃣  Looking for existing Home Assistant application...');
    const apps = await client.listApplications();
    let haApp = apps.find((app: any) => app.slug === 'ha' || app.name === 'Home Assistant');

    if (haApp) {
      console.log(`✅ Found existing app: ${haApp.name} (slug: ${haApp.slug}, pk: ${haApp.pk})`);
      console.log(`   Updating to use OAuth2 provider ${provider.pk}...`);

      // Update existing app to use new provider
      haApp = await client.updateApplicationProvider(haApp.pk, provider.pk);
      console.log('✅ Application updated\n');
    } else {
      console.log('⚠️  No existing Home Assistant application found.');
      console.log('   Creating new application...');

      // Create new application
      haApp = await client.createApplication({
        name: 'Home Assistant',
        slug: 'ha',
        providerId: provider.pk,
        group: 'mj',
      });
      console.log(`✅ Created new application: ${haApp.name}\n`);
    }

    // Step 3: Get full provider details
    console.log('3️⃣  Fetching complete provider configuration...');
    const providerDetails = await client.getOAuth2ProviderDetails(provider.pk);

    // Display configuration
    console.log('\n' + '='.repeat(70));
    console.log('📋 CONFIGURATION SUMMARY');
    console.log('='.repeat(70));
    console.log('\n✅ Authentik OAuth2 Provider Created');
    console.log(`   Provider ID: ${provider.pk}`);
    console.log(`   Provider Name: ${provider.name}`);
    console.log(`   Application: ${haApp.name} (${haApp.slug})`);

    console.log('\n🔑 OAuth2 Credentials:');
    console.log(`   Client ID: ${providerDetails.client_id}`);
    console.log(`   Client Secret: ${providerDetails.client_secret}`);

    console.log('\n🌐 OIDC Configuration:');
    console.log(`   Issuer: https://auth.nerdsbythehour.com/application/o/${haApp.slug}/`);
    console.log(`   Authorization URL: https://auth.nerdsbythehour.com/application/o/authorize/`);
    console.log(`   Token URL: https://auth.nerdsbythehour.com/application/o/token/`);
    console.log(`   Userinfo URL: https://auth.nerdsbythehour.com/application/o/userinfo/`);
    console.log(`   Redirect URI: https://ha.nerdsbythehour.com/auth/external/callback`);

    console.log('\n📝 Next Steps:');
    console.log('   1. Add the following to Home Assistant configuration.yaml:');
    console.log('\n' + '-'.repeat(70));
    console.log(`
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 10.42.0.0/16
    - 10.43.0.0/16
    - 192.168.68.71

homeassistant:
  auth_providers:
    - type: homeassistant
    - type: command_line
      command: /config/authentik_oidc.sh
      args: ["https://auth.nerdsbythehour.com/application/o/ha/"]
      meta: true
`);
    console.log('-'.repeat(70));

    console.log('\n   2. Create /config/authentik_oidc.sh on Home Assistant:');
    console.log('-'.repeat(70));
    console.log(`
#!/bin/bash
# Authentik OIDC Authentication for Home Assistant
CLIENT_ID="${providerDetails.client_id}"
CLIENT_SECRET="${providerDetails.client_secret}"
REDIRECT_URI="https://ha.nerdsbythehour.com/auth/external/callback"

# Use the provided issuer URL
ISSUER_URL="$1"

# Exchange code for token
TOKEN_RESPONSE=$(curl -s -X POST "$\{ISSUER_URL}token/" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=$AUTHENTIK_CODE" \\
  -d "redirect_uri=$REDIRECT_URI" \\
  -d "client_id=$CLIENT_ID" \\
  -d "client_secret=$CLIENT_SECRET")

# Extract access token
ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

# Get user info
USER_INFO=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$\{ISSUER_URL}userinfo/")

echo "$USER_INFO"
`);
    console.log('-'.repeat(70));

    console.log('\n   3. Make the script executable:');
    console.log('      chmod +x /config/authentik_oidc.sh');

    console.log('\n   4. Restart Home Assistant');

    console.log('\n   5. Remove ForwardAuth middleware from ingress:');
    console.log('      kubectl annotate ingress home-assistant -n home-assistant-proxy \\');
    console.log('        traefik.ingress.kubernetes.io/router.middlewares-');

    console.log('\n' + '='.repeat(70));

    console.log('\n💡 Old proxy provider (ID 4) can be deleted after testing.');
    console.log('   To delete: Use Authentik UI or API to remove the old proxy provider.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
