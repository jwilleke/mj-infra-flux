/**
 * Bind Prometheus provider to the embedded outpost
 */

import { AuthentikClient } from './authentik.js';

async function main() {
  const client = new AuthentikClient();

  console.log('🔧 Binding Prometheus provider to embedded outpost\n');
  console.log('='.repeat(70));

  try {
    // List providers to find Prometheus
    console.log('\n1️⃣  Finding Prometheus provider...\n');
    const providers = await client.listProviders();
    const prometheusProvider = providers.find((p: any) =>
      p.name.toLowerCase().includes('prometheus')
    );

    if (!prometheusProvider) {
      console.error('   ❌ Prometheus provider not found!');
      console.log('\n   Available providers:');
      providers.forEach((p: any) => {
        console.log(`   • ${p.name} (ID: ${p.pk})`);
      });
      process.exit(1);
    }

    console.log(`   ✅ Found Prometheus provider (ID: ${prometheusProvider.pk})`);
    console.log(`   • Name: ${prometheusProvider.name}`);
    console.log(`   • Type: ${prometheusProvider.verbose_name || prometheusProvider.type}`);

    // Bind to embedded outpost
    console.log('\n2️⃣  Binding to embedded outpost...\n');
    const outpost = await client.bindProviderToOutpost(prometheusProvider.pk);

    console.log(`   ✅ Provider bound to outpost: ${outpost.name}`);
    console.log(`   • Outpost ID: ${outpost.pk}`);
    console.log(`   • Managed: ${outpost.managed || 'custom'}`);

    console.log('\n✅ Setup complete!\n');
    console.log('='.repeat(70));
    console.log('\nPrometheus ForwardAuth should now be working!');
    console.log('Test access at: https://prometheus.nerdsbythehour.com');
    console.log('='.repeat(70) + '\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
