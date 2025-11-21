/**
 * List all Authentik applications and providers
 */

import { AuthentikClient } from './src/authentik.js';

async function main() {
  const client = new AuthentikClient();

  console.log('📋 Listing Authentik Applications and Providers\n');
  console.log('='.repeat(70));

  try {
    // List applications
    console.log('\n🎯 APPLICATIONS:\n');
    const apps = await client.listApplications();

    if (apps.length === 0) {
      console.log('   No applications found');
    } else {
      apps.forEach((app: any) => {
        console.log(`   • ${app.name}`);
        console.log(`     Slug: ${app.slug}`);
        console.log(`     Provider: ${app.provider || 'None'}`);
        console.log(`     Group: ${app.group || 'None'}`);
        console.log();
      });
    }

    // List providers
    console.log('\n🔌 PROVIDERS:\n');
    const providers = await client.listProviders();

    if (providers.length === 0) {
      console.log('   No providers found');
    } else {
      providers.forEach((provider: any) => {
        console.log(`   • ${provider.name} (ID: ${provider.pk})`);
        console.log(`     Type: ${provider.component || 'Unknown'}`);
        console.log();
      });
    }

    console.log('='.repeat(70) + '\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
