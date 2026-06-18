---
uri: chittycanon://docs/tech/architecture/mcp-portal-agent-memory-migration
namespace: chittycanon://docs/tech
type: architecture
version: 1.0.0
status: PROPOSED
registered_with: chittycanon://core/services/canon
title: "MCP Portal & Agent Memory Migration Design"
author: "ChittyOS Foundation"
created: 2026-06-18T00:00:00Z
visibility: PUBLIC
---

# MCP Portal & Agent Memory Migration Design

## 1. Problem Statement & Goals

The current ChittyOS infrastructure relies on custom-built middleware components that introduce unnecessary maintenance overhead, security vulnerability surface, and context window bloat:
1. **Aggregator Overhead**: `chittymcp` serves as a custom routing gateway, managing routing tables, JWT access authentication, CORS, and endpoint pooling.
2. **Context Window Proliferation**: Repeated wrapping of tool schemas across nesting boundaries ("Russian dolls") leads to bloated payloads before they reach the model context.
3. **Custom State Complexity**: Memory state (in `ch1tty` and `chittyconnect`'s `MemoryCloude`) is managed using manual KV indexes, custom vector embedding generation (Workers AI), and Vectorize indexing.

### Goals
* **Deprecate Custom Proxies**: Transition from `chittymcp` to native **Cloudflare MCP Portals** for centralized server aggregation, Namespace Routing, and OAuth management.
* **Adopt Managed Memory**: Replace the custom embedding and vector search logic inside `ch1tty` and `MemoryCloude` with native **Cloudflare Agent Memory** bindings.
* **Preserve Sovereignty**: Ensure that the semantic memory profiles and behavioral patterns tracked via `ChittyDNA` remain bound to the entity's sovereign **ChittyID** (Person / Synthetic `P` type).
* **Zero Client Disruption**: Keep the public API and tool schemas fully backward-compatible so that downstream clients and local hooks (`chittycontext` / `chittytasks`) continue to work seamlessly.

---

## 2. Target Architecture

```
                                  [ AI Client (Claude Code / Codex) ]
                                                   │
                                                   ▼
                                     [ Cloudflare MCP Portal ]
                                                   │
                                                   ├─► Code Mode: Single 'code' tool (Dynamic Worker Sandbox)
                                                   ├─► Gateway: HTTP Logging, DLP Scans, & Gateway Policies
                                                   │
                ┌──────────────────────────────────┴──────────────────────────────────┐
                ▼                                                                     ▼
    [ chittyagent-tasks ]                                                       [ ch1tty Worker ]
     (Upstream MCP Server)                                                      (Durable Object)
                │                                                                     │
                │                                       ┌─────────────────────────────┤
                ▼                                       ▼                             ▼
    [ Structured Tasks DB ]                      [ Agent Memory ]               [ ChittyConnect ]
                                                   (Env.MEMORY)                  (MemoryCloude)
                                                        │                             │
                                                        ▼                             ▼
                                             [ Sovereign DNA Vault ] ◄────────────────┘
                                              (chitty-memory namespace)
```

### Components
1. **Cloudflare MCP Portal**: Exposes the canonical URL `https://mcp.chitty.cc/mcp` and handles routing, Access policies, and Code Mode sandboxing.
2. **`agent_memory` Binding**: Added to the `ch1tty` and `chittyconnect` workers to interface with the managed memory namespace.
3. **`MemoryCloude` Wrapper**: Acts as a lightweight adapter inside `chittyconnect` translating traditional API calls to the native `agent_memory` profile methods.
4. **`ContextConsciousness`**: Evolved to consume portal metrics, managing failovers and route optimization dynamically via `RATE_LIMIT`.

---

## 3. Integration & Refactoring Details

### 3.1 MemoryCloude Refactoring (`chittyconnect`)
The custom vector-search pipeline in `/src/intelligence/memory-cloude.js` is replaced by wrapping the native `agent_memory` binding methods.

```javascript
// src/intelligence/memory-cloude.js
export class MemoryCloude {
  constructor(env) {
    this.env = env;
    this.memoryNs = env.MEMORY; // Cloudflare Agent Memory binding
  }

  async persistInteraction(sessionId, interaction) {
    if (!this.memoryNs) {
      throw new Error("Agent Memory binding (MEMORY) not available.");
    }
    const profile = await this.memoryNs.getProfile(sessionId);
    const messageContent = `Type: ${interaction.type}\nContent: ${interaction.content || interaction.input}`;
    
    // Auto-extracts facts, events, and tasks natively
    await profile.ingest([
      { role: "assistant", content: messageContent, timestamp: new Date() }
    ], { sessionId });
  }

  async recallContext(sessionId, query, options = {}) {
    if (!this.memoryNs) {
      throw new Error("Agent Memory binding (MEMORY) not available.");
    }
    const profile = await this.memoryNs.getProfile(sessionId);
    const result = await profile.recall(query, {
      thinkingLevel: options.thinking || "low",
      responseLength: options.limit <= 3 ? "short" : "medium"
    });
    
    // Return structured candidates grounded in Agent Memory
    return result.candidates.map(c => ({
      content: c.summary,
      relevanceScore: c.score,
      sessionId: c.sessionId
    }));
  }

  async getSessionSummary(sessionId) {
    if (!this.memoryNs) {
      throw new Error("Agent Memory binding (MEMORY) not available.");
    }
    const profile = await this.memoryNs.getProfile(sessionId);
    const response = await profile.getSummary({ sessionId });
    return response.summary;
  }
}
```

### 3.2 ContextConsciousness & Portal Health
Since the MCP Portal manages the health status of upstream servers (returning status `Ready`, `Sync Required`, or `Error`), `ContextConsciousness` queries the portal status endpoint to detect anomalies:

```javascript
// src/intelligence/context-consciousness.js
async checkServiceHealth(name, service) {
  // Check health by querying the Portal's server list status API
  const portalUrl = this.env.PORTAL_STATUS_URL || "https://mcp.chitty.cc/api/v1/servers";
  try {
    const response = await fetch(portalUrl, {
      headers: { "Authorization": `Bearer ${this.env.PORTAL_API_KEY}` }
    });
    const data = await response.json();
    const server = data.servers.find(s => s.id === name);
    return {
      status: server?.status === "Ready" ? "healthy" : "down",
      lastCheck: Date.now(),
      details: server
    };
  } catch (error) {
    return { status: "down", error: error.message, lastCheck: Date.now() };
  }
}
```

---

## 4. Configuration Changes

### 4.1 Wrangler Binding Additions
Update both `ch1tty/wrangler.jsonc` and `chittyconnect/wrangler.jsonc` to bind to the shared `chitty-memory` namespace.

```jsonc
// wrangler.jsonc
{
  "agent_memory": [
    { "binding": "MEMORY", "namespace": "chitty-memory" }
  ]
}
```

### 4.2 Terraform Configuration for the MCP Portal
To manage the routing Aggregator via Infrastructure-as-Code:

```hcl
resource "cloudflare_zero_trust_access_mcp_server_portal" "chittymcp_portal" {
  account_id = var.cloudflare_account_id
  name       = "ChittyOS MCP Portal"
  hostname   = "mcp.chitty.cc"
}

resource "cloudflare_dns_record" "mcp_portal_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "mcp"
  content = "gateway.agents.cloudflare.com"
  type    = "CNAME"
  proxied = true
}
```

---

## 5. Migration Phases

### Phase 1: Storage Provisioning & Bindings
* Create the shared Agent Memory namespace `chitty-memory` using wrangler CLI.
* Update `wrangler.jsonc` in both `ch1tty` and `chittyconnect` to reference the binding.

### Phase 2: MemoryCloude Adapter Refactoring
* Implement the wrapper modifications in `chittyconnect/src/intelligence/memory-cloude.js` as detailed in §3.1.
* Run Vitest suite on `chittyconnect` to ensure mock persistence/recall endpoints remain operational.

### Phase 3: MCP Portal Configuration
* Setup the MCP Portal in Cloudflare Zero Trust (attaching all `chittyagent-*` upstream endpoints).
* Bind the CNAME record for `mcp.chitty.cc`.
* Enable user-auth and verify instant OAuth redirect hooks.

### Phase 4: Deprecate `chittymcp`
* Re-route downstream clients to point to the new portal domain.
* Turn down the `chittymcp` legacy aggregator worker isolate.
