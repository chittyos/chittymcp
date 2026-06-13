# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## What this is

**ChittyMCP** is the universal MCP aggregator for the ChittyOS ecosystem.
It is a single Cloudflare Worker (`src/worker/index.ts`) deployed at
`mcp.chitty.cc` that federates every `chittyagent-*` service MCP under one
endpoint via Cloudflare service bindings (no HTTP round-trips).

This is **NOT** a tool-implementation repo. ChittyMCP is a router; tool logic
lives in each `chittyagent-<name>` worker (separate repo:
`github.com/CHITTYOS/chittyentity/workers/chittyagent-<name>`).

## Canonical artifacts (read these first)

| Artifact                      | Purpose                                     |
|-------------------------------|---------------------------------------------|
| `CHARTER.md`                  | Aggregator topology + scope                 |
| `docs/MCP-SOP.md`             | **Canonical SOP for adding/wrapping any service MCP** |
| `docs/ONBOARDING.md`          | Step-by-step add-to-aggregator procedure    |
| `docs/agent-registry-triage.json` | Live triage of which services are deployed |
| `wrangler.jsonc`              | Live service-binding list                   |
| `src/worker/index.ts`         | The aggregator itself (353 LOC, data-driven)|

## Legacy directories (DO NOT TOUCH unless migrating)

The following are historical Node-based MCP implementations from before the
CF Worker aggregator was introduced. They are NOT the live system:

- `src/servers/` — old `unified-server.js`, `evidence-server.js`
- `src/core/`, `src/integration/`, `src/tools/` — old modular Node MCP stack
- `mcp-evidence-server/`, `mcp-unified-consolidated/`, `services/mcp-exec/`
- `mcp-chittyconnect/`, `mcp-http-chronicle/`, `mcp-gateway-chatgpt/`
- `casey-offer.js`, `mcp-handler.js`, `mcp-project-sync.js`
- `config/chains.json`, `config/claude-desktop-config.json`, `mcp-sync-config.json`
- `chittyos-cloudflare-mcp/`, `chittyos-executive-mcp/`, `chittyos-mcp-extension/`

Tool implementations live in `chittyentity/workers/chittyagent-*`. If you find
yourself reaching for `src/tools/`, you are in the wrong place.

## Common operations

```bash
# Deploy aggregator
npx wrangler deploy

# Verify aggregator is healthy
curl -s https://mcp.chitty.cc/health | jq .

# List federated services
curl -s https://mcp.chitty.cc/v0.1/servers | jq '.servers[].id'

# Call a tool through the aggregator (requires Bearer MCP_API_KEY)
curl -sX POST https://mcp.chitty.cc/mcp \
  -H "authorization: Bearer $MCP_KEY" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Direct service call (bypass aggregator)
curl -sX POST https://<name>.chitty.cc/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",...}'
```

## Adding or wrapping a service

See `docs/MCP-SOP.md`. The short version:

1. In `chittyentity/workers/chittyagent-<name>/src/index.ts`, add the canonical
   McpAgent block (or run `scripts/scaffold-mcp.ts --service <name>`).
2. Deploy that worker. Verify `https://<name>.chitty.cc/mcp` returns ≥1 tool.
3. Add `SVC_<NAME>` to `wrangler.jsonc` `services[]` and to `SERVICE_MAP`
   in `src/worker/index.ts`.
4. Deploy `chittymcp`. Verify `mcp.chitty.cc/<name>/mcp` returns the same tools.

Do not edit `~/.claude/.mcp.json` or any local Claude config — all capabilities
are centralized through the aggregator.

## Topology + naming

- One worker → many tools. Tool names follow `<service>_<verb>` (snake_case).
- One aggregator → many workers. Aggregator namespaces tools as `<service>/<tool>`.
- Three aggregators with different membership policies:
  - `chittymcp` — `surface:all` (default)
  - `chittymsg` — `domain:messaging`
  - `ch1tty` — `audience:human AND auth:oauth-ok`
- Per-aggregator policy is enforced **by reading tags from the CF gateway
  registration**, not by hand-editing this repo.

## Security model

- Aggregator gates with `Bearer $MCP_API_KEY` (CF secrets store).
- Upstream service workers are reached via service bindings (no public auth
  required from chittymcp; they trust the binding).
- Direct calls to `<name>.chitty.cc/mcp` use Cloudflare Access + per-worker
  bearer (varies by service — see each worker's `auth.ts`).
- Secrets flow through 1Password → CF secrets store. Never hardcode.

## Don't ship

- No mock data. No `vi.mock()` on DB modules. No placeholder route bodies.
  Every endpoint executes real queries against real datastores. See
  global CLAUDE.md "No Mocks" section.
- No new code in `src/servers/`, `src/core/`, `src/tools/`, `src/integration/`
  unless explicitly migrating away from them.
