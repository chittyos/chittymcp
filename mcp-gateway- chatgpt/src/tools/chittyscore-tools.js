/**
 * ChittyScore Tools
 * 6D behavioral trust scoring
 */

export const chittyScoreTools = [
  {
    name: 'calculate_trust_score',
    description: 'Calculate comprehensive 6-dimensional behavioral trust score. Analyzes Source, Temporal, Channel, Outcome, Network, and Justice dimensions to produce People Score, Legal Score, State Score, and overall ChittyScore.',
    category: 'trust',
    service: 'chittyscore',
    endpoint: 'https://score.chitty.cc/api/score/calculate',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'ChittyID of entity to score'
        },
        dimensions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['source', 'temporal', 'channel', 'outcome', 'network', 'justice']
          },
          description: 'Specific dimensions to calculate (default: all)',
          default: ['source', 'temporal', 'channel', 'outcome', 'network', 'justice']
        },
        context: {
          type: 'object',
          description: 'Contextual data for scoring (interactions, history, relationships)',
          properties: {
            interactions: { type: 'array', items: { type: 'object' } },
            timeframe: { type: 'string', description: 'Time window for analysis (e.g., 30d, 1y)' }
          }
        }
      },
      required: ['entityId']
    }
  },
  {
    name: 'get_trust_network',
    description: 'Retrieve trust network graph for an entity. Returns connected entities with trust scores and relationship types.',
    category: 'trust',
    service: 'chittyscore',
    endpoint: 'https://score.chitty.cc/api/network/graph',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'ChittyID of central entity'
        },
        depth: {
          type: 'number',
          description: 'Network depth (degrees of separation)',
          default: 2,
          minimum: 1,
          maximum: 5
        },
        minScore: {
          type: 'number',
          description: 'Minimum trust score threshold (0-100)',
          default: 0,
          minimum: 0,
          maximum: 100
        }
      },
      required: ['entityId']
    }
  },
  {
    name: 'update_trust_factors',
    description: 'Update trust scoring factors based on new interactions or events. Triggers recalculation of affected trust scores.',
    category: 'trust',
    service: 'chittyscore',
    endpoint: 'https://score.chitty.cc/api/score/update',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'ChittyID of entity'
        },
        factors: {
          type: 'object',
          description: 'Trust factors to update',
          properties: {
            dimension: {
              type: 'string',
              enum: ['source', 'temporal', 'channel', 'outcome', 'network', 'justice']
            },
            weight: {
              type: 'number',
              minimum: -100,
              maximum: 100,
              description: 'Factor weight (positive or negative impact)'
            },
            evidence: {
              type: 'string',
              description: 'Evidence ID supporting the factor update'
            }
          }
        }
      },
      required: ['entityId', 'factors']
    }
  }
];
