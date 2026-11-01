# Gemini CLI Instructions — ChittyMCP

This document provides foundational mandates, workspace topology, and operational guidelines for Gemini CLI when working inside the `chittymcp` repository.

> **CRITICAL ARCHITECTURAL BOUNDARY:** This repository is the **universal aggregator/router** for the ChittyOS MCP ecosystem, deployed as a single Cloudflare Worker (`src/worker/index.ts`) at `mcp.chitty.cc`. It is **NOT** a tool-implementation repository. Tool logic lives in individual `chittyagent-<name>` workers (located in separate repositories like `github.com/CHITTYOS/chittyentity`). Do not implement new tool logic here.

---

## 📖 Essential Documents & Source of Truth

Always read and align with these canonical documents before making changes:

| File | Role & Authority |
| :--- | :--- |
| `CLAUDE.md` | Dev-specific workflows, command reference, and strict "no mock data" policy. |
| `CHARTER.md` | Platform service classification, scope limits, peer dependencies, and compliance criteria. |
| `docs/MCP-SOP.md` | **Canonical Standard Operating Procedure** for naming conventions, transport profiles, argument schemas, prompts/resources rules, and onboarding upstreams. |
| `docs/ONBOARDING.md` | Step-by-step procedure to deploy and register a new upstream service. |
| `docs/agent-registry-triage.json` | Live triage tracking of which services are actively deployed (Bucket A) or excluded (Bucket C). |
| `wrangler.jsonc` | Live service bindings configuration list (the active system boundaries). |
| `src/worker/index.ts` | The core data-driven aggregator itself (routes, JWT assertions, dynamic service mapping). |

---

## 🚫 Legacy Warning: Historical Code (DO NOT TOUCH)

The codebase contains historical Node-based MCP server code from before the Cloudflare Worker aggregator refactor. These files **are NOT the live system**. 

**DO NOT add new code, edit, or refactor these folders/files unless specifically instructed to migrate them:**
* `src/servers/` (e.g., `unified-server.js`, `evidence-server.js`)
* `src/core/`, `src/integration/`, `src/tools/`
* `mcp-evidence-server/`, `mcp-unified-consolidated/`, `services/mcp-exec/`
* `mcp-chittyconnect/`, `mcp-http-chronicle/`, `mcp-gateway-chatgpt/`
* `casey-offer.js`, `mcp-handler.js`, `mcp-project-sync.js`
* `config/chains.json`, `config/claude-desktop-config.json`, `mcp-sync-config.json`
* `chittyos-cloudflare-mcp/`, `chittyos-executive-mcp/`, `chittyos-mcp-extension/`

---

## 🛠️ Common Operations & Developer Workflow

### Building, Running & Validating

* **Deploy Aggregator to Production:**
  ```bash
  npm run deploy:prod
  ```
  *(Alias for `wrangler deploy --config wrangler.jsonc --env production`)*
* **Run Tests:**
  ```bash
  npm test
  ```
  *(Runs `node --test test/governance-gates.test.js`)*
* **Linting & Formatting:**
  ```bash
  # Check for code style and patterns
  npm run lint
  
  # Format files with Prettier
  npm run format
  ```

### Smoke Testing & Health Verification

* **Check Aggregator Health:**
  ```bash
  curl -s https://mcp.chitty.cc/health | jq .
  ```
* **List Federated Services:**
  ```bash
  curl -s https://mcp.chitty.cc/v0.1/servers | jq '.servers[].id'
  ```
* **Call Aggregator tools/list (requires Bearer MCP_API_KEY):**
  ```bash
  curl -sX POST https://mcp.chitty.cc/mcp \
    -H "authorization: Bearer $MCP_KEY" \
    -H "content-type: application/json" \
    -H "accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
  ```

---

## 🏗️ Core Architecture & Routing Details

The aggregator worker (`src/worker/index.ts`) resolves requests through several layers:

### 1. Endpoint Conventions
* **Federated surface (`/mcp`):** Aggregates tool lists, prompts, and resources from all active service bindings. Namespaces and routes them based on global unique tool names (saved in memory per-isolate inside `TOOL_ROUTE_INDEX`).
* **Direct proxy (`/{service}/mcp`):** Proxies calls directly to the bound service (e.g., `/dispute/mcp` routes to the `SVC_DISPUTE` binding) using zero-round-trip service bindings.
* **Aggregated Sub-views (`/{view}/mcp`):** 
  * Re-maps the active `SERVICE_MAP` based on service category tags.
  * `/cpa/mcp` filters to `category === "finance"` services.
  * `/msg/mcp` filters to `category === "communication"` services.

### 2. Security & Auth Flow
* **CF Access Assertion:** Leverages edge-injected `Cf-Access-Jwt-Assertion` headers as trusted authorization.
* **JWT Bearer Token verification:** Decodes and verifies signatures/issuers against Cloudflare Access Remote JWKS (`https://chittycorp.cloudflareaccess.com`).
* **Service Token Allowlist:** Checks `CF-Access-Client-Id` headers against an operator-managed allowlist (`MCP_ALLOWED_ACCESS_CLIENT_IDS`) to prevent internal routing loops.
* **Shared Secret:** Allows legacy `Bearer $MCP_API_KEY` authorization.
* **OAuth RFC 9728 Compliance:** Serves protected resource metadata at `/.well-known/oauth-protected-resource/mcp` and token endpoint proxying to Cloudflare Access at `/token` and `/register`.

### 3. Route & Binding Auto-Reconciliation
* **Auto-binding Beacon (`POST /admin/bind`):** Upstream workers hit this endpoint post-deploy with their service name. If authorized via `BIND_BEACON_TOKEN`, the aggregator uses a GitHub PAT (`BIND_GH_TOKEN`) to open a pull request against `CHITTYOS/chittymcp` dynamically modifying `wrangler.jsonc` (to add the `services[]` binding) and `src/worker/index.ts` (to append the service map entry).
* **Cloudflare Route Sync (`POST /admin/reconcile/routes`):** Queries Cloudflare API and reconciles actual zone route mappings `mcp.chitty.cc/${sub}/mcp*` with the bindings listed in the current active `SERVICE_MAP`.

---

## 📜 Coding Conventions & Naming Rules (From `docs/MCP-SOP.md`)

When auditing, validating, or modifying helper scripts/scaffold configurations:

1. **Tool Names must be BARE:** Use patterns like `<verb>` or `<noun>_<verb>` (e.g., `list`, `search`, `resolve_token`, `ingest`). **NEVER** prefix with the service name (e.g., avoid `tasks_list` or `notes_search`). The aggregator handles namespacing automatically.
2. **Prompt Names must be BARE:** Mirror the tool naming rule (`triage_inbound`, not `quo_triage_inbound`).
3. **Resource URIs:** Follow `<service>://<domain>/<noun>` kebab segments (e.g., `quo://phone-numbers`, `quo://config/routing`). No redundant `chitty://` or `chittycanon://` schemes.
4. **No Mock Data Policy:** We never return mock data or placeholders on live endpoints. Under-implementation triggers a non-compliance status.
