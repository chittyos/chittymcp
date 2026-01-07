/**
 * Evidence Tools Module
 * Legal evidence intake and management tools
 */

import { handlers } from "./handlers.js";

export const tools = [
  {
    name: "intake_evidence",
    description: "Process evidence files into the Marie Kondo system",
    inputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: { type: "string" },
          description: "Array of file paths to process",
        },
        category: {
          type: "string",
          description: "Evidence category for organization",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          default: "medium",
          description: "Evidence priority level",
        },
      },
      required: ["files"],
    },
  },
  {
    name: "list_evidence",
    description: "List evidence by category or search criteria",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by evidence category",
        },
        search: {
          type: "string",
          description: "Search term for filename or metadata",
        },
      },
    },
  },
  {
    name: "get_evidence_stats",
    description: "Get evidence processing statistics",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "start_intake_monitoring",
    description: "Start monitoring incoming directory for new evidence",
    inputSchema: {
      type: "object",
      properties: {
        sourceDir: {
          type: "string",
          description: "Source directory to monitor (defaults to Google Drive)",
        },
      },
    },
  },
];

export { handlers };
