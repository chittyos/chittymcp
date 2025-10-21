# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ChittyMCP** - Model Context Protocol (MCP) server implementations for the ChittyOS ecosystem. This repository contains multiple MCP server implementations that provide tools for legal evidence processing, unified ChittyOS operations, and executive decision-making workflows.

**Location**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittymcp`
**Framework**: ChittyOS v1.0.1
**MCP SDK Version**: 0.5.0

---

## Repository Structure

```
chittymcp/
├── mcp-evidence-server/        # Legal evidence intake MCP server
│   ├── index.js                # Evidence processing server implementation
│   └── package.json            # npm: mcp-evidence-intake
├── mcp-unified-consolidated/   # Unified ChittyOS MCP server (stub)
│   ├── unified-server.js       # Consolidated server with 19 tools
│   └── package.json            # npm: @mcp/unified-consolidated
├── services/
│   └── mcp-exec/              # TypeScript MCP execution service
│       ├── src/index.ts
│       └── package.json
├── config/                     # Configuration files
│   ├── claude-desktop-config.json  # Claude Desktop MCP configuration
│   ├── chains.json            # Chain workflow definitions
│   ├── mcp-sync-config.json   # Cross-device sync config
│   └── multi-platform-config.json
└── archive/                    # Archived chain definitions
```

---

## MCP Servers

### 1. Evidence Intake Server (`mcp-evidence-server/`)

**Purpose**: Automated legal evidence processing with the Marie Kondo Evidence System
**Case**: Arias v. Bianchi (2024D007847)
**Domain**: Legal evidence management

**Key Features**:
- Automated evidence categorization (12+ legal categories)
- SHA256-based duplicate detection
- Chain of custody tracking
- Real-time Google Drive monitoring
- Integration with ChittyID and ChittyLedger

**Available Tools**:
- `intake_evidence` - Process evidence files into organized categories
- `list_evidence` - Query evidence by category or search term
- `get_evidence_stats` - Retrieve case statistics
- `start_intake_monitoring` - Monitor directory for new evidence

**Evidence Structure**:
```
/Users/nb/Evidence-Intake/2024D007847-Arias-v-Bianchi/
├── lockbox/
│   ├── .originals/           # Hash-prefixed originals
│   ├── 00_KEY_EXHIBITS/      # Symlinks to high-priority evidence
│   ├── 01_TRO_PROCEEDINGS/
│   └── ...                   # 12+ categories
└── incoming/                 # Temporary intake directory
```

**Development**:
```bash
cd mcp-evidence-server
npm install
npm run dev
```

**Claude Desktop Configuration**:
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

### 2. Unified Consolidated Server (`mcp-unified-consolidated/`)

**Purpose**: Consolidated MCP server with all ChittyChat connectors, finance tools, and AI capabilities
**Status**: Stub implementation (needs completion)

**Planned Tools** (19 total):
- Executive decision-making (5 tools)
- Legal workflow (7 tools)
- Infrastructure deployment (4 tools)
- Cross-device sync (3 tools)

**Development**:
```bash
cd mcp-unified-consolidated
npm install
npm run dev          # Watch mode
npm run start        # Production mode
npm run cli          # CLI interface
```

**Dependencies**:
- `@anthropic-ai/sdk` - Anthropic AI integration
- `openai` - OpenAI integration
- `commander`, `inquirer` - CLI tooling
- `chalk`, `ora`, `cli-table3` - Terminal UI

### 3. MCP Exec Service (`services/mcp-exec/`)

**Purpose**: TypeScript-based MCP execution service
**Status**: In development

---

## Chain Workflows

ChittyMCP supports complex multi-tool workflows called "chains" defined in `config/chains.json`.

### Available Chains

**executive-decision** - Strategic decision-making workflow
- Tools: analyze_performance, risk_assessment, make_executive_decision, strategic_planning, delegate_task
- Use case: High-level strategic decisions with risk analysis

**legal-workflow** - Complete legal case management
- Tools: generate_chitty_id, create_legal_case, analyze_document, compliance_check, search_cases, process_payment, execute_workflow
- Use case: End-to-end legal case processing

**infrastructure-deploy** - Cloudflare infrastructure deployment
- Tools: deploy_worker, manage_kv_namespace, manage_r2_bucket, execute_d1_query
- Use case: ChittyOS service deployment

**cross-sync** - Cross-device state synchronization
- Tools: register_mcp_server, sync_mcp_state, get_synced_servers
- Use case: Maintain MCP server state across devices

**full-orchestration** - Complete orchestration with all 19 tools
- Use case: Complex multi-domain workflows

---

## Integration Points

### ChittyOS Services

**ChittyID** (`https://id.chitty.cc`)
- All ChittyIDs must be generated via ChittyID service
- Never generate IDs locally
- Use `CHITTY_ID_TOKEN` for authentication

