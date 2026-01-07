/**
 * ChatGPT MCP Gateway - Unified MCP Server for ChatGPT
 * Consolidates all ChittyOS tools and services
 *
 * Protocol: JSON-RPC 2.0 over HTTP (MCP Protocol 2024-11-05)
 * Routes: https://mcp.chitty.cc/*
 *
 * ChittyOS Legal Technology Platform
 * Copyright (c) 2025 ChittyCorp LLC
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { jsonRpcHandler } from './handlers/jsonrpc.js';
import { toolRegistry } from './tools/registry.js';
import { authenticateRequest } from './lib/auth.js';
import { validateClientCredentials, generateAccessToken, parseBasicAuth, validateAccessToken } from './lib/oauth.js';

const app = new Hono();

// CORS middleware for ChatGPT origins
app.use('/*', cors({
  origin: ['https://chat.openai.com', 'https://chatgpt.com'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Logging middleware
app.use('/*', logger());

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'ChatGPT MCP Gateway',
    version: '1.0.0',
    protocol: 'MCP 2024-11-05',
    transport: 'HTTP/JSON-RPC 2.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * MCP Discovery document
 * GET /.well-known/mcp.json
 */
app.get('/.well-known/mcp.json', (c) => {
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({
    schema_version: '2024-11-05',
    issuer: 'https://mcp.chitty.cc',
    authorization_endpoint: 'https://mcp.chitty.cc/oauth/authorize',
    token_endpoint: 'https://mcp.chitty.cc/oauth/token',
    scopes_supported: ['mcp:read', 'mcp:write'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    jwks_uri: 'https://auth.chitty.cc/v1/oauth/jwks',
    service: {
      name: 'ChatGPT MCP Gateway',
      manifest: 'https://mcp.chitty.cc/mcp/manifest',
      sse: 'https://mcp.chitty.cc/mcp/sse'
    }
  });
});

/**
 * MCP Manifest endpoint
 * GET /mcp/manifest
 */
app.get('/mcp/manifest', (c) => {
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({
    schema_version: '2024-11-05',
    name: 'chittyos-unified',
    version: '1.0.0',
    description: 'Unified MCP Gateway for ChittyOS - Consolidates all legal technology tools and services',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true
    },
    vendor: {
      name: 'ChittyOS',
      url: 'https://chitty.cc',
      support: 'https://github.com/ChittyOS/chittymcp'
    },
    authentication: {
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://mcp.chitty.cc/oauth/authorize',
          tokenUrl: 'https://mcp.chitty.cc/oauth/token',
          scopes: {
            'mcp:read': 'Read access to MCP tools',
            'mcp:write': 'Write access to MCP tools'
          }
        }
      }
    }
  });
});

/**
 * JSON-RPC 2.0 endpoint for MCP protocol
 * POST /mcp/message
 *
 * Handles:
 * - tools/list
 * - tools/call
 * - resources/list (future)
 * - prompts/list (future)
 */
app.post('/mcp/message', async (c) => {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(c);
    if (!authResult.success) {
      c.header('WWW-Authenticate', 'Bearer realm="mcp", error="invalid_token"');
      return c.json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Authentication failed',
          data: authResult.error
        },
        id: null
      }, 401);
    }

    // Parse JSON-RPC request
    const request = await c.req.json();

    // Validate JSON-RPC structure
    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      return c.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'jsonrpc field must be "2.0"'
        },
        id: request.id || null
      }, 400);
    }

    if (!request.method) {
      return c.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'method field is required'
        },
        id: request.id || null
      }, 400);
    }

    // Handle JSON-RPC request
    const response = await jsonRpcHandler(request, c.env, authResult.context);

    return c.json(response);

  } catch (error) {
    console.error('Error handling MCP request:', error);

    return c.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      },
      id: null
    }, 500);
  }
});

/**
 * Server-Sent Events endpoint (optional, for streaming responses)
 * GET /mcp/sse
 */
