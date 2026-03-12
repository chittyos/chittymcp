/**
 * ChittyDisputes Tools
 * Dispute management — create, query, update, track disputes
 */

export const chittyDisputesTools = [
  {
    name: 'chitty_dispute_create',
    description: 'Create a new dispute with classification, property, parties, and deadlines. Automatically mints a ChittyID and logs a creation event.',
    category: 'disputes',
    service: 'chittydisputes',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Dispute title (e.g., "HOA Eviction — 550 W Surf #504")'
        },
        dispute_type: {
          type: 'string',
          enum: ['PROPERTY', 'INSURANCE', 'LEGAL', 'FINANCIAL', 'TENANT', 'VENDOR', 'HOA', 'REGULATORY'],
          description: 'Primary dispute classification'
        },
        severity: {
          type: 'string',
          enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
          default: 'MEDIUM',
          description: 'Severity level'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the dispute'
        },
        property_address: {
          type: 'string',
          description: 'Property street address (e.g., "550 W Surf St, Chicago IL 60657")'
        },
        property_unit: {
          type: 'string',
          description: 'Unit number (e.g., "#504")'
        },
        parties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role: { type: 'string', description: 'e.g., complainant, respondent, attorney, tenant' },
              contact: { type: 'string' }
            }
          },
          description: 'Involved parties with roles'
        },
        docket_number: {
          type: 'string',
          description: 'Court case/docket number if applicable'
        },
        estimated_cost: {
          type: 'number',
          description: 'Estimated financial exposure in USD'
        },
        response_deadline: {
          type: 'string',
          format: 'date-time',
          description: 'Deadline for initial response (ISO 8601)'
        },
        next_action_date: {
          type: 'string',
          format: 'date-time',
          description: 'Date of next required action (ISO 8601)'
        },
        next_action_description: {
          type: 'string',
          description: 'What needs to happen by next_action_date'
        },
        source: {
          type: 'string',
          default: 'chittymcp',
          description: 'How dispute was reported (email, manual, api, phone, chittymcp)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Searchable tags'
        },
        metadata: {
          type: 'object',
          description: 'Additional key-value metadata'
        }
      },
      required: ['title', 'dispute_type']
    }
  },
  {
    name: 'chitty_dispute_get',
    description: 'Get a dispute by UUID or ChittyID, including its 20 most recent timeline events.',
    category: 'disputes',
    service: 'chittydisputes',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Dispute UUID (e.g., "a1b2c3d4-...") or ChittyID (e.g., "01-C-DSP-A1B2-T-2603-0-X"). Accepts either format.'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'chitty_dispute_list',
    description: 'List disputes with optional filters. Returns summary fields sorted by severity then deadline. Use for dashboards and agent scanning.',
    category: 'disputes',
    service: 'chittydisputes',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['INTAKE', 'OPEN', 'INVESTIGATING', 'PENDING', 'ESCALATED', 'RESOLVED', 'CLOSED'],
          description: 'Filter by status'
        },
        type: {
          type: 'string',
          enum: ['PROPERTY', 'INSURANCE', 'LEGAL', 'FINANCIAL', 'TENANT', 'VENDOR', 'HOA', 'REGULATORY'],
          description: 'Filter by dispute type'
        },
        severity: {
          type: 'string',
          enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
          description: 'Filter by severity'
        },
        property: {
          type: 'string',
          description: 'Partial match on property_address (ILIKE)'
        },
        party: {
          type: 'string',
          description: 'Search party names in the parties JSONB array'
        },
        limit: {
          type: 'integer',
          default: 50,
          minimum: 1,
          maximum: 100,
          description: 'Max results per page'
        },
        offset: {
          type: 'integer',
          default: 0,
          minimum: 0,
          description: 'Pagination offset'
        }
      }
    }
  },
  {
    name: 'chitty_dispute_update',
    description: 'Update a dispute. Status changes auto-log a timeline event via DB trigger. When resolving, resolution_type is required.',
    category: 'disputes',
    service: 'chittydisputes',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Dispute UUID or ChittyID'
        },
        title: { type: 'string' },
        description: { type: 'string' },
        status: {
          type: 'string',
          enum: ['INTAKE', 'OPEN', 'INVESTIGATING', 'PENDING', 'ESCALATED', 'RESOLVED', 'CLOSED']
        },
        severity: {
          type: 'string',
          enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
        },
        assigned_to: { type: 'string' },
        parties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role: { type: 'string' },
              contact: { type: 'string' }
            }
          }
        },
        estimated_cost: { type: 'number' },
        actual_cost: { type: 'number' },
        response_deadline: { type: 'string', format: 'date-time' },
        resolution_deadline: { type: 'string', format: 'date-time' },
        next_action_date: { type: 'string', format: 'date-time' },
        next_action_description: { type: 'string' },
        resolution_type: {
          type: 'string',
          description: 'Required when status=RESOLVED. Values: repaired, settled, dismissed, insured, withdrawn, etc.'
        },
        resolution_notes: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        metadata: { type: 'object' },
        updated_by: { type: 'string', default: 'chittymcp' }
      },
      required: ['id']
    }
  },
  {
    name: 'chitty_dispute_add_event',
    description: 'Add a timeline event to a dispute. Use for notes, emails received/sent, phone calls, document additions, escalations, and cost updates.',
    category: 'disputes',
    service: 'chittydisputes',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        dispute_id: {
          type: 'string',
          description: 'Dispute UUID'
        },
        event_type: {
          type: 'string',
          enum: ['note', 'status_change', 'document_added', 'email_received', 'email_sent', 'phone_call', 'assignment', 'escalation', 'deadline_set', 'cost_update', 'resolution'],
          description: 'Type of timeline event'
        },
        summary: {
          type: 'string',
          description: 'Brief event description'
        },
        details: {
          type: 'object',
          description: 'Structured event data (e.g., {from, to, subject} for emails)'
        },
        actor: {
          type: 'string',
          default: 'chittymcp',
          description: 'Who/what created this event'
        }
      },
      required: ['dispute_id', 'event_type', 'summary']
    }
  },
  {
    name: 'chitty_dispute_timeline',
    description: 'Get full chronological timeline of events for a dispute. Returns all events ordered oldest-first.',
    category: 'disputes',
    service: 'chittydisputes',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {
        dispute_id: {
          type: 'string',
          description: 'Dispute UUID'
        }
      },
      required: ['dispute_id']
    }
  },
  {
    name: 'chitty_dispute_summary',
    description: 'Dashboard summary: dispute counts by status and type, overdue count, and upcoming actions within 7 days.',
    category: 'disputes',
    service: 'chittydisputes',
    endpoint: 'database:direct',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];
