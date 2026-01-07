/**
 * ChittyRouter Tools
 * AI-powered email processing and document extraction
 */

export const chittyRouterTools = [
  {
    name: 'email_triage',
    description: 'AI-powered email triage using multi-agent system. Classifies emails by priority, intent, and routing destination.',
    category: 'ai-agents',
    service: 'chittyrouter',
    endpoint: 'https://router.chitty.cc/api/triage',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: {
          type: 'string',
          description: 'Email message ID'
        },
        emailContent: {
          type: 'object',
          description: 'Email content object',
          properties: {
            from: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
            attachments: { type: 'array', items: { type: 'object' } }
          },
          required: ['from', 'subject', 'body']
        },
        context: {
          type: 'object',
          description: 'Additional context (case ID, sender history, etc.)'
        }
      }
    }
  },
  {
    name: 'document_extract',
    description: 'AI-powered document data extraction using vision models. Extracts structured data from PDFs, images, scanned documents.',
    category: 'ai-agents',
    service: 'chittyrouter',
    endpoint: 'https://router.chitty.cc/api/extract',
    inputSchema: {
      type: 'object',
      properties: {
        documentUrl: {
          type: 'string',
          description: 'URL to document for extraction'
        },
        documentType: {
          type: 'string',
          enum: ['invoice', 'contract', 'lease', 'court-filing', 'form', 'general'],
          description: 'Document type hint for specialized extraction'
        },
        extractionSchema: {
          type: 'object',
          description: 'Desired output schema (JSON Schema format)'
        }
      },
      required: ['documentUrl']
    }
  }
];
