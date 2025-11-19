/**
 * Authentik API client for managing applications and providers
 */

import axios, { AxiosInstance } from 'axios';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

export interface AuthentikConfig {
  baseUrl: string;
  token: string;
}

export class AuthentikClient {
  private client: AxiosInstance;
  private config: AuthentikConfig;

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

  private loadConfig(): AuthentikConfig {
    try {
      // Try to load from encrypted env file using SOPS
      const repoDir = join(homedir(), 'Documents', 'mj-infra-flux');
      const encryptedFile = join(repoDir, '.env.secret.mcp-authentik.encrypted');
      const ageKeyFile = join(repoDir, 'home-infra-private.agekey');

      // Decrypt using SOPS
      const decrypted = execSync(
        `SOPS_AGE_KEY_FILE="${ageKeyFile}" sops decrypt --input-type dotenv --output-type dotenv "${encryptedFile}"`,
        { encoding: 'utf8' }
      );

      const config: AuthentikConfig = {
        baseUrl: '',
        token: '',
      };

      // Parse the decrypted env content
      decrypted.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        if (key === 'AUTHENTIK_BASE_URL') {
          config.baseUrl = value;
        } else if (key === 'AUTHENTIK_TOKEN') {
          config.token = value;
        }
      });

      if (!config.baseUrl || !config.token) {
        throw new Error('Missing AUTHENTIK_BASE_URL or AUTHENTIK_TOKEN in encrypted config');
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to load Authentik config: ${error}`);
    }
  }

  /**
   * Create a Proxy Provider for Home Assistant
   */
  async createProxyProvider(options: {
    name: string;
    externalHost: string;
    internalHost: string;
    internalHostSslValidation?: boolean;
    forwardAuthMode?: boolean;
  }) {
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
  async createApplication(options: {
    name: string;
    slug: string;
    providerId: number;
    group?: string;
  }) {
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
  private async getDefaultAuthorizationFlow(): Promise<string> {
    try {
      const response = await this.client.get('/flows/instances/?designation=authorization');
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
    } catch (error) {
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
        internalHostSslValidation: false,  // Self-signed cert on HA
        forwardAuthMode: true,  // Forward auth at domain level
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
    } catch (error: any) {
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
}
