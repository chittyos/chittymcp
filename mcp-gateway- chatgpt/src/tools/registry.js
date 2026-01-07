/**
 * Tool Registry - Consolidated ChittyOS Tools
 * All tools from across the ChittyOS ecosystem
 */

import { chittyIdTools } from './chittyid-tools.js';
import { chittyAuthTools } from './chittyauth-tools.js';
import { chittyVerifyTools } from './chittyverify-tools.js';
import { chittyScoreTools } from './chittyscore-tools.js';
import { chittyChronicleTools } from './chittychronicle-tools.js';
import { chittyQualityTools } from './chittyquality-tools.js';
import { chittyConnectTools } from './chittyconnect-tools.js';
import { chittyRouterTools } from './chittyrouter-tools.js';
import { chittyRegistryTools } from './chittyregistry-tools.js';
import { consciousnessTools } from './consciousness-tools.js';

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.categories = new Set();
    this.registerAllTools();
  }

  /**
   * Register all ChittyOS tools
   */
  registerAllTools() {
    const toolGroups = [
      chittyIdTools,
      chittyAuthTools,
      chittyVerifyTools,
      chittyScoreTools,
      chittyChronicleTools,
      chittyQualityTools,
      chittyConnectTools,
      chittyRouterTools,
      chittyRegistryTools,
      consciousnessTools
    ];

    for (const toolGroup of toolGroups) {
      for (const tool of toolGroup) {
        this.registerTool(tool);
      }
    }

    console.log(`Registered ${this.tools.size} tools across ${this.categories.size} categories`);
  }

  /**
   * Register a single tool
   * @param {object} tool - Tool definition
   */
  registerTool(tool) {
    if (!tool.name) {
      throw new Error('Tool must have a name');
    }

    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} already registered - overwriting`);
    }

    this.tools.set(tool.name, tool);

    if (tool.category) {
      this.categories.add(tool.category);
    }
  }

  /**
   * Get tool by name
   * @param {string} name
   * @returns {object|null}
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Get all tools
   * @returns {Array<object>}
   */
  getAllTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   * @param {string} category
   * @returns {Array<object>}
   */
  getToolsByCategory(category) {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  /**
   * Get all categories
   * @returns {Array<string>}
   */
  getCategories() {
    return Array.from(this.categories);
  }

  /**
   * Search tools by name or description
   * @param {string} query
   * @returns {Array<object>}
   */
  searchTools(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAllTools().filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    );
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();
