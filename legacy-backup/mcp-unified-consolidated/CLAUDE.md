# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Unified Consolidated MCP Server** - Consolidated Model Context Protocol server with all ChittyChat connectors, finance tools, and AI capabilities. This server provides 19 tools across 4 domains organized into 5 workflow chains.

**Location**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittymcp/mcp-unified-consolidated`
**Status**: Stub implementation (requires completion)
**Target Deployment**: `chittymcp.chittycorp-llc.workers.dev`
**MCP SDK**: 0.5.0

---

## Purpose

Consolidate all ChittyOS MCP tools into a single unified server with:
- **Executive Tools** - Strategic decision-making and delegation (5 tools)
- **Legal Tools** - Case management and compliance (7 tools)
- **Infrastructure Tools** - Cloudflare resource management (4 tools)
- **Sync Tools** - Cross-device state synchronization (3 tools)

---

## Architecture

### Tool Organization

The unified server provides **19 tools** organized into **5 workflow chains**:

#### 1. Executive Decision Chain (5 tools)
- `make_executive_decision` - Strategic decision-making
- `delegate_task` - Task delegation
- `analyze_performance` - Performance analysis
- `strategic_planning` - Strategic planning
- `risk_assessment` - Risk analysis

#### 2. Legal Workflow Chain (7 tools)
- `generate_chitty_id` - ChittyID generation via id.chitty.cc
- `create_legal_case` - Legal case creation
- `analyze_document` - Document analysis
- `process_payment` - Payment processing
- `compliance_check` - Compliance validation
- `search_cases` - Case search
- `execute_workflow` - Workflow execution

#### 3. Infrastructure Deploy Chain (4 tools)
- `deploy_worker` - Cloudflare Workers deployment
- `manage_kv_namespace` - KV namespace management
- `manage_r2_bucket` - R2 bucket management
- `execute_d1_query` - D1 database queries

#### 4. Cross-Sync Chain (3 tools)
- `register_mcp_server` - MCP server registration
- `sync_mcp_state` - State synchronization
- `get_synced_servers` - Query synced servers

#### 5. Full Orchestration Chain (all 19 tools)
- Complete workflow orchestration
- Multi-domain task coordination
- Rollback support

---

## Key Files

- `unified-server.js` - Main server implementation (STUB - needs implementation)
- `cli.js` - CLI interface (referenced in package.json, not yet created)
- `package.json` - Dependencies and scripts
- `../config/chains.json` - Chain workflow definitions
- `../config/claude-desktop-config.json` - Claude Desktop integration

---

## Development

### Current Status

**Implemented**: ✗ (stub only)
**Package Configuration**: ✓
**Chain Definitions**: ✓ (in ../config/chains.json)
**Dependencies**: ✓

### Implementation Required

1. **Server Setup** (unified-server.js)
   ```javascript
   import { Server } from "@modelcontextprotocol/sdk/server/index.js";
   import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

   class UnifiedMCPServer {
     constructor() {
       this.server = new Server({
         name: "@mcp/unified-consolidated",
         version: "1.0.0"
       }, {
         capabilities: { tools: {} }
       });
     }
   }
   ```

2. **Tool Handlers**
   - Implement all 19 tools
   - Connect to ChittyOS services (ChittyID, ChittyRegistry, etc.)
   - Cloudflare API integration
   - AI model integration (Anthropic, OpenAI)

3. **Chain Orchestration**
   - Load chain definitions from ../config/chains.json
   - Execute multi-tool workflows
   - Handle dependencies and rollbacks

4. **CLI Interface** (cli.js)
   - Commander-based CLI
   - Interactive prompts with Inquirer
   - Table output with cli-table3
   - Progress indicators with Ora

### Running the Server

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production mode
npm run start

# CLI interface
npm run cli
```

### Testing

Once implemented, test with Claude Desktop:

```json
{
  "mcpServers": {
    "chittymcp-unified": {
      "command": "node",
      "args": ["/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittymcp/mcp-unified-consolidated/unified-server.js"],
      "env": {
        "CHITTY_ENV": "production",
        "CHITTYID_SERVICE": "https://id.chitty.cc",
        "CLOUDFLARE_API_TOKEN": "${CLOUDFLARE_API_TOKEN}",
        "CLOUDFLARE_ACCOUNT_ID": "${CLOUDFLARE_ACCOUNT_ID}"
      }
    }
  }
}
```

