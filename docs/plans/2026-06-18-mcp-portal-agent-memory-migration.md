# MCP Portal & Agent Memory Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate ChittyOS aggregation from custom `chittymcp` to Cloudflare managed MCP Portals, and state/memory from custom KV/Vectorize to native Cloudflare Agent Memory.

**Architecture:** Bind the shared `chitty-memory` Agent Memory namespace to both `ch1tty` and `chittyconnect` workers, refactoring `MemoryCloude` and `ContextConsciousness` to consume native bindings instead of custom indexing code.

**Tech Stack:** Cloudflare Access, Cloudflare Agent Memory, wrangler.jsonc, Terraform, Hono, Node.js.

---

### Task 1: Add Wrangler Bindings to ch1tty and chittyconnect

**Files:**
- Modify: `ch1tty/wrangler.jsonc`
- Modify: `chittyconnect/wrangler.jsonc`

**Step 1: Verify ch1tty wrangler config has agent_memory**
- Open `ch1tty/wrangler.jsonc` and verify lines 41-43:
  ```json
  "agent_memory": [
    { "binding": "MEMORY", "namespace": "ch1tty-memory" }
  ]
  ```
  Ensure it binds to `"ch1tty-memory"`.

**Step 2: Add agent_memory binding to chittyconnect wrangler config**
- Open `chittyconnect/wrangler.jsonc` and add the `agent_memory` block under the `dev` environment resource bindings:
  ```json
  "agent_memory": [
    { "binding": "MEMORY", "namespace": "ch1tty-memory" }
  ]
  ```

**Step 3: Commit**
```bash
git add chittyconnect/wrangler.jsonc
git commit -m "chore: bind agent_memory namespace to chittyconnect"
```

---

### Task 2: Refactor MemoryCloude in chittyconnect

**Files:**
- Modify: `chittyconnect/src/intelligence/memory-cloude.js`
- Test: `chittyconnect/tests/intelligence/memory-cloude.test.js`

**Step 1: Write failing/stub test in MemoryCloude test file**
- Open `chittyconnect/tests/intelligence/memory-cloude.test.js` and add a test that checks if the new `MEMORY` binding is correctly wrapped:
  ```javascript
  it("uses the native agent_memory binding for persistence and recall", async () => {
    // Assert native getProfile calls are triggered
  });
  ```

**Step 2: Run tests to verify failure**
Run: `npm test tests/intelligence/memory-cloude.test.js`

**Step 3: Implement minimal adapter code in memory-cloude.js**
- Replace the legacy KV + Vectorize storage and query logic inside `MemoryCloude` constructor and methods:
  * `persistInteraction(sessionId, interaction)` $\rightarrow$ delegates to `env.MEMORY.getProfile(sessionId).ingest()` or `remember()`.
  * `recallContext(sessionId, query, options)` $\rightarrow$ delegates to `env.MEMORY.getProfile(sessionId).recall()`.
  * `getSessionSummary(sessionId)` $\rightarrow$ delegates to `env.MEMORY.getProfile(sessionId).getSummary()`.

**Step 4: Run tests to verify pass**
Run: `npm test tests/intelligence/memory-cloude.test.js`

**Step 5: Commit**
```bash
git add chittyconnect/src/intelligence/memory-cloude.js chittyconnect/tests/intelligence/memory-cloude.test.js
git commit -m "feat: refactor MemoryCloude to wrap native Agent Memory binding"
```

---

### Task 3: Refactor ContextConsciousness health checks

**Files:**
- Modify: `chittyconnect/src/intelligence/context-consciousness.js`

**Step 1: Write a test verifying portal status integration**
- Implement health check logic that fetches status from the MCP Portal server-list endpoint instead of pinging upstream URLs directly.

**Step 2: Verify health check implementation runs successfully**
- Execute dry run of ContextConsciousness awareness fetcher.

**Step 3: Commit**
```bash
git add chittyconnect/src/intelligence/context-consciousness.js
git commit -m "feat: update ContextConsciousness health scanning to query Portal status"
```

---

### Task 4: Setup Terraform Configuration for Cloudflare MCP Portal

**Files:**
- Create: `chittymcp/config/portal.tf`

**Step 1: Define Terraform portal resource**
- Create the file and add:
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

**Step 2: Commit**
```bash
git add chittymcp/config/portal.tf
git commit -m "infra: define Terraform resource for native MCP Portal routing"
```
