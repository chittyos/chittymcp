/**
 * ChittyRegistry Tools
 * Service discovery and registration
 */

export const chittyRegistryTools = [
  {
    name: 'service_discover',
    description: 'Discover ChittyOS services by type, capability, or name. Returns service endpoints, health status, and capabilities.',
    category: 'registry',
    service: 'chittyregistry',
    endpoint: 'https://registry.chitty.cc/api/discover',
    inputSchema: {
      type: 'object',
      properties: {
        serviceType: {
          type: 'string',
          description: 'Service type (e.g., identity, authentication, verification)'
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required capabilities'
        },
        serviceName: {
          type: 'string',
          description: 'Specific service name'
        },
        healthCheck: {
          type: 'boolean',
          default: true,
          description: 'Include real-time health check'
        }
      }
    }
  },
  {
    name: 'service_register',
    description: 'Register a new service in ChittyRegistry. Requires service metadata, endpoint, and health check URL.',
    category: 'registry',
    service: 'chittyregistry',
    endpoint: 'https://registry.chitty.cc/api/register',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: {
          type: 'string',
          description: 'Unique service name'
        },
        serviceType: {
          type: 'string',
          description: 'Service type classification'
        },
        endpoint: {
          type: 'string',
          format: 'uri',
          description: 'Primary service endpoint URL'
        },
        healthCheckUrl: {
          type: 'string',
          format: 'uri',
          description: 'Health check endpoint'
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Service capabilities'
        },
        metadata: {
          type: 'object',
          description: 'Additional service metadata'
        }
      },
      required: ['serviceName', 'serviceType', 'endpoint']
    }
  }
];
