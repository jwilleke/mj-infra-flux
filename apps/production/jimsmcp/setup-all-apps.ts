/**
 * Setup all missing applications in Authentik with ForwardAuth proxy providers
 * Based on dev-notes.md requirements
 */

import { AuthentikClient } from './src/authentik.js';

interface AppConfig {
  name: string;
  slug: string;
  url: string;
  internalUrl?: string;
  group: string;
  description: string;
}

const APPS_TO_ADD: AppConfig[] = [
  {
    name: 'JimsWiki',
    slug: 'jimswiki',
    url: 'https://nerdsbythehour.com/jimswiki',
    group: 'mj',
    description: '38,004 pages wiki',
  },
  {
    name: 'TeslaMate',
    slug: 'teslamate',
    url: 'https://teslamate.nerdsbythehour.com',
    internalUrl: 'http://teslamate.teslamate.svc.cluster.local:4000',
    group: 'mj',
    description: 'Vehicle tracking',
  },
  {
    name: 'Grafana',
    slug: 'grafana',
    url: 'https://grafana.nerdsbythehour.com',
    internalUrl: 'http://grafana.monitoring.svc.cluster.local:3000',
    group: 'mj',
    description: 'Dashboards and monitoring',
  },
];

async function main() {
  const client = new AuthentikClient();

  console.log('🔧 Setting up Authentik applications for ForwardAuth\n');
  console.log('='.repeat(70));

  try {
    // Step 1: List existing applications
    console.log('\n1️⃣  Checking existing applications...\n');
    const existingApps = await client.listApplications();
    const existingSlugs = existingApps.map((app: any) => app.slug);

    console.log(`   Found ${existingApps.length} existing applications:`);
    existingApps.forEach((app: any) => {
      console.log(`   • ${app.name} (${app.slug})`);
    });

    // Filter out apps that already exist
    const appsToCreate = APPS_TO_ADD.filter(app => !existingSlugs.includes(app.slug));

    if (appsToCreate.length === 0) {
      console.log('\n✅ All applications already exist!');
      console.log('='.repeat(70) + '\n');
      return;
    }

    console.log(`\n   Will create ${appsToCreate.length} new applications:\n`);
    appsToCreate.forEach(app => {
      console.log(`   • ${app.name} (${app.slug}) - ${app.description}`);
    });

    // Step 2: Create providers and applications
    console.log('\n2️⃣  Creating providers and applications...\n');

    for (const appConfig of appsToCreate) {
      console.log(`\n   Creating ${appConfig.name}...`);

      try {
        // Create proxy provider for ForwardAuth
        const provider = await client.createProxyProvider({
          name: `${appConfig.name} Provider`,
          externalHost: appConfig.url,
          internalHost: appConfig.internalUrl || appConfig.url,
          internalHostSslValidation: false,
          forwardAuthMode: true,
        });

        console.log(`   ✅ Created provider (ID: ${provider.pk})`);

        // Create application
        const app = await client.createApplication({
          name: appConfig.name,
          slug: appConfig.slug,
          providerId: provider.pk,
          group: appConfig.group,
        });

        console.log(`   ✅ Created application (slug: ${app.slug})`);

        // Bind provider to embedded outpost
        await client.bindProviderToOutpost(provider.pk);
        console.log(`   ✅ Bound provider to embedded outpost`);

      } catch (error: any) {
        console.error(`   ❌ Failed to create ${appConfig.name}:`, error.message);
        if (error.response?.data) {
          console.error('   Details:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }

    // Step 3: Summary
    console.log('\n3️⃣  Verifying final application list...\n');
    const finalApps = await client.listApplications();

    console.log(`   Total applications: ${finalApps.length}\n`);
    finalApps.forEach((app: any) => {
      console.log(`   • ${app.name} (${app.slug})`);
      if (app.group) {
        console.log(`     Group: ${app.group}`);
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log('📋 NEXT STEPS');
    console.log('='.repeat(70));

    console.log('\n📝 For each application, you need to:');
    console.log('   1. Create a Traefik middleware for ForwardAuth');
    console.log('   2. Update the ingress to use the middleware');
    console.log('   3. Configure application-specific settings in Authentik UI');

    console.log('\n🔒 Example Traefik Middleware (adjust namespace):');
    console.log('-'.repeat(70));
    console.log(`
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: authentik-forwardauth
  namespace: <APP_NAMESPACE>
spec:
  forwardAuth:
    address: http://authentik-server.authentik.svc.cluster.local:9000/outpost.goauthentik.io/auth/traefik
    trustForwardHeader: true
    authResponseHeaders:
      - X-authentik-username
      - X-authentik-groups
      - X-authentik-email
      - X-authentik-name
      - X-authentik-uid
`);
    console.log('-'.repeat(70));

    console.log('\n📌 Example Ingress Annotation:');
    console.log(`   traefik.ingress.kubernetes.io/router.middlewares: <NAMESPACE>-authentik-forwardauth@kubernetescrd`);

    console.log('\n💡 To configure group-based access (mj group):');
    console.log('   1. Go to Authentik Admin UI');
    console.log('   2. Navigate to Applications → Select app');
    console.log('   3. Set Policy Bindings to require "mj" group membership');

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
