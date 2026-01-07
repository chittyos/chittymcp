/**
 * Chain Workflow Executor
 * Executes multi-tool workflow chains defined in config/chains.json
 */

import fs from "fs-extra";
import path from "path";
import { logger } from "./logger.js";

export class ChainExecutor {
  constructor(server, chainsConfigPath) {
    this.server = server;
    this.chainsConfigPath = chainsConfigPath;
    this.chains = null;
  }

  /**
   * Load chain definitions from config
   */
  async loadChains() {
    try {
      this.chains = await fs.readJSON(this.chainsConfigPath);
      logger.info(`Loaded ${Object.keys(this.chains.chains).length} chain definitions`);
      return this.chains;
    } catch (error) {
      logger.error(`Failed to load chains: ${error.message}`);
      this.chains = { chains: {} };
      return this.chains;
    }
  }

  /**
   * Execute a workflow chain
   * @param {string} chainName - Name of the chain to execute
   * @param {Object} parameters - Chain execution parameters
   * @returns {Object} Chain execution result
   */
  async executeChain(chainName, parameters = {}) {
    if (!this.chains) {
      await this.loadChains();
    }

    const chain = this.chains.chains[chainName];
    if (!chain) {
      throw new Error(`Chain not found: ${chainName}`);
    }

    logger.info(`Executing chain: ${chainName}`);

    const executionId = `CHAIN-${Date.now()}`;
    const results = [];
    const context = { ...parameters };

    try {
      for (let i = 0; i < chain.steps.length; i++) {
        const step = chain.steps[i];
        logger.info(`Chain ${chainName} - Step ${step.step}: ${step.description}`);

        // Replace template variables in input
        const input = this.resolveTemplateVariables(step.input, context);

        // Execute tool
        const result = await this.server.handleToolCall(step.tool, input);

        // Store result in context for next steps
        context[`step${step.step}`] = {
          output: result,
          tool: step.tool,
        };

        results.push({
          step: step.step,
          tool: step.tool,
          description: step.description,
          result,
          status: 'completed',
        });
      }

      logger.info(`Chain ${chainName} completed successfully`);

      return {
        execution_id: executionId,
        chain_name: chainName,
        status: 'completed',
        steps_completed: results.length,
        results,
        summary: this.summarizeResults(chain, results),
      };
    } catch (error) {
      logger.error(`Chain ${chainName} failed: ${error.message}`);

      // Handle rollback if enabled
      if (parameters.rollback_enabled) {
        await this.rollbackChain(results);
      }

      return {
        execution_id: executionId,
        chain_name: chainName,
        status: 'failed',
        steps_completed: results.length,
        results,
        error: error.message,
      };
    }
  }

  /**
   * Resolve template variables in input object
   */
  resolveTemplateVariables(input, context) {
    const resolved = {};

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const variable = value.slice(2, -2).trim();
        resolved[key] = this.getContextValue(variable, context);
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveTemplateVariables(value, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Get value from context using dot notation
   */
  getContextValue(path, context) {
    const parts = path.split('.');
    let value = context;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Summarize chain execution results
   */
  summarizeResults(chain, results) {
    const completedSteps = results.filter(r => r.status === 'completed').length;
    const failedSteps = results.filter(r => r.status === 'failed').length;

    return {
      chain_description: chain.description,
      total_steps: chain.steps.length,
      completed_steps: completedSteps,
      failed_steps: failedSteps,
      success_rate: (completedSteps / chain.steps.length) * 100,
    };
  }

  /**
   * Rollback chain execution (placeholder for future implementation)
   */
  async rollbackChain(results) {
    logger.warn('Rollback requested but not yet implemented');
    // Future: implement compensating transactions for each tool
  }

  /**
   * Get available chains
   */
  getAvailableChains() {
    if (!this.chains) {
      return [];
    }

    return Object.entries(this.chains.chains).map(([name, chain]) => ({
      name,
      description: chain.description,
      tools: chain.tools,
      version: chain.version,
    }));
  }
}
