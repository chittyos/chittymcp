#!/usr/bin/env node

/**
 * Unified Consolidated MCP Server
 *
 * Dynamically loads all tool modules and provides a unified MCP server
 * with support for:
 * - Evidence intake (4 tools)
 * - Legal case management (4 tools)
 * - Infrastructure management (4 tools)
 * - Cross-device sync (3 tools)
 * - Chain workflow execution (5 chains)
 *
 * Total: 15+ tools across 4 domains
 */

import path from "path";
import { fileURLToPath } from "url";
import { BaseMCPServer } from "../core/mcp-server.js";
import { ToolLoader } from "../core/tool-loader.js";
import { ChainExecutor } from "../core/chain-executor.js";
import { logger } from "../core/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UnifiedMCPServer extends BaseMCPServer {
  constructor() {
    super("chittymcp-unified", "3.0.0");

    this.toolLoader = new ToolLoader(path.join(__dirname, "../tools"));
    this.chainExecutor = new ChainExecutor(
      this,
      path.join(__dirname, "../../config/chains.json")
    );
  }

  /**
   * Initialize server and load all tool modules
   */
  async initialize() {
    logger.info("Initializing Unified MCP Server...");

    // Load chains
    await this.chainExecutor.loadChains();

    // Load all tool modules
    const modules = await this.toolLoader.loadAllModules();

    for (const { category, module } of modules) {
      logger.info(`Registering tools from category: ${category}`);
      this.registerToolModule(module);
    }

    // Add chain execution tool
    this.registerChainTool();

    logger.info(`Server initialized with ${this.tools.size} tools`);
    logger.info(`Available chains: ${this.chainExecutor.getAvailableChains().map(c => c.name).join(", ")}`);
  }

  /**
   * Register chain execution tool
   */
  registerChainTool() {
    const chainTool = {
      name: "execute_chain",
      description: "Execute a multi-tool workflow chain",
      inputSchema: {
        type: "object",
        properties: {
          chain_name: {
            type: "string",
            description: "Name of the chain to execute",
            enum: this.chainExecutor.getAvailableChains().map((c) => c.name),
          },
          parameters: {
            type: "object",
            description: "Chain execution parameters",
          },
        },
        required: ["chain_name", "parameters"],
      },
    };

    const handler = async (args) => {
      const { chain_name, parameters } = args;
      const result = await this.chainExecutor.executeChain(chain_name, parameters);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    };

    this.registerTool(chainTool, handler);
  }

  /**
   * Get server information
   */
  getServerInfo() {
    return {
      ...this.getStats(),
      chains: this.chainExecutor.getAvailableChains(),
      categories: Array.from(
        new Set(
          this.toolLoader.getAllModules().map(([category]) => category)
        )
      ),
    };
  }
}

// Start server
async function main() {
  const server = new UnifiedMCPServer();
  await server.initialize();

  logger.info("Server information:");
  logger.info(JSON.stringify(server.getServerInfo(), null, 2));

  await server.run();
}

main().catch((error) => {
  logger.error(`Server startup failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