**ChittyLedger** (PostgreSQL)
- Evidence registry and audit trails
- Requires `NEON_DATABASE_URL`

**ChittyRouter** (`https://router.chitty.cc`)
- AI-powered routing gateway
- Routes MCP requests to appropriate services

**ChittyRegistry** (`https://registry.chitty.cc`)
- Service discovery and health monitoring
- MCP server registration

### External Services

**Google Drive**
- Evidence source monitoring
- Path: `/Users/nb/Library/CloudStorage/GoogleDrive-nichobianchi@gmail.com/Shared drives/Arias V Bianchi`

**Cloudflare Workers**
- Deployment target: `chittymcp.chittycorp-llc.workers.dev`
- Account ID: `bbf9fcd845e78035b7a135c481e88541`

---

## Environment Configuration

```bash
# ChittyOS Core
CHITTY_ENV=production
CHITTYID_SERVICE=https://id.chitty.cc
CHITTY_ID_TOKEN=mcp_auth_9b69455f5f799a73f16484eb268aea50
PORTAL_DOMAIN=portal.chitty.cc
GATEWAY_SERVICE=https://gateway.chitty.cc
REGISTRY_SERVICE=https://registry.chitty.cc

# Cloudflare
CLOUDFLARE_API_TOKEN=<from 1Password>
CLOUDFLARE_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541

# Database
NEON_DATABASE_URL=<from 1Password>
```

---

## Development Workflow

### Starting Development

```bash
# Navigate to specific server
cd mcp-evidence-server/
# or
cd mcp-unified-consolidated/

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Testing MCP Servers

**Via Claude Desktop**:
1. Add server configuration to `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Restart Claude Desktop
3. Use tools in Claude chat interface

**Direct Testing**:
```bash
# Evidence server
cd mcp-evidence-server
node index.js

# Unified server
cd mcp-unified-consolidated
node unified-server.js
```

### Adding New Tools

MCP tools follow the standard SDK pattern:

```javascript
{
  name: "tool_name",
  description: "What the tool does",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string", description: "Parameter description" }
    },
    required: ["param1"]
  }
}
```

Handler implementation:
```javascript
async handleToolName(args) {
  // Tool logic
  return {
    content: [
      { type: "text", text: "Result message" }
    ]
  };
}
```

---

## Evidence Categories (Evidence Server)

The evidence intake server supports 14 categories:

- `00_KEY_EXHIBITS` - High-priority evidence
- `01_TRO_PROCEEDINGS` - Temporary restraining order proceedings
- `02_LLC_FORMATION` - LLC formation and corporate documents
- `03_MEMBERSHIP_REMOVAL` - Membership removal proceedings
- `04_PREMARITAL_FUNDING` - Pre-marital property funding
- `05_PROPERTY_TRANSACTIONS` - Real estate transactions
- `06_FINANCIAL_STATEMENTS` - Financial statements and affidavits
- `07_COURT_FILINGS` - Court pleadings and orders
- `08_ATTORNEY_CORRESPONDENCE` - Attorney letters and communication
- `09_PERJURY_EVIDENCE` - Evidence of perjury or false statements
- `10_SANCTIONS_RULE137` - Sanctions and Rule 137 violations
- `11_COLOMBIAN_PROPERTY` - Colombian property documents
- `12_LEASE_AGREEMENTS` - Lease agreements and rentals
- `98_DUPLICATES` - Duplicate files (auto-detected)
- `99_UNSORTED` - Uncategorized evidence