app.get('/mcp/sse', async (c) => {
  // Authenticate
  const authResult = await authenticateRequest(c);
  if (!authResult.success) {
    c.header('WWW-Authenticate', 'Bearer realm="mcp", error="invalid_token"');
    return c.json({
      error: 'Authentication failed',
      details: authResult.error
    }, 401);
  }

  // Set SSE headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  // Send initial connection event
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send connection established event
      controller.enqueue(encoder.encode('event: connected\n'));
      controller.enqueue(encoder.encode('data: {"status":"connected","timestamp":"' + new Date().toISOString() + '"}\n\n'));

      // Keep connection alive with periodic ping
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode('event: ping\n'));
          controller.enqueue(encoder.encode('data: {"timestamp":"' + new Date().toISOString() + '"}\n\n'));
        } catch (error) {
          clearInterval(interval);
        }
      }, 30000); // Ping every 30 seconds

      // Cleanup on close
      const cleanup = () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      };

      // Note: In a real implementation, we'd handle client disconnect
      // For now, keep connection open
      setTimeout(cleanup, 300000); // Close after 5 minutes
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});

/**
 * List all available tools (convenience endpoint)
 * GET /mcp/tools
 */
app.get('/mcp/tools', async (c) => {
  const authResult = await authenticateRequest(c);
  if (!authResult.success) {
    c.header('WWW-Authenticate', 'Bearer realm="mcp", error="invalid_token"');
    return c.json({ error: 'Authentication failed' }, 401);
  }

  const tools = toolRegistry.getAllTools();

  return c.json({
    success: true,
    count: tools.length,
    tools: tools,
    categories: toolRegistry.getCategories()
  });
});

/**
 * Get tool by name (convenience endpoint)
 * GET /mcp/tools/:name
 */
app.get('/mcp/tools/:name', async (c) => {
  const authResult = await authenticateRequest(c);
  if (!authResult.success) {
    c.header('WWW-Authenticate', 'Bearer realm="mcp", error="invalid_token"');
    return c.json({ error: 'Authentication failed' }, 401);
  }

  const toolName = c.req.param('name');
  const tool = toolRegistry.getTool(toolName);

  if (!tool) {
    return c.json({
      success: false,
      error: 'Tool not found',
      toolName
    }, 404);
  }

  return c.json({
    success: true,
    tool
  });
});

/**
 * OAuth 2.0 Token Endpoint
 * POST /oauth/token
 *
 * Proxies to ChittyAuth OAuth server
 */
app.post('/oauth/token', async (c) => {
  try {
    // Forward request to ChittyAuth OAuth server
    const response = await fetch('https://auth.chitty.cc/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': c.req.header('content-type') || 'application/x-www-form-urlencoded',
        'Authorization': c.req.header('authorization') || ''
      },
      body: await c.req.raw.clone().text()
    });

    const data = await response.json();

    // Return ChittyAuth's response
    return c.json(data, response.status);

  } catch (error) {
    console.error('OAuth proxy error:', error);
    return c.json({
      error: 'server_error',
      error_description: 'Failed to proxy OAuth request to ChittyAuth'
    }, 500);
  }
});

/**
 * OAuth 2.0 Authorization Endpoint
 * GET /oauth/authorize
 *
 * Proxies to ChittyAuth OAuth server
 */
app.get('/oauth/authorize', async (c) => {
  try {
    const queryString = new URLSearchParams(c.req.query()).toString();
    const url = `https://auth.chitty.cc/v1/oauth/authorize${queryString ? '?' + queryString : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': c.req.header('authorization') || ''
      }
    });

    const data = await response.json();
    return c.json(data, response.status);

  } catch (error) {
    console.error('OAuth authorize proxy error:', error);
    return c.json({
      error: 'server_error',
      error_description: 'Failed to proxy OAuth request to ChittyAuth'
    }, 500);
  }
});

/**
 * Root endpoint
 * GET /
 */
app.get('/', (c) => {
  return c.json({
    service: 'ChatGPT MCP Gateway',
    version: '1.0.0',
    description: 'Unified Model Context Protocol gateway for ChittyOS ecosystem',
    protocol: 'MCP 2024-11-05',
    transport: 'HTTP/JSON-RPC 2.0',
    endpoints: {
      health: '/health',
      manifest: '/mcp/manifest',
      message: '/mcp/message (POST)',
      sse: '/mcp/sse',
      tools: '/mcp/tools',
      oauth: {
        token: '/oauth/token (POST)',
        authorize: '/oauth/authorize'
      }
    },
    documentation: 'https://github.com/ChittyOS/chittymcp',
    support: 'https://chitty.cc'
  });
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    path: c.req.path,
    method: c.req.method
  }, 404);
});

/**
 * Error handler
 */
app.onError((err, c) => {
  console.error('Global error handler:', err);

  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500);
});

export default app;
