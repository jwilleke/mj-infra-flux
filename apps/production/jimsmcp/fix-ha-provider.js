#!/usr/bin/env node
/**
 * Fix Home Assistant provider configuration
 */

import axios from 'axios';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

async function main() {
  try {
    console.log('🔍 Fixing Home Assistant provider configuration...\n');

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

    const client = axios.create({
      baseURL: `${baseUrl}/api/v3`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📝 Updating provider with correct configuration...');
    const response = await client.patch('/providers/proxy/4/', {
      external_host: 'https://ha.nerdsbythehour.com',
      internal_host: 'http://192.168.68.20:8123',
      mode: 'forward_domain',
    });

    console.log('\n✅ Provider updated successfully!');
    console.log('\nUpdated configuration:');
    console.log(`  External host: ${response.data.external_host}`);
    console.log(`  Internal host: ${response.data.internal_host}`);
    console.log(`  Mode: ${response.data.mode}`);

    console.log('\n✨ Home Assistant should now be accessible at https://ha.nerdsbythehour.com');
    console.log('   Try refreshing your browser (Ctrl+Shift+R / Cmd+Shift+R)');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
