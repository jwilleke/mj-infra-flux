#!/usr/bin/env node

/**
 * MCP HTTP Client Proxy
 *
 * This proxy allows Claude Desktop (which only supports stdio MCP)
 * to connect to jimsmcp's HTTP/SSE endpoint.
 *
 * Usage in claude_desktop_config.json:
 * {
 *   "jimsmcp": {
 *     "command": "node",
 *     "args": ["/path/to/client-proxy.js", "https://jimsmcp.nerdsbythehour.com/mcp"]
 *   }
 * }
 */

const https = require('https');
const http = require('http');

const MCP_URL = process.argv[2] || 'https://jimsmcp.nerdsbythehour.com/mcp';

let sessionId = null;

// Parse URL
const url = new URL(MCP_URL);
const client = url.protocol === 'https:' ? https : http;

// Read from stdin (messages from Claude Desktop)
let buffer = '';
process.stdin.on('data', async (chunk) => {
  buffer += chunk.toString();

  // Try to parse complete JSON messages
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const message = JSON.parse(line);
      await sendToServer(message);
    } catch (error) {
      console.error('Parse error:', error.message);
    }
  }
});

async function sendToServer(message) {
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (sessionId) {
    options.headers['X-Session-ID'] = sessionId;
  }

  const req = client.request(options, (res) => {
    // Store session ID from response
    if (res.headers['x-session-id']) {
      sessionId = res.headers['x-session-id'];
    }

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        // Send response to Claude Desktop via stdout
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        console.error('Response parse error:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error.message);
  });

  req.write(JSON.stringify(message));
  req.end();
}

process.on('SIGINT', () => {
  process.exit(0);
});

console.error('MCP HTTP Client Proxy started');
console.error('Connecting to:', MCP_URL);
