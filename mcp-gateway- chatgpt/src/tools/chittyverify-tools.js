/**
 * ChittyVerify Tools
 * Evidence verification and chain of custody
 */

export const chittyVerifyTools = [
  {
    name: 'evidence_intake',
    description: 'Ingest evidence file for verification. Supports documents, images, videos, audio. Automatically extracts metadata and creates forensic hash.',
    category: 'evidence',
    service: 'chittyverify',
    endpoint: 'https://verify.chitty.cc/api/evidence/intake',
    inputSchema: {
      type: 'object',
      properties: {
        fileUrl: {
          type: 'string',
          description: 'URL to evidence file or base64-encoded data URI'
        },
        caseId: {
          type: 'string',
          description: 'ChittyID of the associated case'
        },
        evidenceType: {
          type: 'string',
          enum: ['document', 'image', 'video', 'audio', 'email', 'text', 'other'],
          description: 'Type of evidence'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata (source, date, location, etc.)',
          properties: {
            source: { type: 'string' },
            collectionDate: { type: 'string', format: 'date-time' },
            location: { type: 'string' },
            custodian: { type: 'string' }
          }
        }
      },
      required: ['fileUrl', 'caseId']
    }
  },
  {
    name: 'verify_evidence',
    description: 'Verify authenticity of evidence using forensic hash comparison, digital signature validation, and blockchain verification.',
    category: 'evidence',
    service: 'chittyverify',
    endpoint: 'https://verify.chitty.cc/api/evidence/verify',
    inputSchema: {
      type: 'object',
      properties: {
        evidenceId: {
          type: 'string',
          description: 'Unique evidence identifier'
        },
        blockchainVerify: {
          type: 'boolean',
          description: 'Verify against blockchain record',
          default: true
        }
      },
      required: ['evidenceId']
    }
  },
  {
    name: 'evidence_chain_of_custody',
    description: 'Retrieve complete chain of custody for evidence. Returns all access, modifications, and transfers with timestamps and actors.',
    category: 'evidence',
    service: 'chittyverify',
    endpoint: 'https://verify.chitty.cc/api/evidence/custody-chain',
    inputSchema: {
      type: 'object',
      properties: {
        evidenceId: {
          type: 'string',
          description: 'Unique evidence identifier'
        },
        format: {
          type: 'string',
          enum: ['json', 'pdf', 'timeline'],
          default: 'json',
          description: 'Output format'
        }
      },
      required: ['evidenceId']
    }
  },
  {
    name: 'evidence_mint_blockchain',
    description: 'Mint evidence to blockchain for immutable timestamping and verification. Creates permanent record on ChittyChain.',
    category: 'evidence',
    service: 'chittyverify',
    endpoint: 'https://verify.chitty.cc/api/evidence/mint',
    inputSchema: {
      type: 'object',
      properties: {
        evidenceId: {
          type: 'string',
          description: 'Unique evidence identifier'
        },
        network: {
          type: 'string',
          enum: ['chittychain', 'ethereum', 'polygon'],
          default: 'chittychain',
          description: 'Blockchain network'
        }
      },
      required: ['evidenceId']
    }
  }
];
