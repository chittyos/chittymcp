# ChittyMCP Charter

## Classification
- **Tier**: 3 (Service Layer)
- **Organization**: CHITTYOS
- **Domain**: N/A (MCP servers)

## Mission

ChittyMCP provides **Model Context Protocol (MCP) server implementations** for the ChittyOS ecosystem. It contains multiple MCP servers for legal evidence processing, unified ChittyOS operations, and executive decision-making workflows accessible to Claude, GPT, and other AI agents.

## Scope

### IS Responsible For
- MCP server implementations for ChittyOS services
- Legal evidence intake and processing (Marie Kondo Evidence System)
- Evidence categorization (14 legal categories)
- SHA256-based duplicate detection
- Chain of custody tracking
- Google Drive evidence monitoring
- Chain workflow execution (executive, legal, infrastructure, sync)
- Claude Desktop integration
- Cross-device MCP synchronization

### IS NOT Responsible For
- Identity generation (ChittyID - must call service)
- Token provisioning (ChittyAuth)
- Service registration (ChittyRegister)
- Database storage (ChittyLedger - integration only)
- Email routing (ChittyRouter)

## MCP Servers

### 1. Evidence Intake Server (`mcp-evidence-server/`)
**Purpose**: Automated legal evidence processing

**Tools**:
| Tool | Purpose |
|------|---------|
| `intake_evidence` | Process evidence files into categories |
| `list_evidence` | Query evidence by category/search |
| `get_evidence_stats` | Retrieve case statistics |
| `start_intake_monitoring` | Monitor directory for new evidence |

**Evidence Categories** (14 total):
- `00_KEY_EXHIBITS` - High-priority evidence
- `01_TRO_PROCEEDINGS` - Temporary restraining orders
- `02_LLC_FORMATION` - Corporate documents
- `07_COURT_FILINGS` - Court pleadings/orders
- `09_PERJURY_EVIDENCE` - Evidence of false statements
- `98_DUPLICATES` - Auto-detected duplicates
- `99_UNSORTED` - Uncategorized evidence

### 2. Unified Consolidated Server (`mcp-unified-consolidated/`)
**Purpose**: All ChittyOS connectors, finance tools, AI capabilities

**Tool Groups** (19 total):
- Executive decision-making (5 tools)
- Legal workflow (7 tools)
- Infrastructure deployment (4 tools)
- Cross-device sync (3 tools)

## Chain Workflows

| Chain | Tools | Use Case |
|-------|-------|----------|
| `executive-decision` | analyze_performance, risk_assessment, make_executive_decision, strategic_planning, delegate_task | Strategic decisions with risk analysis |
| `legal-workflow` | generate_chitty_id, create_legal_case, analyze_document, compliance_check, search_cases, process_payment, execute_workflow | End-to-end legal case processing |
| `infrastructure-deploy` | deploy_worker, manage_kv_namespace, manage_r2_bucket, execute_d1_query | ChittyOS service deployment |
| `cross-sync` | register_mcp_server, sync_mcp_state, get_synced_servers | Cross-device state sync |

## Dependencies

| Type | Service | Purpose |
|------|---------|---------|
| Upstream | ChittyID | ID generation (MUST call service) |
| Upstream | ChittyAuth | Token authentication |
| Peer | ChittyLedger | Evidence registry |
| Peer | ChittyRouter | AI routing gateway |
| Peer | ChittyRegistry | Service discovery |
| External | Google Drive | Evidence source |
| External | Claude Desktop | MCP client |

## Evidence Processing Flow

```
Intake → Hashing (SHA256) → ChittyID Generation → Categorization → Storage → Linking → Metadata → Registry
```

## ChittyID Compliance

**CRITICAL**: All ChittyIDs MUST be minted from `https://id.chitty.cc`
- Format: `CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}`
- Entities: PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR
- Never generate IDs locally

## Claude Desktop Configuration

```json
{
  "mcpServers": {
    "evidence-intake": {
      "command": "node",
      "args": ["/path/to/mcp-evidence-server/index.js"]
    }
  }
}
```

## Ownership

| Role | Owner |
|------|-------|
| Service Owner | ChittyOS |
| Technical Lead | @chittyos-infrastructure |
| Contact | mcp@chitty.cc |

## Compliance

- [ ] CLAUDE.md development guide present
- [ ] ChittyID compliance (no local generation)
- [ ] MCP SDK version 0.5.0+
- [ ] Evidence categories documented
- [ ] Chain workflows defined in config/chains.json

---
*Charter Version: 1.0.0 | Last Updated: 2026-01-13*
