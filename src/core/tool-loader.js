/**
 * Dynamic Tool Loader
 * Loads tool modules dynamically and registers them with the server
 */

import fs from "fs-extra";
import path from "path";
import { logger } from "./logger.js";

export class ToolLoader {
  constructor(toolsDirectory) {
    this.toolsDirectory = toolsDirectory;
    this.loadedModules = new Map();
  }

  /**
   * Load all tool modules from the tools directory
   * @returns {Array} Array of loaded tool modules
   */
  async loadAllModules() {
    const modules = [];
    const categories = await fs.readdir(this.toolsDirectory);

    for (const category of categories) {
      const categoryPath = path.join(this.toolsDirectory, category);
      const stat = await fs.stat(categoryPath);

      if (stat.isDirectory()) {
        try {
          const module = await this.loadModule(category);
          if (module) {
            modules.push({ category, module });
            logger.info(`Loaded tool category: ${category}`);
          }
        } catch (error) {
          logger.error(`Failed to load category ${category}: ${error.message}`);
        }
      }
    }

    return modules;
  }

  /**
   * Load a specific tool module
   * @param {string} category - Tool category name
   * @returns {Object} Tool module with tools and handlers
   */
  async loadModule(category) {
    const modulePath = path.join(this.toolsDirectory, category, "index.js");

    if (!(await fs.pathExists(modulePath))) {
      logger.warn(`Module not found: ${modulePath}`);
      return null;
    }

    try {
      const module = await import(`file://${modulePath}`);

      if (!module.tools || !module.handlers) {
        logger.error(`Invalid module structure in ${category}: missing tools or handlers`);
        return null;
      }

      this.loadedModules.set(category, module);
      return module;
    } catch (error) {
      logger.error(`Error loading module ${category}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a loaded module by category
   */
  getModule(category) {
    return this.loadedModules.get(category);
  }

  /**
   * Get all loaded modules
   */
  getAllModules() {
    return Array.from(this.loadedModules.entries());
  }
}