Auto-categorization logic in `categorizeFile()` method (mcp-evidence-server/index.js:274).

---

## Chain Workflow Execution

Chains defined in `config/chains.json` can be executed through the unified server:

```javascript
// Example: Execute legal workflow chain
{
  "chain": "legal-workflow",
  "parameters": {
    "case_type": "civil",
    "documents": ["/path/to/filing.pdf"],
    "jurisdiction": "Illinois"
  }
}
```

Expected output:
```javascript
{
  "case_id": "CHITTY-PEO-20251018-abc123",
  "chitty_ids": ["CHITTY-EVNT-...", "CHITTY-PROP-..."],
  "compliance_status": { /* validation results */ },
  "workflow_state": "in_progress"
}
```

---

## Architecture Patterns

### MCP Server Lifecycle

1. **Initialization**: Create Server instance with capabilities
2. **Handler Setup**: Register ListTools and CallTool handlers
3. **Transport**: Connect to StdioServerTransport
4. **Execution**: Process tool calls via registered handlers

### Evidence Processing Flow

1. **Intake**: File received in incoming directory or via tool call
2. **Hashing**: SHA256 hash calculated for duplicate detection
3. **ChittyID Generation**: Unique exhibit ID minted (format: `{CASE_ID}-EXH-{DATE}-{HASH}`)
4. **Categorization**: Auto-categorize or use specified category
5. **Storage**: Original stored in `.originals/` with hash prefix
6. **Linking**: Symlink created in category directory
7. **Metadata**: JSON metadata file created with chain of custody
8. **Registry**: Record added to ChittyLedger (if available)

### Chain Execution Pattern

1. **Validation**: Check required parameters and tool availability
2. **Orchestration**: Execute tools in dependency order
3. **Error Handling**: Rollback on failure (if enabled)
4. **Result Aggregation**: Collect outputs from all tools
5. **Summary**: Generate execution summary with metrics

---

## Key Files

- `mcp-evidence-server/index.js` - Evidence intake server implementation
- `config/chains.json` - Chain workflow definitions (5 chains, 19 tools)
- `config/claude-desktop-config.json` - Claude Desktop integration config
- `config/README.md` - Configuration file documentation

---

## Integration with ChittyOS Framework

ChittyMCP follows ChittyOS compliance requirements:

**ChittyID Compliance**:
- All IDs minted from `https://id.chitty.cc`
- Format: `CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}`
- Entities: PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR
- Validation: ChittyCheck enforces 1189+ pattern rules

**Service Registration**:
- Register with ChittyRegistry for service discovery
- Health endpoints for monitoring
- Version management

**Authentication**:
- Use `CHITTY_ID_TOKEN` for ChittyOS service authentication
- OAuth integration for portal access

---

## Common Commands

```bash
# Evidence Server
cd mcp-evidence-server
npm install
npm run dev                    # Development mode
npm run start                  # Production mode

# Unified Server
cd mcp-unified-consolidated
npm install
npm run dev                    # Watch mode
npm run start                  # Production
npm run cli                    # CLI interface

# Testing
node index.js                  # Direct execution
```

---

## Debugging

**Evidence Server Issues**:
- Check permissions on Evidence-Intake directory
- Verify Google Drive sync status
- Validate database connection (if using ChittyLedger)
- Check ChittyID service availability

**MCP Connection Issues**:
- Verify Claude Desktop config JSON syntax
- Check file paths in config
- Review Claude Desktop logs: `~/Library/Logs/Claude/mcp*.log`
- Ensure node executable is in PATH

**Chain Execution Failures**:
- Validate chain definition in `config/chains.json`
- Check tool availability
- Verify required parameters
- Review error messages in chain execution summary

---

**Version**: 1.0.0
**Created**: October 18, 2025
**ChittyOS Framework**: v1.0.1
**MCP SDK**: 0.5.0
