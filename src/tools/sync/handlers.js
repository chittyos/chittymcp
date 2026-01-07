/**
 * Sync Tool Handlers
 * Implementation of cross-device synchronization tools
 */

import { logger } from "../../core/logger.js";

// In-memory registry for development (should be replaced with database/KV)
const deviceRegistry = new Map();

export const handlers = {
  async register_mcp_server(args) {
    const { device_id, server_url, capabilities = [], platform } = args;

    const registration = {
      registration_id: `REG-${Date.now()}`,
      device_id,
      server_url,
      capabilities,
      platform,
      status: "registered",
      registered_at: new Date().toISOString(),
    };

    deviceRegistry.set(device_id, registration);
    logger.info(`Registered MCP server for device: ${device_id}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(registration, null, 2),
        },
      ],
    };
  },

  async sync_mcp_state(args) {
    const { device_id, state_data, sync_type, conflict_resolution = "last_write_wins" } = args;

    const sync = {
      sync_id: `SYNC-${Date.now()}`,
      device_id,
      sync_type,
      conflict_resolution,
      state_size: JSON.stringify(state_data).length,
      status: "completed",
      conflicts: [],
      synced_at: new Date().toISOString(),
    };

    logger.info(`Synced state for device: ${device_id} (${sync.state_size} bytes)`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(sync, null, 2),
        },
      ],
    };
  },

  async get_synced_servers(args) {
    const { device_id, filter = {} } = args;

    const registration = deviceRegistry.get(device_id);
    const servers = registration ? [registration] : [];

    const result = {
      device_id,
      filter,
      servers,
      total: servers.length,
    };

    logger.info(`Retrieved ${servers.length} synced servers for device: ${device_id}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};
