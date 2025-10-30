# ChittyMCP - Model Context Protocol Servers

MCP server implementations for the ChittyOS ecosystem.

[![ChittyOS Framework](https://img.shields.io/badge/ChittyOS-v1.0.1-blue)](https://chitty.cc)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-0.5.0-green)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

---

## Status

| Server | Status | Tools | Implementation |
|--------|--------|-------|----------------|
| Evidence Intake | ✅ Working | 4 | Fully implemented |
| Unified Consolidated | 🟡 Partial | 19 | Schema defined, most handlers are placeholders |
| MCP Exec | ✅ Working | 3 | Fully implemented |

---

## Quick Start

### 1. Set up environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your credentials
nano .env
```

**Required variables**:
- `CHITTY_ID_TOKEN` - ChittyID service auth token
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `NEON_DATABASE_URL` - PostgreSQL connection string

### 2. Install and run

```bash
# Evidence Intake Server (works)
cd mcp-evidence-server
npm install
node index.js

# Unified Server (mostly placeholders)
cd mcp-unified-consolidated
npm install
node unified-server.js

# MCP Exec (works)
cd services/mcp-exec
npm install
npm run build
node dist/index.js
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
    "evidence-intake": {
      "command": "node",
      "args": ["/absolute/path/to/chittymcp/mcp-evidence-server/index.js"],
      "env": {
        "NEON_DATABASE_URL": "${NEON_DATABASE_URL}"
      }
    },
    "chittymcp-unified": {
      "command": "node",
      "args": ["/absolute/path/to/chittymcp/mcp-unified-consolidated/unified-server.js"],
      "env": {
        "CHITTY_ID_TOKEN": "${CHITTY_ID_TOKEN}"
      }
    },
    "mcp-exec": {
      "command": "node",
      "args": ["/absolute/path/to/chittymcp/services/mcp-exec/dist/index.js"],
      "env": {
        "CHITTY_ID_TOKEN": "${CHITTY_ID_TOKEN}"
      }
    }
  }
}
```

**Replace** `/absolute/path/to/` with your actual path.

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

## Roadmap

**Completed**:
- [x] Evidence Intake Server (4 tools, fully working)
- [x] MCP Exec Service (3 tools, fully working)
- [x] Unified Server tool schemas (19 tools)
- [x] Chain workflow definitions

**In Progress**:
- [ ] Unified Server real implementations (currently placeholders)
- [ ] ChittyLedger PostgreSQL integration
- [ ] Cloudflare API integration
- [ ] AI service integration (OpenAI, Anthropic)

**Planned**:
- [ ] Multi-platform sync (ChatGPT, CustomGPT)
- [ ] Web API gateway
- [ ] Evidence monitoring automation

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
