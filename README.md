![ChittyOS](https://img.shields.io/badge/ChittyOS-service-6366F1?style=flat-square)
![Tier](https://img.shields.io/badge/tier-3%20operational-3730A3?style=flat-square)

# ChittyMCP - Consolidated MCP Servers

**Version 3.0.0** - Modular, consolidated Model Context Protocol servers for the ChittyOS ecosystem.

[![ChittyOS Framework](https://img.shields.io/badge/ChittyOS-v1.0.1-blue)](https://chitty.cc)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-0.5.0-green)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

---

## ✨ What's New in v3.0.0

**Modular Architecture** - Completely refactored with:
- ✅ **Core module** with reusable MCP server base class
- ✅ **Dynamic tool loading** - add tools without touching core code
- ✅ **Integration layer** - centralized ChittyOS service clients
- ✅ **Chain execution** - multi-tool workflow orchestration
- ✅ **15+ tools** across 4 domains (evidence, legal, infrastructure, sync)

**New Structure**:
```
src/
├── core/           # Shared utilities (BaseMCPServer, ToolLoader, ChainExecutor)
├── integration/    # Service clients (ChittyID, Cloudflare, Notion)
├── tools/          # Modular tools (evidence, legal, infrastructure, sync)
└── servers/        # Server implementations (unified, evidence)
```

---

## Status

| Component | Status | Description |
|-----------|--------|-------------|
| **Core Module** | ✅ Complete | BaseMCPServer, ToolLoader, ChainExecutor, Logger |
| **Integration Layer** | ✅ Complete | ChittyID, Cloudflare, Notion clients |
| **Evidence Tools** | ✅ Complete | 4 tools - fully implemented |
| **Legal Tools** | ✅ Complete | 4 tools - ChittyID integration working |
| **Infrastructure Tools** | ✅ Complete | 4 tools - Cloudflare API integration |
| **Sync Tools** | ✅ Complete | 3 tools - device sync framework |
| **Unified Server** | ✅ Complete | Dynamic loading, chain execution |
| **Evidence Server** | ✅ Complete | Standalone server using modular tools |

---

## Quick Start

### Installation

```bash
# Install dependencies
npm install
```

### Running Servers

```bash
# Unified server (all 15+ tools + chain execution)
npm start

# Evidence server only (4 tools)
npm start:evidence

# Development mode with auto-reload
npm run dev
npm run dev:evidence
```

### Environment Variables

```bash
# ChittyOS Core
CHITTY_ID_TOKEN=<service token from ChittyID>
CHITTYID_SERVICE=https://id.chitty.cc
CHITTY_ENV=production

# Cloudflare (optional)
CLOUDFLARE_API_TOKEN=<api token>
CLOUDFLARE_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541

# Notion (optional)
NOTION_TOKEN=<integration token>
NOTION_DATABASE_ID=<database id>

# Logging
LOG_LEVEL=INFO  # DEBUG|INFO|WARN|ERROR
```

---

## Servers

### 1. Evidence Intake Server ✅

**Purpose**: Legal evidence processing for case management
**Case**: Arias v. Bianchi (2024D007847)
**Status**: Fully working

**Tools (4)**:
- `intake_evidence` - Process and categorize evidence files
- `list_evidence` - Query evidence by category
- `get_evidence_stats` - Get case statistics
- `start_intake_monitoring` - Watch directory for new files

**Features**:
- SHA256 duplicate detection
- 14 evidence categories
- Chain of custody tracking
- Real-time file monitoring with chokidar
- Google Drive integration
- PostgreSQL registry (optional)

**Evidence path**: `/Users/nb/Evidence-Intake/2024D007847-Arias-v-Bianchi/`

**Example**:
```javascript
// Intake evidence
await intake_evidence({
  files: ["/path/to/document.pdf"],
  category: "07_COURT_FILINGS",
  priority: "high"
});
```

---

### 2. Unified Consolidated Server 🟡

**Purpose**: Multi-domain MCP server with ChittyOS integration
**Status**: Schema complete, implementations are mostly placeholders
**Version**: 3.0.0

**Tools (19)** - organized by domain:

#### Executive (5) - ⚠️ Placeholder implementations
- `analyze_performance` - Returns mock performance data
- `risk_assessment` - Returns mock risk data
- `make_executive_decision` - Returns template decisions
- `strategic_planning` - Returns placeholder plans
- `delegate_task` - Returns mock task delegations

#### Legal (7) - 🟡 Partially implemented
- `generate_chitty_id` - ✅ Works (calls id.chitty.cc), has fallback
- `create_legal_case` - ⚠️ Placeholder
- `analyze_document` - ⚠️ Placeholder
- `process_payment` - ⚠️ Placeholder
- `compliance_check` - ⚠️ Placeholder
- `search_cases` - ⚠️ Placeholder
- `execute_workflow` - ⚠️ Placeholder

#### Infrastructure (4) - ⚠️ Placeholder implementations
- `deploy_worker` - Returns mock deployment results
- `manage_kv_namespace` - Returns mock KV operations
- `manage_r2_bucket` - Returns mock R2 operations
- `execute_d1_query` - Returns mock query results

#### Sync (3) - ⚠️ Placeholder implementations
- `register_mcp_server` - Returns mock registration
- `sync_mcp_state` - Returns mock sync status
- `get_synced_servers` - Returns empty list

**Chain Workflows**: 5 chains defined in `config/chains.json` but not fully orchestrated

---

### 3. MCP Execution Service ✅

**Purpose**: Remote tool execution and service discovery
**Language**: TypeScript
**Status**: Fully working

**Tools (3)**:
- `execute_remote_tool` - Execute tools on remote MCP servers
- `discover_services` - List available services
- `health_check` - Check service health

**Features**:
- Retry logic with exponential backoff
- Service registry for ChittyOS endpoints
- Timeout handling
- Health monitoring

**Services registered**:
- `chittyid` → https://id.chitty.cc
- `chittyregistry` → https://registry.chitty.cc
- `chittygateway` → https://gateway.chitty.cc

**Example**:
```typescript
await execute_remote_tool({
  service: "chittyid",
  tool: "mint",
  arguments: { entity_type: "PEO" },
  config: { timeout: 10000, retries: 3 }
});
```

---

## Configuration

### Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chittymcp-unified": {
      "command": "node",
      "args": ["/absolute/path/to/chittymcp/src/servers/unified-server.js"],
      "env": {
        "CHITTY_ID_TOKEN": "${CHITTY_ID_TOKEN}",
        "CLOUDFLARE_API_TOKEN": "${CLOUDFLARE_API_TOKEN}",
        "LOG_LEVEL": "INFO"
      }
    },
    "evidence-intake": {
      "command": "node",
      "args": ["/absolute/path/to/chittymcp/src/servers/evidence-server.js"],
      "env": {}
    }
  }
}
```

**Replace** `/absolute/path/to/` with your actual path.

**Legacy servers** (still functional):
- `mcp-evidence-server/index.js` → Use `src/servers/evidence-server.js` instead
- `mcp-unified-consolidated/unified-server.js` → Use `src/servers/unified-server.js` instead

---

## Known Issues

1. **OpenAI Package** - `package.json` references wrong package name
   - Fix: `cd mcp-unified-consolidated && npm install openai@latest`

2. **Unified Server Tools** - Most tools return placeholder/mock data
   - Need real implementations for executive, infrastructure, and sync domains

3. **Neon Auth** - OAuth flow may timeout
   - Run: `neon auth login` before using

4. **Hardcoded Paths** - Evidence server uses `/Users/nb/Evidence-Intake`
   - Set `EVIDENCE_BASE_PATH` in `.env` to override

5. **Missing .env** - No environment file by default
   - Copy `.env.example` and fill in credentials

---

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for:
- Diagnostic script usage
- Common error fixes
- LaunchD service issues (macOS)
- Network timeout solutions
- Package dependency fixes

**Quick diagnostics**:
```bash
# Run health check
bash diagnostics.sh

# Auto-fix common issues
bash mcp-repair.sh
```

---

## Development

```bash
# Evidence server (watch mode)
cd mcp-evidence-server
npm run dev

# Unified server (watch mode)
cd mcp-unified-consolidated
npm run dev

# MCP Exec (TypeScript compilation)
cd services/mcp-exec
npm run build
npm run dev
```

---

## Deployment

### Cloudflare Workers

Unified server can be deployed as a Cloudflare Worker:

```bash
# Deploy to production
wrangler deploy

# Monitor logs
wrangler tail chittymcp

# Set secrets
wrangler secret put CHITTY_ID_TOKEN
```

See `wrangler.toml` for configuration.

---

## Evidence Categories

The Evidence Intake server supports 14 categories:

| Code | Category | Description |
|------|----------|-------------|
| 00 | KEY_EXHIBITS | High-priority evidence |
| 01 | TRO_PROCEEDINGS | TRO proceedings |
| 02 | LLC_FORMATION | Corporate documents |
| 03 | MEMBERSHIP_REMOVAL | Membership proceedings |
| 04 | PREMARITAL_FUNDING | Pre-marital property |
| 05 | PROPERTY_TRANSACTIONS | Real estate |
| 06 | FINANCIAL_STATEMENTS | Financial docs |
| 07 | COURT_FILINGS | Court pleadings |
| 08 | ATTORNEY_CORRESPONDENCE | Attorney letters |
| 09 | PERJURY_EVIDENCE | Perjury evidence |
| 10 | SANCTIONS_RULE137 | Sanctions docs |
| 11 | COLOMBIAN_PROPERTY | Colombian property |
| 12 | LEASE_AGREEMENTS | Leases |
| 98 | DUPLICATES | Duplicate files |
| 99 | UNSORTED | Uncategorized |

Files are automatically categorized based on filename patterns.

---

## ChittyID Compliance

**CRITICAL**: All ChittyIDs must be generated via `id.chitty.cc` API.

- Format: `CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}`
- Entities: PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR
- Never generate IDs locally

---

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Detailed project overview for Claude Code
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and fixes
- [config/chains.json](./config/chains.json) - Chain workflow definitions

---

## Architecture

### Modular Design

```
chittymcp/
├── src/
│   ├── core/                    # Shared core utilities
│   │   ├── mcp-server.js       # BaseMCPServer class
│   │   ├── tool-loader.js      # Dynamic tool loading
│   │   ├── chain-executor.js   # Multi-tool workflows
│   │   └── logger.js           # Centralized logging
│   ├── integration/            # ChittyOS service clients
│   │   ├── chittyid-client.js  # ChittyID service
│   │   ├── cloudflare-client.js # Cloudflare API
│   │   └── notion-client.js    # Notion integration
│   ├── tools/                  # Tool modules by domain
│   │   ├── evidence/           # 4 evidence tools
│   │   ├── legal/              # 4 legal tools
│   │   ├── infrastructure/     # 4 infrastructure tools
│   │   └── sync/               # 3 sync tools
│   └── servers/                # Server implementations
│       ├── unified-server.js   # Full consolidated server
│       └── evidence-server.js  # Standalone evidence server
├── config/
│   ├── chains.json             # Workflow chain definitions
│   └── server-config.json      # Server configuration
└── Legacy (backwards compatible):
    ├── mcp-evidence-server/
    └── mcp-unified-consolidated/
