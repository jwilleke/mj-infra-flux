/**
 * Setup AMDWiki with OAuth2/OIDC application in Authentik
 * Creates a new application using the existing OAuth2 provider
 */
import { AuthentikClient } from './src/authentik.js';
class AuthentikOIDCClient extends AuthentikClient {
    /**
     * Get default authorization flow (public wrapper)
     */
    async getAuthFlow() {
        const response = await this['client'].get('/flows/instances/?designation=authorization');
        const flows = response.data.results;
        // Try to find implicit consent flow first
        const implicitFlow = flows.find((f) => f.slug.includes('implicit') || f.name.toLowerCase().includes('implicit'));
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
     * Create an OAuth2/OpenID Provider
     */
    async createOAuth2Provider(options) {
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
    async getInvalidationFlow() {
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
    async getDefaultSigningKey() {
        const response = await this['client'].get('/crypto/certificatekeypairs/?has_key=true');
        const keys = response.data.results;
        if (keys.length === 0) {
            throw new Error('No signing keys found. Please create one in Authentik.');
        }
        // Use the first available key
        return keys[0].pk;
    }
    /**
     * Update application provider
     */
    async updateApplicationProvider(appSlug, providerId) {
        // Use slug instead of pk for the endpoint
        const response = await this['client'].patch(`/core/applications/${appSlug}/`, {
            provider: providerId,
        });
        return response.data;
    }
    /**
     * Get provider details including client_id and client_secret
     */
    async getOAuth2ProviderDetails(providerId) {
        const response = await this['client'].get(`/providers/oauth2/${providerId}/`);
        return response.data;
    }
    /**
     * Add redirect URI to existing provider
     */
    async addRedirectUri(providerId, redirectUri) {
        const provider = await this.getOAuth2ProviderDetails(providerId);
        // Get existing redirect URIs
        const existingUris = provider.redirect_uris || [];
        // Check if URI already exists
        const uriExists = existingUris.some((uri) => (typeof uri === 'string' ? uri : uri.url) === redirectUri);
        if (uriExists) {
            console.log(`   ℹ️  Redirect URI already exists: ${redirectUri}`);
            return provider;
        }
        // Add new URI
        const updatedUris = [
            ...existingUris,
            {
                matching_mode: 'strict',
                url: redirectUri
            }
        ];
        const response = await this['client'].patch(`/providers/oauth2/${providerId}/`, {
            redirect_uris: updatedUris
        });
        return response.data;
    }
}
async function main() {
    const client = new AuthentikOIDCClient();
    console.log('🔧 Setting up AMDWiki with OIDC...\n');
    try {
        // Step 1: Find the existing OAuth2 provider (should be the Home Assistant one)
        console.log('1️⃣  Looking for existing OAuth2/OpenID Provider...');
        const providers = await client.listProviders();
        // Look for OAuth2 provider (prefer the Home Assistant one)
        const oauth2Provider = providers.find((p) => p.name === 'Home Assistant OAuth2' || p.name === 'Home Assistant OIDC');
        if (!oauth2Provider) {
            console.error('❌ No OAuth2 provider found!');
            console.error('   Expected to find "Home Assistant OAuth2" provider.');
            console.error('   Please run setup-ha-oidc.ts first to create the provider.');
            process.exit(1);
        }
        console.log(`✅ Found OAuth2 provider: ${oauth2Provider.name} (ID: ${oauth2Provider.pk})`);
        // Step 2: Add AMDWiki redirect URI to the provider
        console.log('\n2️⃣  Adding AMDWiki redirect URI to provider...');
        const amdwikiRedirectUri = 'https://amd.nerdsbythehour.com/Wiki.jsp?page=OAuth2Login';
        await client.addRedirectUri(oauth2Provider.pk, amdwikiRedirectUri);
        console.log(`✅ Added redirect URI: ${amdwikiRedirectUri}`);
        // Step 3: Get updated provider details
        const provider = await client.getOAuth2ProviderDetails(oauth2Provider.pk);
        // Step 4: Check if AMDWiki app exists
        console.log('\n3️⃣  Looking for existing AMDWiki application...');
        const apps = await client.listApplications();
        let amdwikiApp = apps.find((app) => app.slug === 'amdwiki' || app.name === 'AMDWiki');
        if (amdwikiApp) {
            console.log(`✅ Found existing app: ${amdwikiApp.name} (slug: ${amdwikiApp.slug}, pk: ${amdwikiApp.pk})`);
            console.log(`   Updating to use OAuth2 provider ${provider.pk}...`);
            // Update existing app to use the provider (use slug, not pk)
            amdwikiApp = await client.updateApplicationProvider(amdwikiApp.slug, provider.pk);
            console.log('✅ Application updated\n');
        }
        else {
            console.log('⚠️  No existing AMDWiki application found.');
            console.log('   Creating new application...');
            // Create new application
            amdwikiApp = await client.createApplication({
                name: 'AMDWiki',
                slug: 'amdwiki',
                providerId: provider.pk,
                group: 'mj',
            });
            console.log(`✅ Created new application: ${amdwikiApp.name}\n`);
        }
        // Display configuration
        console.log('\n' + '='.repeat(70));
        console.log('📋 CONFIGURATION SUMMARY');
        console.log('='.repeat(70));
        console.log('\n✅ Authentik OAuth2 Application Created');
        console.log(`   Provider ID: ${provider.pk}`);
        console.log(`   Provider Name: ${provider.name}`);
        console.log(`   Application: ${amdwikiApp.name} (${amdwikiApp.slug})`);
        console.log('\n🔑 OAuth2 Credentials:');
        console.log(`   Client ID: ${provider.client_id}`);
        console.log(`   Client Secret: ${provider.client_secret}`);
        console.log('\n🌐 OIDC Configuration:');
        console.log(`   Issuer: https://auth.nerdsbythehour.com/application/o/${amdwikiApp.slug}/`);
        console.log(`   Authorization URL: https://auth.nerdsbythehour.com/application/o/authorize/`);
        console.log(`   Token URL: https://auth.nerdsbythehour.com/application/o/token/`);
        console.log(`   Userinfo URL: https://auth.nerdsbythehour.com/application/o/userinfo/`);
        console.log(`   Redirect URI: ${amdwikiRedirectUri}`);
        console.log('\n📝 Next Steps:');
        console.log('   1. Create Kubernetes secret with OAuth2 credentials:');
        console.log('\n' + '-'.repeat(70));
        console.log(`kubectl create secret generic amdwiki-oauth2-secret -n amdwiki \\
  --from-literal=client-id="${provider.client_id}" \\
  --from-literal=client-secret="${provider.client_secret}"
`);
        console.log('-'.repeat(70));
        console.log('\n   2. Configure JSPWiki OAuth2 in jspwiki-custom.properties:');
        console.log('-'.repeat(70));
        console.log(`
# Authentik OAuth2 Configuration
jspwiki.oauth2.enabled=true
jspwiki.oauth2.client.id=${provider.client_id}
jspwiki.oauth2.client.secret=${provider.client_secret}
jspwiki.oauth2.authorization.url=https://auth.nerdsbythehour.com/application/o/authorize/
jspwiki.oauth2.token.url=https://auth.nerdsbythehour.com/application/o/token/
jspwiki.oauth2.userinfo.url=https://auth.nerdsbythehour.com/application/o/userinfo/
jspwiki.oauth2.redirect.uri=https://amd.nerdsbythehour.com/Wiki.jsp?page=OAuth2Login
jspwiki.oauth2.scope=openid profile email
`);
        console.log('-'.repeat(70));
        console.log('\n   3. Deploy AMDWiki to Kubernetes');
        console.log('   4. Test authentication at: https://amd.nerdsbythehour.com');
        console.log('\n💡 Note: This application shares the same OAuth2 provider as Home Assistant.');
        console.log('   Both applications use the same credentials but appear as separate apps in Authentik.\n');
        console.log('='.repeat(70) + '\n');
    }
    catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response?.data) {
            console.error('Details:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}
main();
