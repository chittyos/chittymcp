/**
 * Legal Tools Module
 * Legal case management and compliance tools
 */

import { handlers } from "./handlers.js";

export const tools = [
  {
    name: "generate_chitty_id",
    description: "Generate ChittyID via id.chitty.cc service (REQUIRED - no local generation)",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: ["PEO", "PLACE", "PROP", "EVNT", "AUTH", "INFO", "FACT", "CONTEXT", "ACTOR"],
          description: "Entity type for ChittyID",
        },
        metadata: { type: "object", description: "Entity metadata" },
      },
      required: ["entity_type"],
    },
  },
  {
    name: "create_legal_case",
    description: "Create legal case record with ChittyID",
    inputSchema: {
      type: "object",
      properties: {
        case_id: { type: "string", description: "ChittyID for case" },
        case_type: {
          type: "string",
          enum: ["civil", "criminal", "family", "corporate"],
          description: "Type of legal case",
        },
        jurisdiction: { type: "string", description: "Legal jurisdiction" },
        documents: {
          type: "array",
          items: { type: "string" },
          description: "Document paths",
        },
        client_id: { type: "string", description: "Client ChittyID" },
      },
      required: ["case_id", "case_type", "client_id"],
    },
  },
  {
    name: "analyze_document",
    description: "Analyze legal documents with AI",
    inputSchema: {
      type: "object",
      properties: {
        documents: {
          type: "array",
          items: { type: "string" },
          description: "Document paths to analyze",
        },
        case_id: { type: "string", description: "Associated case ID" },
        analysis_type: {
          type: "string",
          enum: ["summary", "compliance", "risk", "evidence"],
          description: "Type of analysis",
        },
      },
      required: ["documents"],
    },
  },
  {
    name: "compliance_check",
    description: "Validate legal compliance requirements",
    inputSchema: {
      type: "object",
      properties: {
        case_id: { type: "string", description: "Case ChittyID" },
        jurisdiction: { type: "string", description: "Legal jurisdiction" },
        requirements: {
          type: "array",
          items: { type: "string" },
          description: "Compliance requirements to check",
        },
      },
      required: ["case_id"],
    },
  },
];

export { handlers };
