#!/usr/bin/env node

/**
 * Standalone Evidence Intake MCP Server
 *
 * Provides evidence-specific tools for legal case management
 * Uses the modular tool system for code reuse
 */

import path from "path";
import { fileURLToPath } from "url";
import { BaseMCPServer } from "../core/mcp-server.js";
import { logger } from "../core/logger.js";
import * as evidenceTools from "../tools/evidence/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EvidenceIntakeServer extends BaseMCPServer {
  constructor() {
    super("evidence-intake", "1.0.0");
    this.registerToolModule(evidenceTools);
  }
}

// Start server
async function main() {
  const server = new EvidenceIntakeServer();

  logger.info("Server information:");
  logger.info(JSON.stringify(server.getStats(), null, 2));

  await server.run();
}

main().catch((error) => {
  logger.error(`Server startup failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
