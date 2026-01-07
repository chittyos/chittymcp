/**
 * Logging Utilities
 * Centralized logging for all MCP servers
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

function log(level, message, ...args) {
  if (LOG_LEVELS[level] >= currentLevel) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    console.error(prefix, message, ...args);
  }
}

export const logger = {
  debug: (message, ...args) => log('DEBUG', message, ...args),
  info: (message, ...args) => log('INFO', message, ...args),
  warn: (message, ...args) => log('WARN', message, ...args),
  error: (message, ...args) => log('ERROR', message, ...args),
};
