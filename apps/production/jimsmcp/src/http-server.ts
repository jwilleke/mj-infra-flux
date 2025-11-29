#!/usr/bin/env node

import { createServer, IncomingMessage, ServerResponse } from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";

// Import the existing server configuration
import { server } from "./index.js";

const PORT = process.env.PORT || 3000;

// Create StreamableHTTPServerTransport
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

// Connect the server to the transport
await server.connect(transport);

// Create HTTP server
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle MCP requests
  if (req.url === "/mcp" || req.url?.startsWith("/mcp")) {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const parsedBody = body ? JSON.parse(body) : undefined;
        await transport.handleRequest(req, res, parsedBody);
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request" }));
      }
    });
  } else if (req.url === "/health") {
    // Health check endpoint
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

httpServer.listen(PORT, () => {
  console.log(`jimsmcp HTTP/SSE server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
