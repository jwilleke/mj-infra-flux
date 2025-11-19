#!/usr/bin/env node
/**
 * Check Home Assistant provider configuration
 */

import { AuthentikClient } from './dist/authentik.js';

async function main() {
  try {
    console.log('🔍 Checking Home Assistant provider configuration...\n');
    const client = new AuthentikClient();

    // List all providers
    const providers = await client.listProviders();
    const haProvider = providers.find(p => p.pk === 4);

    if (!haProvider) {
      console.error('❌ Provider ID 4 not found!');
      return;
    }

    console.log('Provider Details:');
    console.log(JSON.stringify(haProvider, null, 2));

    // List all applications
    const apps = await client.listApplications();
    const haApp = apps.find(a => a.name === 'Home Assistant');

    if (!haApp) {
      console.error('\n❌ Home Assistant application not found!');
      return;
    }

    console.log('\n\nApplication Details:');
    console.log(JSON.stringify(haApp, null, 2));

    // Check outposts
    const outposts = await client.listOutposts();
    const embeddedOutpost = outposts.find(o => o.name.includes('Embedded'));

    console.log('\n\nOutpost Details:');
    console.log(JSON.stringify(embeddedOutpost, null, 2));

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
