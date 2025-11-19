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
const TOOLS: Tool[] = [
  {
    name: "k8s_get_pods",
    description: "Get pods in a namespace or across all namespaces",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Namespace to query (optional, default: all namespaces)",
        },
        labelSelector: {
          type: "string",
          description: "Label selector to filter pods (e.g., 'app=grafana')",
        },
      },
    },
  },
  {
    name: "k8s_get_pod_logs",
    description: "Get logs from a specific pod",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Namespace of the pod",
        },
        podName: {
          type: "string",
          description: "Name of the pod",
        },
        container: {
          type: "string",
          description: "Container name (optional, uses first container if not specified)",
        },
        tailLines: {
          type: "number",
          description: "Number of lines to tail (default: 100)",
        },
      },
      required: ["namespace", "podName"],
    },
  },
  {
    name: "k8s_get_deployments",
    description: "Get deployments in a namespace or across all namespaces",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Namespace to query (optional, default: all namespaces)",
        },
      },
    },
  },
  {
    name: "k8s_get_services",
    description: "Get services in a namespace or across all namespaces",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Namespace to query (optional, default: all namespaces)",
        },
      },
    },
  },
  {
    name: "k8s_get_ingresses",
    description: "Get ingresses in a namespace or across all namespaces",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Namespace to query (optional, default: all namespaces)",
        },
      },
    },
  },
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
      case "k8s_get_pods": {
        const namespace = (args?.namespace as string) || undefined;
        const labelSelector = (args?.labelSelector as string) || undefined;

        if (namespace) {
          const response = await k8sApi.listNamespacedPod(
            namespace,
            undefined,
            undefined,
            undefined,
            undefined,
            labelSelector
          );
          const pods = response.body.items.map((pod) => ({
            name: pod.metadata?.name,
            namespace: pod.metadata?.namespace,
            status: pod.status?.phase,
            ready: pod.status?.conditions?.find((c) => c.type === "Ready")?.status,
            restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
            age: pod.metadata?.creationTimestamp,
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(pods, null, 2) }],
          };
        } else {
          const response = await k8sApi.listPodForAllNamespaces(
            undefined,
            undefined,
            undefined,
            labelSelector
          );
          const pods = response.body.items.map((pod) => ({
            name: pod.metadata?.name,
            namespace: pod.metadata?.namespace,
            status: pod.status?.phase,
            ready: pod.status?.conditions?.find((c) => c.type === "Ready")?.status,
            restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
            age: pod.metadata?.creationTimestamp,
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(pods, null, 2) }],
          };
        }
      }

      case "k8s_get_pod_logs": {
        const namespace = args?.namespace as string;
        const podName = args?.podName as string;
        const container = (args?.container as string) || undefined;
        const tailLines = (args?.tailLines as number) || 100;

        const logs = await k8sApi.readNamespacedPodLog(
          podName,
          namespace,
          container,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          tailLines
        );

        return {
          content: [{ type: "text", text: logs.body }],
        };
      }

      case "k8s_get_deployments": {
        const namespace = (args?.namespace as string) || undefined;

        if (namespace) {
          const response = await k8sAppsApi.listNamespacedDeployment(namespace);
          const deployments = response.body.items.map((dep) => ({
            name: dep.metadata?.name,
            namespace: dep.metadata?.namespace,
            replicas: dep.status?.replicas,
            ready: dep.status?.readyReplicas,
            upToDate: dep.status?.updatedReplicas,
            available: dep.status?.availableReplicas,
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(deployments, null, 2) }],
          };
        } else {
          const response = await k8sAppsApi.listDeploymentForAllNamespaces();
          const deployments = response.body.items.map((dep) => ({
            name: dep.metadata?.name,
            namespace: dep.metadata?.namespace,
            replicas: dep.status?.replicas,
            ready: dep.status?.readyReplicas,
            upToDate: dep.status?.updatedReplicas,
            available: dep.status?.availableReplicas,
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(deployments, null, 2) }],
          };
        }
      }

      case "k8s_get_services": {
        const namespace = (args?.namespace as string) || undefined;

        if (namespace) {
          const response = await k8sApi.listNamespacedService(namespace);
          const services = response.body.items.map((svc) => ({
            name: svc.metadata?.name,
            namespace: svc.metadata?.namespace,
            type: svc.spec?.type,
            clusterIP: svc.spec?.clusterIP,
            ports: svc.spec?.ports?.map((p) => ({
              name: p.name,
              port: p.port,
              targetPort: p.targetPort,
            })),
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(services, null, 2) }],
          };
        } else {
          const response = await k8sApi.listServiceForAllNamespaces();
          const services = response.body.items.map((svc) => ({
            name: svc.metadata?.name,
            namespace: svc.metadata?.namespace,
            type: svc.spec?.type,
            clusterIP: svc.spec?.clusterIP,
            ports: svc.spec?.ports?.map((p) => ({
              name: p.name,
              port: p.port,
              targetPort: p.targetPort,
            })),
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(services, null, 2) }],
          };
        }
      }

      case "k8s_get_ingresses": {
        const namespace = (args?.namespace as string) || undefined;
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

        if (namespace) {
          const response = await k8sNetworkingApi.listNamespacedIngress(namespace);
          const ingresses = response.body.items.map((ing) => ({
            name: ing.metadata?.name,
            namespace: ing.metadata?.namespace,
            hosts: ing.spec?.rules?.map((r) => r.host),
            paths: ing.spec?.rules?.flatMap((r) =>
              r.http?.paths?.map((p) => ({
                path: p.path,
                backend: p.backend.service?.name,
              }))
            ),
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(ingresses, null, 2) }],
          };
        } else {
          const response = await k8sNetworkingApi.listIngressForAllNamespaces();
          const ingresses = response.body.items.map((ing) => ({
            name: ing.metadata?.name,
            namespace: ing.metadata?.namespace,
            hosts: ing.spec?.rules?.map((r) => r.host),
            paths: ing.spec?.rules?.flatMap((r) =>
              r.http?.paths?.map((p) => ({
                path: p.path,
                backend: p.backend.service?.name,
              }))
            ),
          }));
          return {
            content: [{ type: "text", text: JSON.stringify(ingresses, null, 2) }],
          };
        }
      }

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
            name: svcResponse.body.metadata?.name,
            type: svcResponse.body.spec?.type,
            clusterIP: svcResponse.body.spec?.clusterIP,
          };
        } catch (e) {
          service = null;
        }

        // Get ingress
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
        let ingress;
        try {
          const ingResponse = await k8sNetworkingApi.listNamespacedIngress(namespace);
          const matchingIngress = ingResponse.body.items.find((ing) =>
            ing.spec?.rules?.some((r) =>
              r.http?.paths?.some((p) => p.backend.service?.name === app)
            )
          );
          if (matchingIngress) {
            ingress = {
              name: matchingIngress.metadata?.name,
              hosts: matchingIngress.spec?.rules?.map((r) => r.host),
            };
          }
        } catch (e) {
          ingress = null;
        }

        const health = {
          app,
          namespace,
          pods: podsResponse.body.items.map((pod) => ({
            name: pod.metadata?.name,
            status: pod.status?.phase,
            ready: pod.status?.conditions?.find((c) => c.type === "Ready")?.status,
            restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
          })),
          service,
          ingress,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(health, null, 2) }],
        };
      }

      case "app_get_urls": {
        const namespace = (args?.namespace as string) || undefined;
        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

        let response;
        if (namespace) {
          response = await k8sNetworkingApi.listNamespacedIngress(namespace);
        } else {
          response = await k8sNetworkingApi.listIngressForAllNamespaces();
        }

        const urls = response.body.items.flatMap((ing) => {
          const tlsHosts = ing.spec?.tls?.flatMap((t) => t.hosts || []) || [];
          return (
            ing.spec?.rules?.map((r) => ({
              app: ing.metadata?.name,
              namespace: ing.metadata?.namespace,
              url: `${tlsHosts.includes(r.host || "") ? "https" : "http"}://${r.host}`,
              paths: r.http?.paths?.map((p) => p.path) || ["/"],
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
        const podsResponse = await k8sApi.listNamespacedPod(
          namespace,
          undefined,
          undefined,
          undefined,
          undefined,
          "app.kubernetes.io/name=authentik"
        );

        const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
        const ingressResponse = await k8sNetworkingApi.listNamespacedIngress(namespace);

        const authentikIngress = ingressResponse.body.items.find(
          (ing) => ing.metadata?.name === "authentik"
        );

        const info = {
          namespace,
          pods: podsResponse.body.items.map((pod) => ({
            name: pod.metadata?.name,
            status: pod.status?.phase,
            ready: pod.status?.conditions?.find((c) => c.type === "Ready")?.status,
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("jimsmcp MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
