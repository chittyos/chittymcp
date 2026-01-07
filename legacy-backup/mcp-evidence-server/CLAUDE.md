# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Evidence Intake MCP Server** - Model Context Protocol server for automated legal evidence processing using the Marie Kondo Evidence System.

**Case**: Arias v. Bianchi (2024D007847)
**Location**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittymcp/mcp-evidence-server`
**MCP SDK**: 0.5.0
**Type**: Legal evidence management tool

---

## Purpose

This MCP server provides automated evidence intake and organization for legal proceedings. It integrates with:
- **Marie Kondo Evidence System** - Organized evidence categorization
- **ChittyID** - Unique evidence identifiers
- **ChittyLedger** - PostgreSQL evidence registry
- **Google Drive** - Seamless evidence source sync

---

## Key Files

- `index.js` - Main MCP server implementation (EvidenceIntakeServer class)
- `package-lock.json` - Locked dependencies
- `README.md` - User-facing documentation

---

## Architecture

### Evidence Processing Flow

```
1. File Intake
   ↓
2. SHA256 Hashing (duplicate detection)
   ↓
3. Exhibit ID Generation
   Format: {CASE_ID}-EXH-{DATE}-{HASH_PREFIX}
   Example: 2024D007847-EXH-20251018-abc12345
   ↓
4. Auto-Categorization
   (12 legal categories + unsorted + duplicates)
   ↓
5. Storage Strategy
   - Original: .originals/{HASH_PREFIX}_{filename}
   - Symlink: {CATEGORY}/{EXHIBIT_ID}_{filename}
   - Metadata: {CATEGORY}/{EXHIBIT_ID}_metadata.json
   ↓
6. Chain of Custody
   (Immutable audit trail)
```

### Directory Structure

```
/Users/nb/Evidence-Intake/2024D007847-Arias-v-Bianchi/
├── lockbox/
│   ├── .originals/              # Hash-prefixed originals (immutable)
│   ├── 00_KEY_EXHIBITS/         # High-priority evidence
│   ├── 01_TRO_PROCEEDINGS/      # TRO-related documents
│   ├── 02_LLC_FORMATION/        # Corporate documents
│   ├── 03_MEMBERSHIP_REMOVAL/   # Membership proceedings
│   ├── 04_PREMARITAL_FUNDING/   # Pre-marital property
│   ├── 05_PROPERTY_TRANSACTIONS/ # Real estate
│   ├── 06_FINANCIAL_STATEMENTS/ # Financial docs
│   ├── 07_COURT_FILINGS/        # Court pleadings
│   ├── 08_ATTORNEY_CORRESPONDENCE/ # Attorney letters
│   ├── 09_PERJURY_EVIDENCE/     # Perjury evidence
│   ├── 10_SANCTIONS_RULE137/    # Sanctions docs
│   ├── 11_COLOMBIAN_PROPERTY/   # Colombian property
│   ├── 12_LEASE_AGREEMENTS/     # Lease documents
│   ├── 98_DUPLICATES/           # Auto-detected duplicates
│   └── 99_UNSORTED/             # Uncategorized
└── incoming/                    # Temporary intake directory
```

---

## MCP Tools

### intake_evidence

Process evidence files into the organized evidence system.

**Parameters**:
- `files` (required): Array of file paths to process
- `category` (optional): Evidence category (defaults to auto-categorization)
- `priority` (optional): high | medium | low (default: medium)

**Returns**:
```javascript
{
  content: [{
    type: "text",
    text: "Evidence intake completed. Processed N files.\n\n📄 file1.pdf: processed (2024D007847-EXH-...)\n📄 file2.pdf: duplicate (abc12345)"
  }]
}
```

**Example**:
```javascript
await intake_evidence({
  files: ["/path/to/motion.pdf", "/path/to/exhibit.pdf"],
  category: "07_COURT_FILINGS",
  priority: "high"
});
```

### list_evidence

Query evidence by category or search term.

**Parameters**:
- `category` (optional): Filter by specific category
- `search` (optional): Search term for filename or metadata

**Returns**: List of evidence items with exhibit IDs, categories, and hashes

**Example**:
```javascript
// List all court filings
await list_evidence({ category: "07_COURT_FILINGS" });

// Search across all categories
await list_evidence({ search: "motion" });
```

### get_evidence_stats

Get comprehensive evidence statistics for the case.

**Parameters**: None

**Returns**: Evidence count by category with descriptions

**Example**:
```javascript
await get_evidence_stats();
// Returns:
// Total Evidence Items: 247
// 00_KEY_EXHIBITS: 12 items - High-priority evidence
// 01_TRO_PROCEEDINGS: 18 items - Temporary restraining order proceedings
// ...
```

### start_intake_monitoring

Start real-time monitoring of a directory for new evidence files.

**Parameters**:
- `sourceDir` (optional): Directory to monitor (defaults to Google Drive shared folder)

**Returns**: Confirmation message with monitoring status

**Monitored File Types**: PDF, DOC, DOCX, PNG, JPG, JPEG

**Example**:
```javascript
await start_intake_monitoring({
  sourceDir: "/Users/nb/Library/CloudStorage/GoogleDrive-<USER_EMAIL>/Shared drives/Arias V Bianchi"
});
```

---

## Auto-Categorization Logic

The server automatically categorizes evidence based on filename patterns (see `categorizeFile()` method at index.js:274):

| Category | Filename Patterns |
|----------|------------------|
| 01_TRO_PROCEEDINGS | tro, restraining |
| 02_LLC_FORMATION | llc, operating agreement |
| 03_MEMBERSHIP_REMOVAL | membership, removal |
| 04_PREMARITAL_FUNDING | premarital, pre-marital |
| 05_PROPERTY_TRANSACTIONS | deed, property, real estate |
| 06_FINANCIAL_STATEMENTS | financial, affidavit, statement |
| 07_COURT_FILINGS | motion, order, petition |
| 08_ATTORNEY_CORRESPONDENCE | letter, correspondence |
| 09_PERJURY_EVIDENCE | perjury, false |
| 10_SANCTIONS_RULE137 | sanction, rule 137 |
| 11_COLOMBIAN_PROPERTY | colombia, medellin |
| 12_LEASE_AGREEMENTS | lease, rental |
| 99_UNSORTED | (default fallback) |

---

## Development

### Running the Server

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production mode
npm run start

# Direct execution
node index.js
```

### Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "evidence-intake": {
      "command": "node",
      "args": ["/Users/nb/Evidence-Intake/mcp-evidence-server/index.js"],
      "env": {}
    }
  }
}
```

Restart Claude Desktop to activate the tools.

### Testing

```bash
# Test evidence intake
node -e "
const { processEvidenceFile } = require('./index.js');
processEvidenceFile('/path/to/test.pdf', '07_COURT_FILINGS', 'high')
  .then(console.log)
  .catch(console.error);
"
```

---

## Dependencies

- `@modelcontextprotocol/sdk` ^0.5.0 - MCP server framework
- `fs-extra` ^11.2.0 - Enhanced file system operations
- `chokidar` ^4.0.1 - File system watcher for monitoring
- `crypto` ^1.0.1 - SHA256 hashing for duplicate detection
- `pg` ^8.12.0 - PostgreSQL client for ChittyLedger integration

---

## Integration with ChittyOS

### ChittyID Format

All exhibit IDs follow ChittyID format:
- Pattern: `{CASE_ID}-EXH-{TIMESTAMP}-{HASH_PREFIX}`
- Example: `2024D007847-EXH-20251018-a1b2c3d4`
- Validation: ChittyCheck enforces compliance

### ChittyLedger Integration

Evidence metadata can be stored in PostgreSQL:
- Table: `evidence_registry`
- Columns: exhibit_id, case_id, category, hash, processed_at, file_size, metadata

Requires `NEON_DATABASE_URL` environment variable.

### Evidence Chain of Custody

Each piece of evidence maintains:
1. **Original file** - Immutable, hash-prefixed in `.originals/`
2. **Symlink** - Organized by category with exhibit ID
3. **Metadata JSON** - Complete audit trail
4. **Database record** - Searchable registry (if ChittyLedger enabled)

---

## Security & Compliance

### Duplicate Detection

- SHA256 hash computed for all files
- Check against existing `.originals/` files
- Duplicates moved to `98_DUPLICATES/`
- Original exhibit ID preserved in metadata

### Permissions

Evidence directory requires:
- Read access to source directories (Google Drive)
- Write access to Evidence-Intake directory
- Symlink creation permissions

### Data Integrity

- Originals are never modified
- All access via symlinks
- Metadata includes file size and hash for verification
- Chain of custody timestamp in ISO 8601 format

---

## Common Issues

**"Permission denied" creating symlinks**:
- Check file system permissions
- Verify Evidence-Intake directory exists
- Ensure user has symlink creation rights

**"Duplicate not detected" for identical files**:
- Verify SHA256 hash computation
- Check `.originals/` directory exists
- Confirm hash prefix length (8 characters)

**Auto-categorization not working**:
- Review filename patterns in `categorizeFile()` method
- Patterns are case-insensitive
- Falls back to `99_UNSORTED` if no match

**Google Drive monitoring not triggering**:
- Verify Google Drive is mounted and synced
- Check file path in `start_intake_monitoring`
- Ensure supported file types (PDF, DOC, DOCX, images)

---

## Code Structure

### Main Class: EvidenceIntakeServer

```javascript
class EvidenceIntakeServer {
  constructor()              // Initialize server and handlers
  setupHandlers()            // Register MCP tool handlers
  handleIntakeEvidence()     // Process evidence intake requests
  processEvidenceFile()      // Core evidence processing logic
  categorizeFile()           // Auto-categorization by filename
  checkDuplicate()           // SHA256-based duplicate detection
  handleListEvidence()       // Query evidence by category/search
  handleGetEvidenceStats()   // Generate statistics report
  handleStartIntakeMonitoring() // Start file watcher
  setupEvidenceWatcher()     // Configure chokidar watcher
  run()                      // Connect to stdio transport
}
```

### Key Methods

**processEvidenceFile(filePath, category, priority)** (index.js:209)
- Core processing logic
- Handles hashing, categorization, storage, and metadata

**categorizeFile(filename)** (index.js:274)
- Pattern matching for auto-categorization
- Returns category string

**checkDuplicate(hash)** (index.js:317)
- Checks if hash exists in `.originals/`
- Prevents duplicate storage

---

**Version**: 1.0.0
**Case**: 2024D007847 (Arias v. Bianchi)
**MCP SDK**: 0.5.0
**Created**: October 18, 2025
