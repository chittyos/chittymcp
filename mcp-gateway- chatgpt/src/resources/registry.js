/**
 * Resource Registry - lists static and dynamic resources
 */
import { toolRegistry } from '../tools/registry.js';

const resources = [
  {
    name: 'chittyos.docs.quickstart',
    description: 'ChittyOS Quick Start guide for ChatGPT MCP integration',
    mimeType: 'text/markdown',
    getContent: async () => {
      return `# ChittyOS MCP Quick Start\n\n- Use tools via tools/list and tools/call\n- Authentication: Bearer token in Authorization header\n- Health: GET /health\n`;
    }
  },
  {
    name: 'chittyos.docs.endpoints',
    description: 'Gateway endpoints and capabilities overview',
    mimeType: 'application/json',
    getContent: async () => {
      return JSON.stringify({
        endpoints: {
          health: '/health',
          manifest: '/mcp/manifest',
          message: '/mcp/message'
        },
        capabilities: { tools: true, resources: true, prompts: true }
      }, null, 2);
    }
  },
  {
    name: 'chittyos.docs.policies',
    description: 'CORS and rate limit policy reference for gateway and APIs',
    mimeType: 'text/markdown',
    getContent: async () => {
      return `# ChittyOS Gateway Policies\n\n## CORS\n- Allowed origins: https://chat.openai.com, https://chatgpt.com\n- Methods: GET, POST, OPTIONS\n- Headers: Content-Type, Authorization\n- Credentials: true\n\n## Rate Limits\n- Default: 60 requests/minute per IP (API services)\n- Gateway MCP JSON-RPC: subject to platform limits\n\nUpdate per-service settings in their respective Worker code.`;
    }
  },
  {
    name: 'chittyos.tools.catalog',
    description: 'Catalog of available tools generated from registry',
    mimeType: 'application/json',
    getContent: async () => {
      const tools = toolRegistry.getAllTools().map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
        inputSchema: t.inputSchema
      }));
      return JSON.stringify({ count: tools.length, tools }, null, 2);
    }
  },
  {
    name: 'chittyos.health.snapshot',
    description: 'Aggregated health snapshot from local context and env awareness',
    mimeType: 'application/json',
    getContent: async (_args, env = (globalThis?.ENV || {})) => {
      const now = new Date().toISOString();
      const endpoints = {
        gateway: {
          manifest: '/mcp/manifest',
          message: '/mcp/message',
          health: '/health'
        },
        services: {
          chronicle: 'https://chronicle.chitty.cc',
          quality: 'https://quality.chitty.cc',
          id: 'https://id-api.chitty.cc',
          verify: 'https://verify-api.chitty.cc'
        }
      };

      const tokens = {
        CHITTY_ID_SERVICE_TOKEN: !!env?.CHITTY_ID_SERVICE_TOKEN,
        CHITTY_VERIFY_SERVICE_TOKEN: !!env?.CHITTY_VERIFY_SERVICE_TOKEN,
        CHITTY_QUALITY_SERVICE_TOKEN: !!env?.CHITTY_QUALITY_SERVICE_TOKEN,
        CHITTY_CHRONICLE_SERVICE_TOKEN: !!env?.CHITTY_CHRONICLE_SERVICE_TOKEN
      };

      const dbConfigured = !!env?.NEON_DATABASE_URL;

      return JSON.stringify({
        timestamp: now,
        gateway: { status: 'healthy', version: '1.0.0' },
        config: { dbConfigured, tokens },
        endpoints
      }, null, 2);
    }
  }
];

export const resourceRegistry = {
  list() {
    return resources.map(r => ({
      name: r.name,
      description: r.description,
      mimeType: r.mimeType
    }));
  },
  get(name) {
    return resources.find(r => r.name === name) || null;
  }
};
