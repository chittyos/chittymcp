/**
 * ChittyChronicle Tools
 * Event logging and timeline tracking
 */

export const chittyChronicleTools = [
  {
    name: 'chronicle_log',
    description: 'Log event to ChittyChronicle with full-text search indexing. Creates immutable audit trail entry with timestamp, actors, and metadata.',
    category: 'logging',
    service: 'chittychronicle',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service name (e.g., chittyid, chittyauth)'
        },
        action: {
          type: 'string',
          description: 'Action performed (e.g., mint_id, provision_token)'
        },
        entityId: {
          type: 'string',
          description: 'ChittyID of primary entity'
        },
        userId: {
          type: 'string',
          description: 'ChittyID of user/actor'
        },
        status: {
          type: 'string',
          enum: ['success', 'failure', 'pending', 'partial'],
          default: 'success'
        },
        metadata: {
          type: 'object',
          description: 'Event-specific metadata'
        },
        searchableText: {
          type: 'string',
          description: 'Additional text for full-text search'
        }
      },
      required: ['service', 'action']
    }
  },
  {
    name: 'chronicle_search',
    description: 'Search chronicle events using full-text search and filters. Supports PostgreSQL tsquery syntax for advanced queries.',
    category: 'logging',
    service: 'chittychronicle',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (supports AND, OR, NOT operators)'
        },
        filters: {
          type: 'object',
          description: 'Additional filters',
          properties: {
            service: { type: 'string' },
            action: { type: 'string' },
            entityId: { type: 'string' },
            userId: { type: 'string' },
            status: { type: 'string', enum: ['success', 'failure', 'pending', 'partial'] },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' }
          }
        },
        limit: {
          type: 'number',
          default: 100,
          minimum: 1,
          maximum: 1000
        },
        offset: {
          type: 'number',
          default: 0,
          minimum: 0
        }
      }
    }
  },
  {
    name: 'chronicle_timeline',
    description: 'Get chronological timeline of events for a specific entity. Returns ordered sequence of all activities.',
    category: 'logging',
    service: 'chittychronicle',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'ChittyID to get timeline for'
        },
        startDate: {
          type: 'string',
          format: 'date-time',
          description: 'Timeline start date (ISO 8601)'
        },
        endDate: {
          type: 'string',
          format: 'date-time',
          description: 'Timeline end date (ISO 8601)'
        },
        services: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by specific services'
        },
        groupBy: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month'],
          description: 'Group events by time period'
        }
      },
      required: ['entityId']
    }
  }
];