---

## Dependencies

### Core MCP
- `@modelcontextprotocol/sdk` ^0.5.0 - MCP server framework

### AI Integration
- `@anthropic-ai/sdk` ^0.24.0 - Anthropic Claude API
- `openai` ^4.52.0 - OpenAI API

### CLI Tools
- `commander` ^12.0.0 - Command-line interface framework
- `chalk` ^5.3.0 - Terminal string styling
- `inquirer` ^9.2.0 - Interactive command-line prompts
- `cli-table3` ^0.6.3 - Table rendering
- `ora` ^8.0.0 - Elegant terminal spinners

---

## Chain Workflow Examples

### Executive Decision Chain

```javascript
// Input
{
  "chain": "executive-decision",
  "parameters": {
    "context": "Q4 infrastructure optimization",
    "decision_type": "resource_allocation",
    "stakeholders": ["engineering", "finance"],
    "timeline": "2 weeks",
    "budget": "$50000"
  }
}

// Output
{
  "decision": "Consolidate workers from 34 to 5",
  "rationale": "85% resource reduction, $500/month savings",
  "action_items": [
    "Audit current worker usage",
    "Create consolidation plan",
    "Test unified worker",
    "Deploy and verify"
  ],
  "risk_assessment": {
    "level": "medium",
    "mitigations": ["Blue-green deployment", "Rollback plan"]
  }
}
```

### Legal Workflow Chain

```javascript
// Input
{
  "chain": "legal-workflow",
  "parameters": {
    "case_type": "civil",
    "documents": ["/path/to/complaint.pdf", "/path/to/exhibit-a.pdf"],
    "client_id": "CHITTY-PEO-20251018-abc123",
    "deadline": "2025-11-01",
    "jurisdiction": "Illinois"
  }
}

// Output
{
  "case_id": "CHITTY-PEO-20251018-def456",
  "chitty_ids": [
    "CHITTY-EVNT-20251018-ghi789",  // Complaint
    "CHITTY-PROP-20251018-jkl012"   // Exhibit A
  ],
  "compliance_status": {
    "chittyid_format": "valid",
    "metadata_complete": true,
    "registration_confirmed": true
  },
  "workflow_state": "in_progress"
}
```

### Infrastructure Deploy Chain

```javascript
// Input
{
  "chain": "infrastructure-deploy",
  "parameters": {
    "worker_name": "chittychat-unified",
    "environment": "production",
    "kv_namespaces": ["sessions", "cache"],
    "r2_buckets": ["uploads"],
    "d1_databases": ["analytics"]
  }
}

// Output
{
  "deployment_id": "deploy-20251018-abc123",
  "worker_url": "https://chittychat-unified.chittycorp-llc.workers.dev",
  "resources": {
    "kv": ["sessions-prod", "cache-prod"],
    "r2": ["uploads-prod"],
    "d1": ["analytics-prod"]
  },
  "status": "deployed"
}
```

### Cross-Sync Chain

```javascript
// Input
{
  "chain": "cross-sync",
  "parameters": {
    "device_id": "macbook-pro-2024",
    "sync_type": "mcp_servers",
    "state_data": {
      "servers": ["evidence-intake", "chittymcp-unified"],
      "configurations": { /* ... */ }
    },
    "conflict_resolution": "last_write_wins"
  }
}

// Output
{
  "sync_status": "completed",
  "server_count": 2,
  "last_sync": "2025-10-18T19:30:00Z",
  "conflicts": []
}
```

---

## Implementation Guide

### Step 1: Server Initialization

