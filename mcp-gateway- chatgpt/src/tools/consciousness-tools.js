/**
 * ContextConsciousness Tools
 * Ecosystem health awareness and monitoring
 */

export const consciousnessTools = [
  {
    name: 'consciousness_get_awareness',
    description: 'Get ContextConsciousness ecosystem awareness. Returns real-time health, anomaly detection, and failure predictions for all ChittyOS services.',
    category: 'consciousness',
    service: 'chittyconnect',
    endpoint: 'https://connect.chitty.cc/api/consciousness/awareness',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: {
          type: 'boolean',
          default: false,
          description: 'Include detailed metrics for each service'
        },
        services: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter specific services (empty = all)'
        }
      }
    }
  },
  {
    name: 'consciousness_capture_snapshot',
    description: 'Capture comprehensive ecosystem snapshot with detailed service health, performance metrics, anomaly detection, and predictive failure analysis.',
    category: 'consciousness',
    service: 'chittyconnect',
    endpoint: 'https://connect.chitty.cc/api/consciousness/snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        includeMetrics: {
          type: 'boolean',
          default: true,
          description: 'Include performance metrics'
        },
        includeAnomalies: {
          type: 'boolean',
          default: true,
          description: 'Include anomaly detection results'
        },
        includePredictions: {
          type: 'boolean',
          default: true,
          description: 'Include failure predictions'
        },
        snapshotName: {
          type: 'string',
          description: 'Optional snapshot name for future reference'
        }
      }
    }
  },
  {
    name: 'consciousness_analyze_context',
    description: 'Analyze text with ContextConsciousness - deep understanding of legal, financial, and relational context using AI.',
    category: 'consciousness',
    service: 'chittyconnect',
    endpoint: 'https://connect.chitty.cc/api/consciousness/analyze',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to analyze'
        },
        analysisType: {
          type: 'string',
          enum: ['sentiment', 'entities', 'legal', 'financial', 'comprehensive'],
          default: 'comprehensive',
          description: 'Type of contextual analysis'
        },
        context: {
          type: 'object',
          description: 'Additional context (case ID, entity ID, etc.)'
        }
      },
      required: ['text']
    }
  }
];
