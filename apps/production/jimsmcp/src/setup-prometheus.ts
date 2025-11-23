/**
 * Setup Prometheus application in Authentik with ForwardAuth proxy provider
 */

import { AuthentikClient } from './authentik.js';

async function main() {
  const client = new AuthentikClient();

  console.log('🔧 Setting up Prometheus in Authentik\n');
  console.log('='.repeat(70));

  try {
    // Check if Prometheus already exists
    console.log('\n1️⃣  Checking existing applications...\n');
    const existingApps = await client.listApplications();
    const prometheusApp = existingApps.find((app: any) => app.slug === 'prometheus');

    if (prometheusApp) {
      console.log('   ✅ Prometheus application already exists!');
      console.log(`   • Name: ${prometheusApp.name}`);
      console.log(`   • Slug: ${prometheusApp.slug}`);
      console.log('='.repeat(70) + '\n');
      return;
    }

    // Create Prometheus provider and application
    console.log('   Prometheus not found. Creating...\n');
    console.log('2️⃣  Creating provider and application...\n');

    // Create proxy provider for ForwardAuth
    const provider = await client.createProxyProvider({
      name: 'Prometheus Provider',
      externalHost: 'https://prometheus.nerdsbythehour.com',
      internalHost: 'http://prometheus-service.monitoring.svc.cluster.local',
      internalHostSslValidation: false,
      forwardAuthMode: true,
    });

    console.log(`   ✅ Created provider (ID: ${provider.pk})`);

    // Create application
    const app = await client.createApplication({
      name: 'Prometheus',
      slug: 'prometheus',
      providerId: provider.pk,
      group: 'mj',
    });

    console.log(`   ✅ Created application (slug: ${app.slug})`);

    console.log('\n✅ Setup complete!\n');
    console.log('='.repeat(70));
    console.log('\nNext steps:');
    console.log('1. Verify the ingress has the middleware annotation:');
    console.log('   traefik.ingress.kubernetes.io/router.middlewares: monitoring-authentik-forwardauth@kubernetescrd');
    console.log('2. Test access at: https://prometheus.nerdsbythehour.com');
    console.log('3. Configure authorization policies in Authentik if needed');
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
