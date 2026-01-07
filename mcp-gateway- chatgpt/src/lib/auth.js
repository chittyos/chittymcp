/**
 * Authentication Library
 * Handles API key and OAuth token validation for ChatGPT MCP Gateway
 */

import { validateAccessToken } from './oauth.js';

/**
 * Authenticate incoming request
 * Supports:
 * - OAuth Bearer token authentication
 * - Legacy Bearer token authentication (MCP_API_KEY)
 * - Public access (if neither is configured)
 *
 * @param {Context} c - Hono context
 * @returns {Promise<{success: boolean, context?: object, error?: string}>}
 */
export async function authenticateRequest(c) {
  const env = c.env;

  // Extract Authorization header
  const authHeader = c.req.header('Authorization');

  // Check if authentication is configured
  const apiKey = env.MCP_API_KEY;
  const oauthConfigured = env.OAUTH_CLIENT_ID && env.OAUTH_CLIENT_SECRET;

  if (!apiKey && !oauthConfigured) {
    // No authentication configured - allow public access
    console.warn('No authentication configured - running in public mode');
    return {
      success: true,
      context: {
        authenticated: false,
        mode: 'public'
      }
    };
  }

  if (!authHeader) {
    return {
      success: false,
      error: 'Authorization header required'
    };
  }

  // Parse Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      success: false,
      error: 'Invalid Authorization header format. Expected: Bearer <token>'
    };
  }

  const providedToken = match[1];

  // Try OAuth token validation first
  if (oauthConfigured) {
    const oauthResult = await validateAccessToken(providedToken, env);
    if (oauthResult.valid) {
      return {
        success: true,
        context: {
          authenticated: true,
          mode: 'oauth',
          clientId: oauthResult.clientId,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Fall back to API key validation
  if (apiKey) {
    const isValid = await constantTimeCompare(providedToken, apiKey);

    if (isValid) {
      return {
        success: true,
        context: {
          authenticated: true,
          mode: 'api_key',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  return {
    success: false,
    error: 'Invalid token'
  };
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a
 * @param {string} b
 * @returns {Promise<boolean>}
 */
async function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Use Web Crypto API for constant-time comparison
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  // Hash both strings and compare hashes
  const aHash = await crypto.subtle.digest('SHA-256', aBytes);
  const bHash = await crypto.subtle.digest('SHA-256', bBytes);

  const aArray = new Uint8Array(aHash);
  const bArray = new Uint8Array(bHash);

  let result = 0;
  for (let i = 0; i < aArray.length; i++) {
    result |= aArray[i] ^ bArray[i];
  }

  return result === 0;
}

/**
 * Validate ChittyOS service token
 * Used for inter-service communication
 *
 * @param {string} token
 * @param {string} service - Service name (e.g., 'CHITTY_ID')
 * @param {object} env - Environment bindings
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function validateServiceToken(token, service, env) {
  const expectedTokenKey = `CHITTY_${service.toUpperCase()}_SERVICE_TOKEN`;
  const expectedToken = env[expectedTokenKey];

  if (!expectedToken) {
    return {
      success: false,
      error: `Service token not configured: ${expectedTokenKey}`
    };
  }

  const isValid = await constantTimeCompare(token, expectedToken);

  if (!isValid) {
    return {
      success: false,
      error: 'Invalid service token'
    };
  }

  return {
    success: true
  };
}
