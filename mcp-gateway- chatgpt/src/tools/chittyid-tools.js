/**
 * ChittyID Tools
 * Identity generation and management
 * Service: https://id.chitty.cc
 */

export const chittyIdTools = [
  {
    name: 'chitty_mint_id',
    description: 'Generate a new ChittyID using drand beacon randomness. Creates cryptographically secure decentralized identifier for persons, places, properties, events, or cases.',
    category: 'identity',
    service: 'chittyid',
    endpoint: 'https://id.chitty.cc/api/v2/chittyid/mint',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          enum: ['PERSON', 'PLACE', 'PROPERTY', 'EVENT', 'CASE', 'DOCUMENT', 'TRANSACTION', 'ORGANIZATION'],
          description: 'Entity type for the ChittyID. PERSON for individuals, PLACE for locations, PROPERTY for assets, EVENT for incidents, CASE for legal matters.'
        },
        metadata: {
          type: 'object',
          description: 'Optional contextual metadata to associate with the identity',
          properties: {
            name: { type: 'string', description: 'Human-readable name' },
            description: { type: 'string', description: 'Description of the entity' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Classification tags' }
          }
        }
      },
      required: ['entity']
    }
  },
  {
    name: 'chitty_verify_id',
    description: 'Verify the format and cryptographic validity of a ChittyID. Checks version, geographic domain, lifecycle stage, sequence, entity type, timestamp, checksum, and extension.',
    category: 'identity',
    service: 'chittyid',
    endpoint: 'https://id.chitty.cc/api/v2/chittyid/verify',
    inputSchema: {
      type: 'object',
      properties: {
        chittyId: {
          type: 'string',
          description: 'ChittyID in format VV-G-LLL-SSSS-T-YM-C-X (e.g., 01-C-ACT-1234-P-2501-5-A)',
          pattern: '^\\d{2}-[A-Z]-[A-Z]{3}-[A-Z0-9]{4}-[A-Z]-[A-Z0-9]{4}-[A-Z0-9]-[A-Z0-9]$'
        }
      },
      required: ['chittyId']
    }
  },
  {
    name: 'chitty_lookup_id',
    description: 'Lookup identity information by ChittyID. Retrieves metadata, creation timestamp, entity type, and associated records.',
    category: 'identity',
    service: 'chittyid',
    endpoint: 'https://id.chitty.cc/api/v2/chittyid/lookup',
    inputSchema: {
      type: 'object',
      properties: {
        chittyId: {
          type: 'string',
          description: 'ChittyID to lookup'
        },
        includeHistory: {
          type: 'boolean',
          description: 'Include full modification history',
          default: false
        }
      },
      required: ['chittyId']
    }
  },
  {
    name: 'chitty_resolve_did',
    description: 'Resolve a ChittyID DID (Decentralized Identifier) to its DID document. Returns public keys, service endpoints, and authentication methods.',
    category: 'identity',
    service: 'chittyid',
    endpoint: 'https://id.chitty.cc/api/v2/did/resolve',
    inputSchema: {
      type: 'object',
      properties: {
        did: {
          type: 'string',
          description: 'DID in format did:chitty:01-C-ACT-1234-P-2501-5-A',
          pattern: '^did:chitty:[A-Z0-9\\-]+$'
        }
      },
      required: ['did']
    }
  }
];
