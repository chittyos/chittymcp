/**
 * ChittyQuality Tools
 * File quality validation and quarantine management
 */

export const chittyQualityTools = [
  {
    name: 'quality_validate',
    description: 'Validate file quality using AI analysis. Checks for corruption, format validity, content integrity, and potential issues. Files below quality threshold are quarantined.',
    category: 'quality',
    service: 'chittyquality',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        fileUrl: {
          type: 'string',
          description: 'URL to file for validation'
        },
        filePath: {
          type: 'string',
          description: 'Local file path (alternative to fileUrl)'
        },
        validationType: {
          type: 'string',
          enum: ['format', 'content', 'security', 'comprehensive'],
          default: 'comprehensive',
          description: 'Type of validation to perform'
        },
        quarantineThreshold: {
          type: 'number',
          default: 70,
          minimum: 0,
          maximum: 100,
          description: 'Confidence score below which file is quarantined'
        }
      }
    }
  },
  {
    name: 'quarantine_list',
    description: 'List files in quarantine queue with status and issues. Returns pending, reviewed, approved, or rejected items.',
    category: 'quality',
    service: 'chittyquality',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'reviewed', 'approved', 'rejected'],
          description: 'Filter by status (optional)'
        },
        limit: {
          type: 'number',
          default: 50,
          minimum: 1,
          maximum: 500
        },
        offset: {
          type: 'number',
          default: 0
        }
      }
    }
  },
  {
    name: 'quarantine_review',
    description: 'Review quarantined item and update status. Requires manual approval or rejection with reason.',
    category: 'quality',
    service: 'chittyquality',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        quarantineId: {
          type: 'string',
          description: 'Quarantine queue UUID'
        },
        decision: {
          type: 'string',
          enum: ['approve', 'reject'],
          description: 'Review decision'
        },
        reason: {
          type: 'string',
          description: 'Reason for decision (required for reject)'
        },
        reviewedBy: {
          type: 'string',
          description: 'ChittyID of reviewer'
        }
      },
      required: ['quarantineId', 'decision']
    }
  }
];