```javascript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

class UnifiedMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "@mcp/unified-consolidated",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getAllTools()
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return this.routeToolCall(request.params.name, request.params.arguments);
    });
  }

  getAllTools() {
    return [
      // Executive tools
      ...this.getExecutiveTools(),
      // Legal tools
      ...this.getLegalTools(),
      // Infrastructure tools
      ...this.getInfrastructureTools(),
      // Sync tools
      ...this.getSyncTools()
    ];
  }

  async routeToolCall(toolName, args) {
    // Route to appropriate handler based on tool name
    switch(toolName) {
      case 'make_executive_decision':
        return this.handleExecutiveDecision(args);
      case 'generate_chitty_id':
        return this.handleGenerateChittyID(args);
      // ... all 19 tools
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Unified MCP Server running on stdio");
  }
}

const server = new UnifiedMCPServer();
server.run().catch(console.error);
```

### Step 2: ChittyOS Service Integration

```javascript
import fetch from 'node-fetch';

class ChittyOSClient {
  constructor() {
    this.chittyIdService = process.env.CHITTYID_SERVICE || 'https://id.chitty.cc';
    this.chittyIdToken = process.env.CHITTY_ID_TOKEN;
  }

  async mintChittyID(entityType, metadata) {
    const response = await fetch(`${this.chittyIdService}/v1/mint`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.chittyIdToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entityType, metadata })
    });

    return response.json();
  }
}
```

### Step 3: Tool Implementation Pattern

```javascript
async handleExecutiveDecision(args) {
  const { context, decision_type, stakeholders, timeline, budget } = args;

  // 1. Analyze performance
  const performance = await this.analyzePerformance({ context });

  // 2. Assess risks
  const risks = await this.assessRisks({ context, decision_type });

  // 3. Make decision
  const decision = this.generateDecision(performance, risks, budget);

  // 4. Create action items
  const actionItems = this.planActionItems(decision, timeline, stakeholders);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        decision: decision.summary,
        rationale: decision.rationale,
        action_items: actionItems,
        risk_assessment: risks
      }, null, 2)
    }]
  };
}
```

### Step 4: Chain Orchestration

```javascript
async executeChain(chainName, parameters) {
  const chain = this.loadChain(chainName); // from ../config/chains.json
  const results = [];

  for (const toolName of chain.tools) {
    const result = await this.routeToolCall(toolName, parameters);
    results.push({ tool: toolName, result });

    // Check for errors and handle rollback if needed
    if (parameters.rollback_enabled && result.error) {
      await this.rollbackChain(results.slice(0, -1));
      throw new Error(`Chain failed at ${toolName}: ${result.error}`);
    }
  }

  return {
    orchestration_id: generateOrchestrationID(),
    execution_plan: chain,
    results,
    summary: this.summarizeResults(results)
  };
}
```

---

## Environment Variables

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

# AI APIs
ANTHROPIC_API_KEY=<from 1Password>
OPENAI_API_KEY=<from 1Password>

# Database
NEON_DATABASE_URL=<from 1Password>
```

---

## Integration Points

### ChittyID Service
- Endpoint: `https://id.chitty.cc/v1/mint`
- Authentication: Bearer token via `CHITTY_ID_TOKEN`
- Entity types: PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR

### ChittyRegistry
- Endpoint: `https://registry.chitty.cc`
- Purpose: Service discovery and health monitoring
- Register MCP server on startup

### Cloudflare API
- Workers deployment
- KV namespace management
- R2 bucket operations
- D1 database queries

### AI Models
- Anthropic Claude for advanced reasoning
- OpenAI GPT-4 for specialized tasks

---

## Rate Limits

From `../config/chains.json`:
- **Requests per minute**: 60
- **Concurrent chains**: 5

Implement rate limiting in server to prevent API throttling.

---

## Next Steps

1. **Implement unified-server.js**
   - Create UnifiedMCPServer class
   - Implement all 19 tool handlers
   - Add chain orchestration logic

2. **Create cli.js**
   - Commander-based CLI interface
   - Interactive tool execution
   - Chain workflow runner

3. **Add Tests**
   - Unit tests for each tool
   - Integration tests for chains
   - Mock ChittyOS services

4. **Deploy to Cloudflare Workers**
   - Create wrangler.toml
   - Configure environment variables
   - Deploy to production

5. **Documentation**
   - API documentation
   - Tool usage examples
   - Chain workflow guide

---

**Version**: 1.0.0 (stub)
**Target Version**: 3.0.0 (fully implemented)
**MCP SDK**: 0.5.0
**Created**: October 18, 2025