```

### Benefits

- **Code Reuse**: Shared utilities across all servers
- **Easy Extension**: Add new tools without touching core
- **Clean Separation**: Tools, integrations, and core separated
- **Dynamic Loading**: Tools loaded at runtime
- **Chain Execution**: Complex workflows from simple tools

## Adding New Tools

1. Create tool module in `src/tools/<category>/`:

```javascript
// src/tools/mycategory/index.js
export const tools = [{
  name: "my_tool",
  description: "What my tool does",
  inputSchema: { /* ... */ }
}];

export { handlers } from "./handlers.js";

// src/tools/mycategory/handlers.js
export const handlers = {
  async my_tool(args) {
    return {
      content: [{
        type: "text",
        text: "Result"
      }]
    };
  }
};
```

2. Restart server - tools are loaded automatically!

## Workflow Chains

Execute multi-tool workflows defined in `config/chains.json`:

```javascript
// Execute a chain
await execute_chain({
  chain_name: "legal-workflow",
  parameters: {
    case_type: "civil",
    documents: ["/path/to/filing.pdf"],
    client_id: "CHITTY-PEO-..."
  }
});
```

**Available chains**:
- `executive-decision` - Strategic decision-making workflow
- `legal-workflow` - Complete legal case management
- `infrastructure-deploy` - Cloudflare deployment
- `cross-sync` - Device synchronization
- `full-orchestration` - All tools combined

## Roadmap

**v3.0.0 - Completed** ✅:
- [x] Modular architecture with core/tools/integration layers
- [x] Dynamic tool loading system
- [x] Chain execution framework
- [x] 15+ tools across 4 domains
- [x] ChittyID integration
- [x] Cloudflare API integration
- [x] Unified and standalone servers

**Next (v3.1.0)**:
- [ ] Executive tool AI integration (Anthropic/OpenAI)
- [ ] ChittyLedger PostgreSQL integration
- [ ] Hot reload for tool modules
- [ ] Web API gateway

**Future (v4.0.0)**:
- [ ] Multi-platform sync (ChatGPT, CustomGPT)
- [ ] Evidence monitoring automation
- [ ] Advanced chain orchestration (rollback, parallel execution)

---

## License

MIT License - see [LICENSE](./LICENSE)

---

## Support

- **Documentation**: [CLAUDE.md](./CLAUDE.md) and [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Issues**: https://github.com/chittyos/chittymcp/issues

---

**Last Updated**: 2025-10-30
**Version**: 3.0.0
**ChittyOS Framework**: v1.0.1
**MCP SDK**: 0.5.0
