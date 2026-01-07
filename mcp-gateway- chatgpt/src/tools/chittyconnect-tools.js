/**
 * ChittyConnect Tools
 * Integration proxies for third-party services
 */

export const chittyConnectTools = [
  {
    name: 'notion_query',
    description: 'Query Notion databases through ChittyConnect proxy. Supports filters, sorts, and pagination.',
    category: 'integrations',
    service: 'chittyconnect',
    endpoint: 'https://connect.chitty.cc/integrations/notion/query',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: {
          type: 'string',
          description: 'Notion database ID (32-character hex)'
        },
        filter: {
          type: 'object',
          description: 'Notion API filter object'
        },
        sorts: {
          type: 'array',
          description: 'Notion API sort array',
          items: { type: 'object' }
        },
        pageSize: {
          type: 'number',
          default: 100,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['databaseId']
    }
  },
  {
    name: 'openai_chat',
    description: 'Access OpenAI models through ChittyConnect proxy with automatic rate limiting and cost tracking.',
    category: 'integrations',
    service: 'chittyconnect',
    endpoint: 'https://connect.chitty.cc/integrations/openai/chat',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' }
            },
            required: ['role', 'content']
          },
          description: 'Chat messages array'
        },
        model: {
          type: 'string',
          default: 'gpt-4',
          enum: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
          description: 'OpenAI model to use'
        },
        temperature: {
          type: 'number',
          default: 0.7,
          minimum: 0,
          maximum: 2
        },
        maxTokens: {
          type: 'number',
          default: 1000,
          minimum: 1,
          maximum: 4096
        }
      },
      required: ['messages']
    }
  },
  {
    name: 'google_calendar_list',
    description: 'List Google Calendar events through ChittyConnect proxy.',
    category: 'integrations',
    service: 'chittyconnect',
    endpoint: 'https://connect.chitty.cc/integrations/google/calendar/list',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          default: 'primary',
          description: 'Calendar ID or "primary" for main calendar'
        },
        timeMin: {
          type: 'string',
          format: 'date-time',
          description: 'Start time filter (ISO 8601)'
        },
        timeMax: {
          type: 'string',
          format: 'date-time',
          description: 'End time filter (ISO 8601)'
        },
        maxResults: {
          type: 'number',
          default: 10,
          minimum: 1,
          maximum: 250
        }
      }
    }
  }
];
