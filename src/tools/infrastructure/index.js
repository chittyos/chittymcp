/**
 * Infrastructure Tools Module
 * Cloudflare Workers, KV, R2, and D1 management tools
 */

import { handlers } from "./handlers.js";

export const tools = [
  {
    name: "deploy_worker",
    description: "Deploy Cloudflare Worker",
    inputSchema: {
      type: "object",
      properties: {
        worker_name: { type: "string", description: "Worker name" },
        environment: {
          type: "string",
          enum: ["production", "staging", "development"],
          description: "Deployment environment",
        },
        script: { type: "string", description: "Worker script content or path" },
      },
      required: ["worker_name", "environment"],
    },
  },
  {
    name: "manage_kv_namespace",
    description: "Create or manage Cloudflare KV namespace",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["create", "list", "delete", "bind"],
          description: "KV operation",
        },
        namespace_name: { type: "string", description: "KV namespace name" },
        worker_name: { type: "string", description: "Worker to bind namespace" },
      },
      required: ["operation"],
    },
  },
  {
    name: "manage_r2_bucket",
    description: "Create or manage Cloudflare R2 bucket",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["create", "list", "delete", "bind"],
          description: "R2 operation",
        },
        bucket_name: { type: "string", description: "R2 bucket name" },
        worker_name: { type: "string", description: "Worker to bind bucket" },
      },
      required: ["operation"],
    },
  },
  {
    name: "execute_d1_query",
    description: "Execute Cloudflare D1 database query",
    inputSchema: {
      type: "object",
      properties: {
        database_name: { type: "string", description: "D1 database name" },
        query: { type: "string", description: "SQL query to execute" },
        parameters: {
          type: "array",
          description: "Query parameters for prepared statements",
        },
      },
      required: ["database_name", "query"],
    },
  },
];

export { handlers };
