#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as k8s from "@kubernetes/client-node";
import { exec } from "child_process";
import { promisify } from "util";
import { AuthentikClient } from "./authentik.js";

const execAsync = promisify(exec);

// Initialize Kubernetes client
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

// Define available tools
// NOTE: Basic K8s operations (pods, logs, deployments, services, ingresses) are now provided
// by the official Kubernetes MCP server. This server focuses on custom/augmented features.
const TOOLS: Tool[] = [
  {
    name: "flux_get_status",
    description: "Get status of all Flux resources or specific kustomizations",
    inputSchema: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          description: "Specific resource to check (e.g., 'kustomization', 'helmrelease')",
        },
        namespace: {
          type: "string",
          description: "Namespace to query (default: flux-system)",
        },
      },
    },
  },
  {
    name: "flux_reconcile",
    description: "Force reconciliation of a Flux resource",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description: "Kind of resource (kustomization, helmrelease, gitrepository)",
          enum: ["kustomization", "helmrelease", "gitrepository"],
        },
        name: {
          type: "string",
          description: "Name of the resource",
        },
        namespace: {
          type: "string",
          description: "Namespace of the resource (default: flux-system)",
        },
        withSource: {
          type: "boolean",
          description: "Also reconcile the source (default: false)",
        },
      },
      required: ["kind", "name"],
    },
  },
  {
    name: "app_health_check",
    description: "Check health of a specific application (pod status, ingress, service)",
    inputSchema: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description: "Application name (e.g., 'grafana', 'teslamate', 'authentik')",
        },
        namespace: {
          type: "string",
          description: "Namespace of the application",
        },
      },
      required: ["app", "namespace"],
    },
  },
  {
    name: "app_health_check_all",
    description: "Check health of all applications in the cluster",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Filter by namespace (optional)",
        },
      },
    },
  },
  {
    name: "app_get_urls",
    description: "Get all URLs/ingresses for applications in the cluster",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Filter by namespace (optional)",
        },
      },
    },
  },
  {
    name: "authentik_get_info",
    description: "Get information about Authentik deployment and API endpoint",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "authentik_create_homeassistant_app",
    description: "Create Home Assistant proxy provider and application in Authentik (complete setup)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "authentik_list_applications",
    description: "List all applications configured in Authentik",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "authentik_list_providers",
    description: "List all providers configured in Authentik",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "authentik_list_outposts",
    description: "List all outposts in Authentik",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "authentik_bind_provider_to_outpost",
    description: "Bind a provider to an outpost (usually the embedded outpost). Required for ForwardAuth to work.",
    inputSchema: {
      type: "object",
      properties: {
        providerId: {
          type: "number",
          description: "The provider ID to bind",
        },
        outpostId: {
          type: "string",
          description: "The outpost ID (optional, defaults to embedded outpost)",
        },
      },
      required: ["providerId"],
    },
  },
  {
    name: "stocks_get_price",
    description: "Get latest stock quote from Alpha Vantage (GLOBAL_QUOTE). Input: { symbol: 'AAPL' }",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol (e.g. AAPL)" },
      },
      required: ["symbol"],
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: "jimsmcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "flux_get_status": {
        const resource = (args?.resource as string) || "all";
        const namespace = (args?.namespace as string) || "flux-system";

        let command = "flux get all --all-namespaces";
        if (resource !== "all") {
          command = `flux get ${resource} -n ${namespace}`;
        }

        const { stdout } = await execAsync(command);
        return {
          content: [{ type: "text", text: stdout }],
        };
      }

      case "flux_reconcile": {
        const kind = args?.kind as string;
        const name = args?.name as string;
        const namespace = (args?.namespace as string) || "flux-system";
        const withSource = (args?.withSource as boolean) || false;

        let command = `flux reconcile ${kind} ${name} -n ${namespace}`;
        if (withSource) {
          command += " --with-source";
        }

        const { stdout } = await execAsync(command);
        return {
          content: [{ type: "text", text: stdout }],
        };
      }

      case "app_health_check": {
        const app = args?.app as string;
        const namespace = args?.namespace as string;

        // Get pod status
        const podsResponse = await k8sApi.listNamespacedPod(
          namespace,
          undefined,
          undefined,
          undefined,
          undefined,
          `app=${app}`
        );

        // Get service
        let service;
        try {
          const svcResponse = await k8sApi.readNamespacedService(app, namespace);
          service = {
            name: (svcResponse as any).metadata?.name,
            type: (svcResponse as any).spec?.type,
            clusterIP: (svcResponse as any).spec?.clusterIP,
          };
        } catch (e) {
          service = null;
        }

        // Get ingress
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
        let ingress;
        try {
          const ingResponse = await k8sNetworkingApi.listNamespacedIngress(namespace);
          const matchingIngress = (ingResponse as any).items.find((ing: any) =>
            ing.spec?.rules?.some((r: any) =>
              r.http?.paths?.some((p: any) => p.backend.service?.name === app)
            )
          );
          if (matchingIngress) {
            ingress = {
              name: matchingIngress.metadata?.name,
              hosts: matchingIngress.spec?.rules?.map((r: any) => r.host),
            };
          }
        } catch (e) {
          ingress = null;
        }

        const health = {
          app,
          namespace,
          pods: (podsResponse as any).items.map((pod: any) => ({
            name: pod.metadata?.name,
            status: pod.status?.phase,
            ready: pod.status?.conditions?.find((c: any) => c.type === "Ready")?.status,
            restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
          })),
          service,
          ingress,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(health, null, 2) }],
        };
      }

      case "app_health_check_all": {
        const filterNamespace = (args?.namespace as string) || undefined;
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

        // Get all ingresses to discover applications
        let ingressResponse;
        if (filterNamespace) {
          ingressResponse = await k8sNetworkingApi.listNamespacedIngress(
            filterNamespace
          );
        } else {
          ingressResponse = await k8sNetworkingApi.listIngressForAllNamespaces();
        }

        // Extract unique app/namespace pairs from ingresses
        const appMap = new Map<string, string>(); // key: "app:namespace"
        (ingressResponse as any).items.forEach((ing: any) => {
          const ns = ing.metadata?.namespace;
          ing.spec?.rules?.forEach((rule: any) => {
            rule.http?.paths?.forEach((path: any) => {
              const appName = path.backend.service?.name;
              if (appName && ns) {
                appMap.set(`${appName}:${ns}`, `${appName}|${ns}`);
              }
            });
          });
        });

        // Check health for each discovered app
        const healthChecks: any[] = [];
        for (const appNamespaceStr of appMap.values()) {
          const [appName, namespace] = appNamespaceStr.split("|");
          try {
            // Get pod status
            const podsResponse = await k8sApi.listNamespacedPod(
              namespace,
              undefined,
              undefined,
              undefined,
              undefined,
              `app=${appName}`
            );

            // Get service
            let service;
            try {
              const svcResponse = await k8sApi.readNamespacedService(appName, namespace);
              service = {
                name: (svcResponse as any).metadata?.name,
                type: (svcResponse as any).spec?.type,
                clusterIP: (svcResponse as any).spec?.clusterIP,
              };
            } catch (e) {
              service = null;
            }

            // Get ingress
            let ingress;
            try {
              const ingResp = await k8sNetworkingApi.listNamespacedIngress(namespace);
              const matchingIngress = (ingResp as any).items.find((ing: any) =>
                ing.spec?.rules?.some((r: any) =>
                  r.http?.paths?.some((p: any) => p.backend.service?.name === appName)
                )
              );
              if (matchingIngress) {
                ingress = {
                  name: matchingIngress.metadata?.name,
                  hosts: matchingIngress.spec?.rules?.map((r: any) => r.host),
                };
              }
            } catch (e) {
              ingress = null;
            }

            const allPodsReady = (podsResponse as any).items.every((pod: any) =>
              pod.status?.conditions?.find((c: any) => c.type === "Ready")?.status === "True"
            );

            const health = {
              app: appName,
              namespace,
              status: (podsResponse as any).items.length === 0 ? "No pods" :
                allPodsReady ? "Healthy" : "Degraded",
              podCount: (podsResponse as any).items.length,
              readyCount: (podsResponse as any).items.filter((pod: any) =>
                pod.status?.conditions?.find((c: any) => c.type === "Ready")?.status === "True"
              ).length,
              restarts: (podsResponse as any).items.reduce((sum: number, pod: any) =>
                sum + (pod.status?.containerStatuses?.[0]?.restartCount || 0), 0),
              service: service ? "Present" : "Missing",
              ingress: ingress ? ingress.hosts?.[0] || "ingress" : "Missing",
            };

            healthChecks.push(health);
          } catch (e) {
            healthChecks.push({
              app: appName,
              namespace,
              status: "Error",
              error: (e as Error).message,
            });
          }
        }

        // Sort by status (degraded first) then by app name
        healthChecks.sort((a, b) => {
          const statusOrder = { "Degraded": 0, "No pods": 1, "Healthy": 2, "Error": 3 };
          const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 4;
          const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 4;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.app.localeCompare(b.app);
        });

        const summary = {
          total: healthChecks.length,
          healthy: healthChecks.filter(h => h.status === "Healthy").length,
          degraded: healthChecks.filter(h => h.status === "Degraded").length,
          noPods: healthChecks.filter(h => h.status === "No pods").length,
          errors: healthChecks.filter(h => h.status === "Error").length,
          apps: healthChecks,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        };
      }

      case "app_get_urls": {
        const namespace = (args?.namespace as string) || undefined;
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

        let response;
        if (namespace) {
          response = await k8sNetworkingApi.listNamespacedIngress({
            name: namespace,
          } as any);
        } else {
          response = await k8sNetworkingApi.listIngressForAllNamespaces({} as any);
        }

        const urls = (response as any).items.flatMap((ing: any) => {
          const tlsHosts = ing.spec?.tls?.flatMap((t: any) => t.hosts || []) || [];
          return (
            ing.spec?.rules?.map((r: any) => ({
              app: ing.metadata?.name,
              namespace: ing.metadata?.namespace,
              url: `${tlsHosts.includes(r.host || "") ? "https" : "http"}://${r.host}`,
              paths: r.http?.paths?.map((p: any) => p.path) || ["/"],
            })) || []
          );
        });

        return {
          content: [{ type: "text", text: JSON.stringify(urls, null, 2) }],
        };
      }

      case "authentik_get_info": {
        // Get Authentik deployment info
        const namespace = "authentik";
        const podsResponse = await k8sApi.listNamespacedPod({
          name: namespace,
          labelSelector: "app.kubernetes.io/name=authentik",
        } as any);

        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
        const ingressResponse = await k8sNetworkingApi.listNamespacedIngress({
          name: namespace,
        } as any);

        const authentikIngress = (ingressResponse as any).items.find(
          (ing: any) => ing.metadata?.name === "authentik"
        );

        const info = {
          namespace,
          pods: (podsResponse as any).items.map((pod: any) => ({
            name: pod.metadata?.name,
            status: pod.status?.phase,
            ready: pod.status?.conditions?.find((c: any) => c.type === "Ready")?.status,
          })),
          apiUrl: authentikIngress?.spec?.rules?.[0]?.host
            ? `https://${authentikIngress.spec.rules[0].host}/api/v3/`
            : "Not found",
          adminUrl: authentikIngress?.spec?.rules?.[0]?.host
            ? `https://${authentikIngress.spec.rules[0].host}/if/admin/`
            : "Not found",
        };

        return {
          content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
        };
      }

      case "authentik_create_homeassistant_app": {
        try {
          const authentikClient = new AuthentikClient();
          const result = await authentikClient.createHomeAssistantApp();

          return {
            content: [{
              type: "text",
              text: `✅ Successfully created Home Assistant application in Authentik!\n\n${JSON.stringify(result, null, 2)}\n\nNext steps:\n1. Configure Home Assistant trusted proxies\n2. Edit /homeassistant/configuration.yaml on 192.168.68.20\n3. Add trusted_proxies for k3s networks\n4. Restart Home Assistant`
            }],
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `❌ Error creating Home Assistant app: ${error.message}`
            }],
            isError: true,
          };
        }
      }

      case "authentik_list_applications": {
        try {
          const authentikClient = new AuthentikClient();
          const apps = await authentikClient.listApplications();

          return {
            content: [{
              type: "text",
              text: JSON.stringify(apps, null, 2)
            }],
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `❌ Error listing applications: ${error.message}`
            }],
            isError: true,
          };
        }
      }

      case "authentik_list_providers": {
        try {
          const authentikClient = new AuthentikClient();
          const providers = await authentikClient.listProviders();

          return {
            content: [{
              type: "text",
              text: JSON.stringify(providers, null, 2)
            }],
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `❌ Error listing providers: ${error.message}`
            }],
            isError: true,
          };
        }
      }

      case "authentik_list_outposts": {
        try {
          const authentikClient = new AuthentikClient();
          const outposts = await authentikClient.listOutposts();

          return {
            content: [{
              type: "text",
              text: JSON.stringify(outposts, null, 2)
            }],
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `❌ Error listing outposts: ${error.message}`
            }],
            isError: true,
          };
        }
      }

      case "authentik_bind_provider_to_outpost": {
        try {
          const authentikClient = new AuthentikClient();
          const providerId = args?.providerId as number;
          const outpostId = args?.outpostId as string | undefined;

          const outpost = await authentikClient.bindProviderToOutpost(providerId, outpostId);

          return {
            content: [{
              type: "text",
              text: `✅ Provider ${providerId} bound to outpost: ${outpost.name}\n\n${JSON.stringify(outpost, null, 2)}`
            }],
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: `❌ Error binding provider to outpost: ${error.message}`
            }],
            isError: true,
          };
        }
      }

      case "stocks_get_price": {
        const symbol = ((args?.symbol as string) || "").toUpperCase().trim();
        if (!symbol) {
          return {
            content: [{ type: "text", text: "Error: symbol is required" }],
            isError: true,
          };
        }

        const apiKey = process.env.ALPHA_VANTAGE_KEY;
        if (!apiKey) {
          return {
            content: [{ type: "text", text: "Error: ALPHA_VANTAGE_KEY not set in environment" }],
            isError: true,
          };
        }

        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
          symbol
        )}&apikey=${encodeURIComponent(apiKey)}`;

        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Alpha Vantage HTTP ${resp.status}`);
          const json = await resp.json();
          const quote = json["Global Quote"] || json;
          return {
            content: [{ type: "text", text: JSON.stringify(quote, null, 2) }],
          };
        } catch (error: any) {
          return {
            content: [{ type: "text", text: `Error fetching quote: ${error.message}` }],
            isError: true,
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Export server for HTTP mode
export { server };

// Start the server
async function main() {
  const mode = process.env.TRANSPORT_MODE || "stdio";

  if (mode === "http") {
    // HTTP mode will be started by http-server.ts
    console.error("jimsmcp configured for HTTP mode - use http-server.ts to start");
    return;
  }

  // Default: stdio mode
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("jimsmcp MCP server running on stdio");
}

// Only run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
