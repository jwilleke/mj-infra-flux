#!/usr/bin/env node
/**
 * Check Home Assistant proxy provider detailed configuration
 */

import { AuthentikClient } from './dist/authentik.js';
import axios from 'axios';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

async function main() {
  try {
    console.log('🔍 Checking Home Assistant proxy provider configuration...\n');
    const client = new AuthentikClient();

    // Get the config
    const repoDir = join(homedir(), 'Documents', 'mj-infra-flux');
    const encryptedFile = join(repoDir, '.env.secret.mcp-authentik.encrypted');
    const ageKeyFile = join(repoDir, 'home-infra-private.agekey');

    const decrypted = execSync(
      `SOPS_AGE_KEY_FILE="${ageKeyFile}" sops decrypt --input-type dotenv --output-type dotenv "${encryptedFile}"`,
      { encoding: 'utf8' }
    );

    let baseUrl = '';
    let token = '';

    decrypted.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key === 'AUTHENTIK_BASE_URL') {
        baseUrl = value;
      } else if (key === 'AUTHENTIK_TOKEN') {
        token = value;
      }
    });

    // Get proxy provider details
    const response = await axios.get(`${baseUrl}/api/v3/providers/proxy/4/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Proxy Provider Detailed Configuration:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

main();
