/**
 * Sync Tools Module
 * Cross-device MCP server state synchronization tools
 */

import { handlers } from "./handlers.js";

export const tools = [
  {
    name: "register_mcp_server",
    description: "Register MCP server for cross-device sync",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device identifier" },
        server_url: { type: "string", description: "MCP server URL" },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description: "Server capabilities",
        },
        platform: {
          type: "string",
          enum: ["macos", "linux", "windows", "ios", "android"],
          description: "Device platform",
        },
      },
      required: ["device_id", "server_url"],
    },
  },
  {
    name: "sync_mcp_state",
    description: "Synchronize MCP state across devices",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device identifier" },
        state_data: { type: "object", description: "State data to sync" },
        sync_type: {
          type: "string",
          enum: ["full", "incremental", "conflict_resolution"],
          description: "Sync type",
        },
        conflict_resolution: {
          type: "string",
          enum: ["last_write_wins", "merge", "manual"],
          description: "Conflict resolution strategy",
        },
      },
      required: ["device_id", "state_data", "sync_type"],
    },
  },
  {
    name: "get_synced_servers",
    description: "Query synced MCP servers for device",
    inputSchema: {
      type: "object",
      properties: {
        device_id: { type: "string", description: "Device identifier" },
        filter: { type: "object", description: "Filter criteria" },
      },
      required: ["device_id"],
    },
  },
];

export { handlers };
