/**
 * Authentik API client for managing applications and providers
 */
import axios from 'axios';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
export class AuthentikClient {
    client;
    config;
    constructor() {
        this.config = this.loadConfig();
        this.client = axios.create({
            baseURL: `${this.config.baseUrl}/api/v3`,
            headers: {
                'Authorization': `Bearer ${this.config.token}`,
                'Content-Type': 'application/json',
            },
        });
    }
    loadConfig() {
        try {
            // Try to load from encrypted env file using SOPS
            const repoDir = join(homedir(), 'Documents', 'mj-infra-flux');
            const encryptedFile = join(repoDir, '.env.secret.mcp-authentik.encrypted');
            const ageKeyFile = join(repoDir, 'home-infra-private.agekey');
            // Decrypt using SOPS
            const decrypted = execSync(`SOPS_AGE_KEY_FILE="${ageKeyFile}" sops decrypt --input-type dotenv --output-type dotenv "${encryptedFile}"`, { encoding: 'utf8' });
            const config = {
                baseUrl: '',
                token: '',
            };
            // Parse the decrypted env content
            decrypted.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                if (key === 'AUTHENTIK_BASE_URL') {
                    config.baseUrl = value;
                }
                else if (key === 'AUTHENTIK_TOKEN') {
                    config.token = value;
                }
            });
            if (!config.baseUrl || !config.token) {
                throw new Error('Missing AUTHENTIK_BASE_URL or AUTHENTIK_TOKEN in encrypted config');
            }
            return config;
        }
        catch (error) {
            throw new Error(`Failed to load Authentik config: ${error}`);
        }
    }
    /**
     * Create a Proxy Provider for Home Assistant
     */
    async createProxyProvider(options) {
        const providerData = {
            name: options.name,
            authorization_flow: await this.getDefaultAuthorizationFlow(),
            external_host: options.externalHost,
            internal_host: options.internalHost,
            internal_host_ssl_validation: options.internalHostSslValidation ?? false,
            mode: options.forwardAuthMode ? 'forward_domain' : 'forward_single',
            access_token_validity: 'hours=24',
        };
        const response = await this.client.post('/providers/proxy/', providerData);
        return response.data;
    }
    /**
     * Create an Application
     */
    async createApplication(options) {
        const appData = {
            name: options.name,
            slug: options.slug,
            provider: options.providerId,
            meta_launch_url: '',
            group: options.group || '',
        };
        const response = await this.client.post('/core/applications/', appData);
        return response.data;
    }
    /**
     * Get default authorization flow
     */
    async getDefaultAuthorizationFlow() {
        try {
            const response = await this.client.get('/flows/instances/?designation=authorization');
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
        catch (error) {
            throw new Error(`Failed to get authorization flow: ${error}`);
        }
    }
    /**
     * Create Home Assistant proxy application (complete setup)
     */
    async createHomeAssistantApp() {
        try {
            // Create the proxy provider
            const provider = await this.createProxyProvider({
                name: 'Home Assistant Provider',
                externalHost: 'https://ha.nerdsbythehour.com',
                internalHost: 'https://192.168.68.20:8123',
                internalHostSslValidation: false, // Self-signed cert on HA
                forwardAuthMode: true, // Forward auth at domain level
            });
            console.log(`✅ Created provider with ID: ${provider.pk}`);
            // Create the application
            const app = await this.createApplication({
                name: 'Home Assistant',
                slug: 'homeassistant',
                providerId: provider.pk,
            });
            console.log(`✅ Created application with slug: ${app.slug}`);
            return {
                provider,
                application: app,
                urls: {
                    app: `${this.config.baseUrl}/if/admin/#/core/applications/${app.slug}`,
                    provider: `${this.config.baseUrl}/if/admin/#/core/providers/${provider.pk}`,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to create Home Assistant app: ${error.message || error}`);
        }
    }
    /**
     * List all applications
     */
    async listApplications() {
        const response = await this.client.get('/core/applications/');
        return response.data.results;
    }
    /**
     * List all providers
     */
    async listProviders() {
        const response = await this.client.get('/providers/all/');
        return response.data.results;
    }
    /**
     * List all outposts
     */
    async listOutposts() {
        const response = await this.client.get('/outposts/instances/');
        return response.data.results;
    }
    /**
     * Get embedded outpost (usually the first one)
     */
    async getEmbeddedOutpost() {
        const outposts = await this.listOutposts();
        // Find the embedded outpost (usually named "authentik Embedded Outpost")
        const embeddedOutpost = outposts.find((o) => o.name.toLowerCase().includes('embedded') || o.managed === 'goauthentik.io/outposts/embedded');
        if (!embeddedOutpost) {
            throw new Error('No embedded outpost found');
        }
        return embeddedOutpost;
    }
    /**
     * Bind a provider to an outpost
     */
    async bindProviderToOutpost(providerId, outpostId) {
        try {
            // If no outpost ID provided, use embedded outpost
            const outpost = outpostId
                ? await this.client.get(`/outposts/instances/${outpostId}/`).then(r => r.data)
                : await this.getEmbeddedOutpost();
            // Get current providers for this outpost
            const currentProviders = outpost.providers || [];
            // Add the new provider if not already included
            if (!currentProviders.includes(providerId)) {
                currentProviders.push(providerId);
                // Update the outpost with the new provider list
                const response = await this.client.patch(`/outposts/instances/${outpost.pk}/`, {
                    providers: currentProviders,
                });
                return response.data;
            }
            return outpost;
        }
        catch (error) {
            throw new Error(`Failed to bind provider to outpost: ${error.message || error}`);
        }
    }
    /**
     * Create Home Assistant application and bind to outpost (complete setup)
     */
    async createHomeAssistantAppComplete() {
        try {
            // Create the application
            const result = await this.createHomeAssistantApp();
            // Bind the provider to the embedded outpost
            console.log(`🔗 Binding provider ${result.provider.pk} to embedded outpost...`);
            const outpost = await this.bindProviderToOutpost(result.provider.pk);
            console.log(`✅ Provider bound to outpost: ${outpost.name}`);
            return {
                ...result,
                outpost: {
                    id: outpost.pk,
                    name: outpost.name,
                },
            };
        }
        catch (error) {
            throw new Error(`Failed to create complete Home Assistant setup: ${error.message || error}`);
        }
    }
}
