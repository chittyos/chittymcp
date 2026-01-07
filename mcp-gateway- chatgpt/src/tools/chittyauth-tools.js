/**
 * ChittyAuth Tools
 * Token provisioning and authentication
 * Service: https://auth.chitty.cc
 */

export const chittyAuthTools = [
  {
    name: 'chitty_provision_token',
    description: 'Provision a new API token for ChittyOS services. Generates JWT-based token with specified scopes and expiration.',
    category: 'authentication',
    service: 'chittyauth',
    endpoint: 'https://auth.chitty.cc/api/v1/tokens/provision',
    inputSchema: {
      type: 'object',
      properties: {
        chittyId: {
          type: 'string',
          description: 'ChittyID of the entity requesting the token'
        },
        scopes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Permission scopes (e.g., chittyid:read, chittyverify:write)',
          default: ['basic:read']
        },
        expiresIn: {
          type: 'number',
          description: 'Token lifetime in seconds (max 2592000 = 30 days)',
          default: 86400,
          minimum: 300,
          maximum: 2592000
        },
        description: {
          type: 'string',
          description: 'Human-readable token description'
        }
      },
      required: ['chittyId']
    }
  },
  {
    name: 'chitty_validate_token',
    description: 'Validate an API token and return its metadata, scopes, and expiration status.',
    category: 'authentication',
    service: 'chittyauth',
    endpoint: 'https://auth.chitty.cc/api/v1/tokens/validate',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'API token to validate'
        }
      },
      required: ['token']
    }
  },
  {
    name: 'chitty_revoke_token',
    description: 'Revoke an active API token immediately. Cannot be undone.',
    category: 'authentication',
    service: 'chittyauth',
    endpoint: 'https://auth.chitty.cc/api/v1/tokens/revoke',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'API token to revoke'
        },
        reason: {
          type: 'string',
          description: 'Reason for revocation (for audit log)'
        }
      },
      required: ['token']
    }
  }
];
