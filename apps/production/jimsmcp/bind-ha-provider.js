#!/usr/bin/env node
/**
 * Bind Home Assistant provider (ID 4) to the embedded outpost
 */

import { AuthentikClient } from './dist/authentik.js';

async function main() {
  try {
    console.log('🔍 Initializing Authentik client...');
    const client = new AuthentikClient();

    console.log('📋 Listing outposts...');
    const outposts = await client.listOutposts();
    console.log(`Found ${outposts.length} outposts:`);
    outposts.forEach((o) => {
      console.log(`  - ${o.name} (ID: ${o.pk})`);
      console.log(`    Providers: ${o.providers?.join(', ') || 'none'}`);
    });

    console.log('\n🔗 Binding provider 4 (Home Assistant) to embedded outpost...');
    const outpost = await client.bindProviderToOutpost(4);

    console.log(`\n✅ Success! Provider 4 is now bound to: ${outpost.name}`);
    console.log(`Providers on this outpost: ${outpost.providers?.join(', ')}`);

    console.log('\n✨ Home Assistant should now be accessible at https://ha.nerdsbythehour.com');
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
