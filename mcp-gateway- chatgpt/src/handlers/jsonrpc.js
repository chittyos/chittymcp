/**
 * JSON-RPC 2.0 Handler for MCP Protocol
 * Implements MCP protocol methods over JSON-RPC
 */

import { toolRegistry } from '../tools/registry.js';
import { executeToolCall } from '../services/tool-executor.js';
import { resourceRegistry } from '../resources/registry.js';
import { promptRegistry } from '../prompts/registry.js';

/**
 * Handle JSON-RPC 2.0 request
 *
 * @param {object} request - JSON-RPC request
 * @param {object} env - Environment bindings
 * @param {object} authContext - Authentication context
 * @returns {Promise<object>} JSON-RPC response
 */
export async function jsonRpcHandler(request, env, authContext) {
  const { method, params, id } = request;

  try {
    switch (method) {
      case 'tools/list':
        return handleToolsList(id, params);

      case 'tools/call':
        return await handleToolsCall(id, params, env, authContext);

      case 'resources/list':
        return handleResourcesList(id, params);
      case 'resources/read':
        return await handleResourcesRead(id, params);

      case 'prompts/list':
        return handlePromptsList(id, params);
      case 'prompts/render':
        return handlePromptsRender(id, params);

      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Unknown method: ${method}`
          },
          id
        };
    }
  } catch (error) {
    console.error(`Error handling ${method}:`, error);

    return {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      },
      id
    };
  }
}

/**
 * Handle tools/list method
 * Returns all available tools
 */
function handleToolsList(id, params) {
  const tools = toolRegistry.getAllTools();

  // Filter by category if specified
  let filteredTools = tools;
  if (params?.category) {
    filteredTools = tools.filter(tool => tool.category === params.category);
  }

  return {
    jsonrpc: '2.0',
    result: {
      tools: filteredTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    },
    id
  };
}

/**
 * Handle tools/call method
 * Executes a tool and returns the result
 */
async function handleToolsCall(id, params, env, authContext) {
  if (!params || !params.name) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32602,
        message: 'Invalid params',
        data: 'Missing required parameter: name'
      },
      id
    };
  }

  const { name, arguments: toolArgs } = params;

  // Get tool definition
  const tool = toolRegistry.getTool(name);
  if (!tool) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32602,
        message: 'Invalid params',
        data: `Unknown tool: ${name}`
      },
      id
    };
  }

  // Validate tool arguments against schema
  const validationResult = validateToolArguments(toolArgs, tool.inputSchema);
  if (!validationResult.valid) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32602,
        message: 'Invalid params',
        data: {
          tool: name,
          errors: validationResult.errors
        }
      },
      id
    };
  }

  // Execute tool
  try {
    const result = await executeToolCall(name, toolArgs, env, authContext);

    return {
      jsonrpc: '2.0',
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      },
      id
    };
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);

    return {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Tool execution failed',
        data: {
          tool: name,
          error: error.message,
          details: error.details || null
        }
      },
      id
    };
  }
}

/**
 * Handle resources/list method
 * Not yet implemented
 */
function handleResourcesList(id, params) {
  const items = resourceRegistry.list();
  return {
    jsonrpc: '2.0',
    result: { resources: items },
    id
  };
}

async function handleResourcesRead(id, params) {
  if (!params || !params.name) {
    return {
      jsonrpc: '2.0',
      error: { code: -32602, message: 'Invalid params', data: 'Missing parameter: name' },
      id
    };
  }
  const res = resourceRegistry.get(params.name);
  if (!res) {
    return {
      jsonrpc: '2.0',
      error: { code: -32004, message: 'Resource not found', data: params.name },
      id
    };
  }
  const content = await res.getContent(params.arguments || {});
  return {
    jsonrpc: '2.0',
    result: { content: [{ type: res.mimeType.startsWith('text/') ? 'text' : 'blob', text: String(content) }], mimeType: res.mimeType },
    id
  };
}

/**
 * Handle prompts/list method
 * Not yet implemented
 */
function handlePromptsList(id, params) {
  const items = promptRegistry.list();
  return { jsonrpc: '2.0', result: { prompts: items }, id };
}

function handlePromptsRender(id, params) {
  if (!params || !params.name) {
    return { jsonrpc: '2.0', error: { code: -32602, message: 'Invalid params', data: 'Missing parameter: name' }, id };
  }
  const text = promptRegistry.render(params.name, params.arguments || {});
  if (!text) {
    return { jsonrpc: '2.0', error: { code: -32005, message: 'Prompt not found', data: params.name }, id };
  }
  return { jsonrpc: '2.0', result: { content: [{ type: 'text', text }] }, id };
}

/**
 * Validate tool arguments against JSON Schema
 *
 * @param {object} args - Tool arguments
 * @param {object} schema - JSON Schema
 * @returns {{valid: boolean, errors?: string[]}}
 */
function validateToolArguments(args, schema) {
  const errors = [];

  if (!schema) {
    return { valid: true };
  }

  // Check required fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (args[field] === undefined || args[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check property types
  if (schema.properties) {
    for (const [key, value] of Object.entries(args)) {
      const propSchema = schema.properties[key];

      if (!propSchema) {
        // Unknown property - allow it for flexibility
        continue;
      }

      // Type validation
      if (propSchema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== propSchema.type && value !== null && value !== undefined) {
          errors.push(`Invalid type for ${key}: expected ${propSchema.type}, got ${actualType}`);
        }
      }

      // Enum validation
      if (propSchema.enum && !propSchema.enum.includes(value)) {
        errors.push(`Invalid value for ${key}: must be one of ${propSchema.enum.join(', ')}`);
      }

      // String pattern validation
      if (propSchema.pattern && typeof value === 'string') {
        const regex = new RegExp(propSchema.pattern);
        if (!regex.test(value)) {
          errors.push(`Invalid format for ${key}: must match pattern ${propSchema.pattern}`);
        }
      }

      // Number range validation
      if (typeof value === 'number') {
        if (propSchema.minimum !== undefined && value < propSchema.minimum) {
          errors.push(`Value for ${key} is below minimum: ${propSchema.minimum}`);
        }
        if (propSchema.maximum !== undefined && value > propSchema.maximum) {
          errors.push(`Value for ${key} is above maximum: ${propSchema.maximum}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
