#!/usr/bin/env node

/**
 * Evidence Intake MCP Server
 * Integrates with Marie Kondo Evidence System for automated legal evidence processing
 * Case: Arias v. Bianchi - 2024D007847
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import chokidar from "chokidar";
import { Client } from "pg";

const CASE_ID = "2024D007847";
const CASE_NAME = "Arias-v-Bianchi";
const EVIDENCE_BASE = "/Users/nb/Evidence-Intake";
const LOCKBOX_DIR = path.join(
  EVIDENCE_BASE,
  `${CASE_ID}-${CASE_NAME}`,
  "lockbox",
);
const INCOMING_DIR = path.join(
  EVIDENCE_BASE,
  `${CASE_ID}-${CASE_NAME}`,
  "incoming",
);

class EvidenceIntakeServer {
  constructor() {
    this.server = new Server(
      {
        name: "evidence-intake",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.evidenceCategories = {
      "00_KEY_EXHIBITS": "High-priority evidence",
      "01_TRO_PROCEEDINGS": "Temporary restraining order proceedings",
      "02_LLC_FORMATION": "LLC formation and corporate documents",
      "03_MEMBERSHIP_REMOVAL": "Membership removal proceedings",
      "04_PREMARITAL_FUNDING": "Pre-marital property funding",
      "05_PROPERTY_TRANSACTIONS": "Real estate transactions",
      "06_FINANCIAL_STATEMENTS": "Financial statements and affidavits",
      "07_COURT_FILINGS": "Court pleadings and orders",
      "08_ATTORNEY_CORRESPONDENCE": "Attorney letters and communication",
      "09_PERJURY_EVIDENCE": "Evidence of perjury or false statements",
      "10_SANCTIONS_RULE137": "Sanctions and Rule 137 violations",
      "11_COLOMBIAN_PROPERTY": "Colombian property documents",
      "12_LEASE_AGREEMENTS": "Lease agreements and rentals",
      "98_DUPLICATES": "Duplicate files",
      "99_UNSORTED": "Uncategorized evidence",
    };

    this.setupHandlers();
    this.setupEvidenceWatcher();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
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
                enum: Object.keys(this.evidenceCategories),
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
                enum: Object.keys(this.evidenceCategories),
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
                description:
                  "Source directory to monitor (defaults to Google Drive)",
                default:
                  "/Users/nb/Library/CloudStorage/GoogleDrive-nichobianchi@gmail.com/Shared drives/Arias V Bianchi",
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "intake_evidence":
          return this.handleIntakeEvidence(request.params.arguments);
        case "list_evidence":
          return this.handleListEvidence(request.params.arguments);
        case "get_evidence_stats":
          return this.handleGetEvidenceStats();
        case "start_intake_monitoring":
          return this.handleStartIntakeMonitoring(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`,
          );
      }
    });
  }

  async handleIntakeEvidence(args) {
    const { files, category = "99_UNSORTED", priority = "medium" } = args;
    const results = [];

    await fs.ensureDir(INCOMING_DIR);
    await fs.ensureDir(LOCKBOX_DIR);

    for (const categoryDir of Object.keys(this.evidenceCategories)) {
      await fs.ensureDir(path.join(LOCKBOX_DIR, categoryDir));
    }

    for (const filePath of files) {
      try {
        const result = await this.processEvidenceFile(
          filePath,
          category,
          priority,
        );
        results.push(result);
      } catch (error) {
        results.push({
          file: filePath,
          status: "error",
          error: error.message,
        });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Evidence intake completed. Processed ${results.length} files.\n\n${results
            .map(
              (r) =>
                `📄 ${path.basename(r.file)}: ${r.status} ${r.exhibit_id ? `(${r.exhibit_id})` : ""}`,
            )
            .join("\n")}`,
        },
      ],
    };
  }

  async processEvidenceFile(filePath, category, priority) {
    const filename = path.basename(filePath);
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Check for duplicates
    const isDuplicate = await this.checkDuplicate(hash);
    if (isDuplicate) {
      return {
        file: filePath,
        status: "duplicate",
        hash: hash.substring(0, 8),
      };
    }

    // Generate exhibit ID
    const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const exhibitId = `${CASE_ID}-EXH-${timestamp}-${hash.substring(0, 8)}`;

    // Determine category based on filename if not specified
    const finalCategory =
      category === "99_UNSORTED" ? this.categorizeFile(filename) : category;

    // Create evidence directory structure
    const categoryPath = path.join(LOCKBOX_DIR, finalCategory);
    const originalsPath = path.join(LOCKBOX_DIR, ".originals");

    await fs.ensureDir(categoryPath);
    await fs.ensureDir(originalsPath);

    // Store original with hash prefix
    const originalFile = path.join(
      originalsPath,
      `${hash.substring(0, 8)}_${filename}`,
    );
    await fs.copy(filePath, originalFile);

    // Create symlink in category
    const exhibitFile = path.join(categoryPath, `${exhibitId}_${filename}`);
    await fs.ensureSymlink(originalFile, exhibitFile);

    // Create metadata
    const metadata = {
      exhibit_id: exhibitId,
      original_name: filename,
      category: finalCategory,
      hash,
      priority,
      processed_at: new Date().toISOString(),
      file_size: (await fs.stat(filePath)).size,
      case_id: CASE_ID,
    };

    const metadataFile = path.join(categoryPath, `${exhibitId}_metadata.json`);
    await fs.writeJSON(metadataFile, metadata, { spaces: 2 });

    // Sync to Notion if configured
    if (process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID) {
      await this.syncToNotion(metadata, originalFile);
    }

    return {
      file: filePath,
      status: "processed",
      exhibit_id: exhibitId,
      category: finalCategory,
      hash: hash.substring(0, 8),
    };
  }

  async syncToNotion(metadata, filePath) {
    try {
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28"
        },
        body: JSON.stringify({
          parent: { database_id: process.env.NOTION_DATABASE_ID },
          properties: {
            "Exhibit ID": {
              title: [{ text: { content: metadata.exhibit_id } }]
            },
            "Filename": {
              rich_text: [{ text: { content: metadata.original_name } }]
            },
            "Category": {
              select: { name: metadata.category }
            },
            "Hash": {
              rich_text: [{ text: { content: metadata.hash } }]
            },
            "Priority": {
              select: { name: metadata.priority }
            },
            "File Size": {
              number: metadata.file_size
            },
            "Processed": {
              date: { start: metadata.processed_at }
            },
            "Case ID": {
              rich_text: [{ text: { content: metadata.case_id } }]
            },
            "File Path": {
              rich_text: [{ text: { content: filePath } }]
            }
          }
        })
      });

      if (!response.ok) {
        console.error(`Notion sync failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Notion sync error: ${error.message}`);
    }
  }

  categorizeFile(filename) {
    const lower = filename.toLowerCase();

    if (lower.includes("tro") || lower.includes("restraining"))
      return "01_TRO_PROCEEDINGS";
    if (lower.includes("llc") || lower.includes("operating agreement"))
      return "02_LLC_FORMATION";
    if (lower.includes("membership") || lower.includes("removal"))
      return "03_MEMBERSHIP_REMOVAL";
    if (lower.includes("premarital") || lower.includes("pre-marital"))
      return "04_PREMARITAL_FUNDING";
    if (
      lower.includes("deed") ||
      lower.includes("property") ||
      lower.includes("real estate")
    )
      return "05_PROPERTY_TRANSACTIONS";
    if (
      lower.includes("financial") ||
      lower.includes("affidavit") ||
      lower.includes("statement")
    )
      return "06_FINANCIAL_STATEMENTS";
    if (
      lower.includes("motion") ||
      lower.includes("order") ||
      lower.includes("petition")
    )
      return "07_COURT_FILINGS";
    if (lower.includes("letter") || lower.includes("correspondence"))
      return "08_ATTORNEY_CORRESPONDENCE";
    if (lower.includes("perjury") || lower.includes("false"))
      return "09_PERJURY_EVIDENCE";
    if (lower.includes("sanction") || lower.includes("rule 137"))
      return "10_SANCTIONS_RULE137";
    if (lower.includes("colombia") || lower.includes("medellin"))
      return "11_COLOMBIAN_PROPERTY";
    if (lower.includes("lease") || lower.includes("rental"))
      return "12_LEASE_AGREEMENTS";

    return "99_UNSORTED";
  }

  async checkDuplicate(hash) {
    const originalsDir = path.join(LOCKBOX_DIR, ".originals");
    if (!(await fs.pathExists(originalsDir))) return false;

    const files = await fs.readdir(originalsDir);
    return files.some((file) => file.startsWith(hash.substring(0, 8)));
  }

  async handleListEvidence(args) {
    const { category, search } = args;
    const evidence = [];

    const searchDir = category ? path.join(LOCKBOX_DIR, category) : LOCKBOX_DIR;

    if (!(await fs.pathExists(searchDir))) {
      return {
        content: [{ type: "text", text: "Evidence directory not found" }],
      };
    }

    const categories = category
      ? [category]
      : Object.keys(this.evidenceCategories);

    for (const cat of categories) {
      const catPath = path.join(LOCKBOX_DIR, cat);
      if (!(await fs.pathExists(catPath))) continue;

      const files = await fs.readdir(catPath);
      for (const file of files) {
        if (file.endsWith("_metadata.json")) {
          const metadata = await fs.readJSON(path.join(catPath, file));
          if (!search || file.toLowerCase().includes(search.toLowerCase())) {
            evidence.push({
              ...metadata,
              category_name: this.evidenceCategories[cat],
            });
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Found ${evidence.length} evidence items:\n\n${evidence
            .map(
              (e) =>
                `📄 ${e.exhibit_id}: ${e.original_name}\n   Category: ${e.category_name}\n   Hash: ${e.hash.substring(0, 8)}\n`,
            )
            .join("\n")}`,
        },
      ],
    };
  }

  async handleGetEvidenceStats() {
    const stats = {};
    let totalFiles = 0;

    for (const [category, description] of Object.entries(
      this.evidenceCategories,
    )) {
      const catPath = path.join(LOCKBOX_DIR, category);
      if (await fs.pathExists(catPath)) {
        const files = await fs.readdir(catPath);
        const count = files.filter((f) => f.endsWith("_metadata.json")).length;
        stats[category] = { count, description };
        totalFiles += count;
      } else {
        stats[category] = { count: 0, description };
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `📊 Evidence Statistics for ${CASE_NAME} (${CASE_ID})\n\nTotal Evidence Items: ${totalFiles}\n\n${Object.entries(
            stats,
          )
            .map(
              ([cat, data]) =>
                `${cat}: ${data.count} items - ${data.description}`,
            )
            .join("\n")}`,
        },
      ],
    };
  }

  async handleStartIntakeMonitoring(args) {
    const sourceDir =
      args.sourceDir ||
      "/Users/nb/Library/CloudStorage/GoogleDrive-nichobianchi@gmail.com/Shared drives/Arias V Bianchi";

    this.watcher = chokidar.watch(sourceDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
    });

    this.watcher.on("add", async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if ([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"].includes(ext)) {
        try {
          await this.processEvidenceFile(filePath, "99_UNSORTED", "medium");
          console.log(`✅ Auto-processed: ${path.basename(filePath)}`);
        } catch (error) {
          console.error(
            `❌ Failed to process: ${path.basename(filePath)} - ${error.message}`,
          );
        }
      }
    });

    return {
      content: [
        {
          type: "text",
          text: `🔍 Started monitoring ${sourceDir} for new evidence files.\n\nSupported formats: PDF, DOC, DOCX, PNG, JPG, JPEG\nNew files will be automatically processed into the evidence system.`,
        },
      ],
    };
  }

  setupEvidenceWatcher() {
    // This can be called to set up file system watching
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Evidence Intake MCP server running on stdio");
  }
}

const server = new EvidenceIntakeServer();
server.run().catch(console.error);
