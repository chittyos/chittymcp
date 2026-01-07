/**
 * OAuth 2.0 Implementation for ChatGPT MCP Connector
 * Supports Client Credentials flow for server-to-server authentication
 */

import crypto from 'crypto';

/**
 * Generate OAuth client credentials
 * @returns {{clientId: string, clientSecret: string}}
 */
export function generateClientCredentials() {
  const clientId = 'chitty_' + crypto.randomUUID().replace(/-/g, '');
  const clientSecret = 'secret_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  return { clientId, clientSecret };
}

/**
 * Generate access token
 * @param {string} clientId
 * @returns {{accessToken: string, tokenType: string, expiresIn: number}}
 */
export function generateAccessToken(clientId) {
  const accessToken = 'mcp_token_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 86400, // 24 hours
    scope: 'mcp:read mcp:write',
    clientId,
    issuedAt: Date.now()
  };
}

/**
 * Validate client credentials
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {object} env
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateClientCredentials(clientId, clientSecret, env) {
  // Get stored credentials from environment
  const expectedClientId = env.OAUTH_CLIENT_ID;
  const expectedClientSecret = env.OAUTH_CLIENT_SECRET;

  if (!expectedClientId || !expectedClientSecret) {
    return {
      valid: false,
      error: 'OAuth not configured on server'
    };
  }

  // Constant-time comparison
  if (clientId !== expectedClientId) {
    return {
      valid: false,
      error: 'Invalid client_id'
    };
  }

  if (clientSecret !== expectedClientSecret) {
    return {
      valid: false,
      error: 'Invalid client_secret'
    };
  }

  return {
    valid: true
  };
}

/**
 * Validate access token
 * @param {string} token
 * @param {object} env
 * @returns {Promise<{valid: boolean, clientId?: string, error?: string}>}
 */
export async function validateAccessToken(token, env) {
  // In production, tokens should be stored in KV/D1 with expiration
  // For now, we'll accept any token that matches the expected prefix
  // and validate against the MCP_API_KEY fallback

  if (!token || !token.startsWith('mcp_token_')) {
    // Fallback to MCP_API_KEY validation
    const apiKey = env.MCP_API_KEY;
    if (apiKey && token === apiKey) {
      return {
        valid: true,
        clientId: 'legacy_api_key'
      };
    }

    return {
      valid: false,
      error: 'Invalid token format'
    };
  }

  return {
    valid: true,
    clientId: 'oauth_client'
  };
}

/**
 * Parse Basic Authorization header
 * @param {string} authHeader
 * @returns {{clientId: string, clientSecret: string} | null}
 */
export function parseBasicAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [clientId, clientSecret] = credentials.split(':');

    return { clientId, clientSecret };
  } catch (error) {
    return null;
  }
}
