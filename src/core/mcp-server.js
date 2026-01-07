/**
 * Base MCP Server Class
 * Provides shared functionality for all MCP server implementations
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";

export class BaseMCPServer {
  constructor(name, version, options = {}) {
    this.name = name;
    this.version = version;
    this.tools = new Map();
    this.handlers = new Map();

    this.server = new Server(
      {
        name,
        version,
      },
      {
        capabilities: {
          tools: {},
          ...options.capabilities,
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Register a tool with its handler
   * @param {Object} toolDefinition - MCP tool definition
   * @param {Function} handler - Tool handler function
   */
  registerTool(toolDefinition, handler) {
    this.tools.set(toolDefinition.name, toolDefinition);
    this.handlers.set(toolDefinition.name, handler);
    logger.debug(`Registered tool: ${toolDefinition.name}`);
  }

  /**
   * Register multiple tools from a module
   * @param {Object} toolModule - Module with tools and handlers
   */
  registerToolModule(toolModule) {
    const { tools, handlers } = toolModule;

    for (const tool of tools) {
      const handler = handlers[tool.name];
      if (!handler) {
        logger.warn(`No handler found for tool: ${tool.name}`);
        continue;
      }
      this.registerTool(tool, handler);
    }

    logger.info(`Registered ${tools.length} tools from module`);
  }

  /**
   * Setup MCP request handlers
   */
  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Array.from(this.tools.values()),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return this.handleToolCall(request.params.name, request.params.arguments);
    });
  }

  /**
   * Route tool call to appropriate handler
   */
  async handleToolCall(toolName, args) {
    const handler = this.handlers.get(toolName);

    if (!handler) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${toolName}`
      );
    }

    try {
      logger.info(`Executing tool: ${toolName}`);
      const result = await handler(args);
      logger.info(`Tool ${toolName} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`Tool ${toolName} failed: ${error.message}`);

      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Error executing ${toolName}: ${error.message}`
      );
    }
  }

  /**
   * Start the MCP server
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info(`${this.name} v${this.version} running on stdio`);
    logger.info(`Registered ${this.tools.size} tools`);
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      name: this.name,
      version: this.version,
      toolCount: this.tools.size,
      tools: Array.from(this.tools.keys()),
    };
  }
}
