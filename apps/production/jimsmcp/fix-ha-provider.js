#!/usr/bin/env node
/**
 * Fix Home Assistant provider configuration
 */

import axios from 'axios';
import { execSync } from 'child_process';

async function main() {
  try {
    console.log('🔍 Fixing Home Assistant provider configuration...\n');

    const data = JSON.parse(
      execSync('bao kv get -format=json kv/deby/workstation/mcp-authentik', { encoding: 'utf8' })
    ).data.data;
    const baseUrl = data.AUTHENTIK_BASE_URL;
    const token = data.AUTHENTIK_TOKEN;

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
