#!/usr/bin/env node
/**
 * Check Home Assistant proxy provider detailed configuration
 */

import { AuthentikClient } from './dist/authentik.js';
import axios from 'axios';
import { execSync } from 'child_process';

async function main() {
  try {
    console.log('🔍 Checking Home Assistant proxy provider configuration...\n');
    const client = new AuthentikClient();

    const data = JSON.parse(
      execSync('bao kv get -format=json kv/deby/workstation/mcp-authentik', { encoding: 'utf8' })
    ).data.data;
    const baseUrl = data.AUTHENTIK_BASE_URL;
    const token = data.AUTHENTIK_TOKEN;

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
