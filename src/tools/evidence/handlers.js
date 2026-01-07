/**
 * Evidence Tool Handlers
 * Implementation of evidence processing tools
 */

import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import chokidar from "chokidar";
import { logger } from "../../core/logger.js";
import { NotionClient } from "../../integration/index.js";

const CASE_ID = "2024D007847";
const CASE_NAME = "Arias-v-Bianchi";
const EVIDENCE_BASE = "/Users/nb/Evidence-Intake";
const LOCKBOX_DIR = path.join(EVIDENCE_BASE, `${CASE_ID}-${CASE_NAME}`, "lockbox");
const INCOMING_DIR = path.join(EVIDENCE_BASE, `${CASE_ID}-${CASE_NAME}`, "incoming");

const EVIDENCE_CATEGORIES = {
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

const notionClient = new NotionClient();
let fileWatcher = null;

/**
 * Auto-categorize file based on filename patterns
 */
function categorizeFile(filename) {
  const lower = filename.toLowerCase();

  if (lower.includes("tro") || lower.includes("restraining"))
    return "01_TRO_PROCEEDINGS";
  if (lower.includes("llc") || lower.includes("operating agreement"))
    return "02_LLC_FORMATION";
  if (lower.includes("membership") || lower.includes("removal"))
    return "03_MEMBERSHIP_REMOVAL";
  if (lower.includes("premarital") || lower.includes("pre-marital"))
    return "04_PREMARITAL_FUNDING";
  if (lower.includes("deed") || lower.includes("property") || lower.includes("real estate"))
    return "05_PROPERTY_TRANSACTIONS";
  if (lower.includes("financial") || lower.includes("affidavit") || lower.includes("statement"))
    return "06_FINANCIAL_STATEMENTS";
  if (lower.includes("motion") || lower.includes("order") || lower.includes("petition"))
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

/**
 * Check if file is duplicate
 */
async function checkDuplicate(hash) {
  const originalsDir = path.join(LOCKBOX_DIR, ".originals");
  if (!(await fs.pathExists(originalsDir))) return false;

  const files = await fs.readdir(originalsDir);
  return files.some((file) => file.startsWith(hash.substring(0, 8)));
}

/**
 * Process single evidence file
 */
async function processEvidenceFile(filePath, category, priority) {
  const filename = path.basename(filePath);
  const fileBuffer = await fs.readFile(filePath);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Check for duplicates
  const isDuplicate = await checkDuplicate(hash);
  if (isDuplicate) {
    logger.warn(`Duplicate file detected: ${filename}`);
    return {
      file: filePath,
      status: "duplicate",
      hash: hash.substring(0, 8),
    };
  }

  // Generate exhibit ID
  const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const exhibitId = `${CASE_ID}-EXH-${timestamp}-${hash.substring(0, 8)}`;

  // Determine category
  const finalCategory = category === "99_UNSORTED" ? categorizeFile(filename) : category;

  // Create directory structure
  const categoryPath = path.join(LOCKBOX_DIR, finalCategory);
  const originalsPath = path.join(LOCKBOX_DIR, ".originals");

  await fs.ensureDir(categoryPath);
  await fs.ensureDir(originalsPath);

  // Store original with hash prefix
  const originalFile = path.join(originalsPath, `${hash.substring(0, 8)}_${filename}`);
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
  await notionClient.syncEvidence(metadata, originalFile);

  logger.info(`Processed evidence: ${exhibitId}`);

  return {
    file: filePath,
    status: "processed",
    exhibit_id: exhibitId,
    category: finalCategory,
    hash: hash.substring(0, 8),
  };
}

/**
 * Tool Handlers
 */
export const handlers = {
  async intake_evidence(args) {
    const { files, category = "99_UNSORTED", priority = "medium" } = args;
    const results = [];

    await fs.ensureDir(INCOMING_DIR);
    await fs.ensureDir(LOCKBOX_DIR);

    for (const categoryDir of Object.keys(EVIDENCE_CATEGORIES)) {
      await fs.ensureDir(path.join(LOCKBOX_DIR, categoryDir));
    }

    for (const filePath of files) {
      try {
        const result = await processEvidenceFile(filePath, category, priority);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to process ${filePath}: ${error.message}`);
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
                `📄 ${path.basename(r.file)}: ${r.status} ${r.exhibit_id ? `(${r.exhibit_id})` : ""}`
            )
            .join("\n")}`,
        },
      ],
    };
  },

  async list_evidence(args) {
    const { category, search } = args;
    const evidence = [];

    const categories = category ? [category] : Object.keys(EVIDENCE_CATEGORIES);

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
              category_name: EVIDENCE_CATEGORIES[cat],
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
                `📄 ${e.exhibit_id}: ${e.original_name}\n   Category: ${e.category_name}\n   Hash: ${e.hash.substring(0, 8)}\n`
            )
            .join("\n")}`,
        },
      ],
    };
  },

  async get_evidence_stats() {
    const stats = {};
    let totalFiles = 0;

    for (const [category, description] of Object.entries(EVIDENCE_CATEGORIES)) {
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
            stats
          )
            .map(([cat, data]) => `${cat}: ${data.count} items - ${data.description}`)
            .join("\n")}`,
        },
      ],
    };
  },

  async start_intake_monitoring(args) {
    const sourceDir =
      args.sourceDir ||
      "/Users/nb/Library/CloudStorage/GoogleDrive-nichobianchi@gmail.com/Shared drives/Arias V Bianchi";

    if (fileWatcher) {
      fileWatcher.close();
    }

    fileWatcher = chokidar.watch(sourceDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
    });

    fileWatcher.on("add", async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if ([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"].includes(ext)) {
        try {
          await processEvidenceFile(filePath, "99_UNSORTED", "medium");
          logger.info(`✅ Auto-processed: ${path.basename(filePath)}`);
        } catch (error) {
          logger.error(`❌ Failed to process: ${path.basename(filePath)} - ${error.message}`);
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
  },
};
