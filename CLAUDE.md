# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## What this is

**ChittyMCP** is the universal MCP aggregator for the ChittyOS ecosystem.
It is a single Cloudflare Worker (`src/worker/index.ts`) deployed at
`mcp.chitty.cc` that federates every service, agent, actor, anima, and SDK
MCP under one endpoint via Cloudflare service bindings (no HTTP round-trips).

This is **NOT** a tool-implementation repo. ChittyMCP is a router; tool logic
lives in a sibling worker in the ChittyEntity monorepo under one of four
canonical directories, keyed by role. Nothing in the URL or the directory
carries a `Chitty` prefix — the category word already supplies that:

### Source layout (chittyentity monorepo)

```
github.com/CHITTYOS/chittyentity/
├─ chittyagents/<name>/   # service MCPs
├─ chittyactors/<name>/   # autonomous actors that take external actions
├─ chittyanimas/<name>/   # persona / companion entities
└─ chittysdks/<name>/     # shared libraries consumed by the above
```

### Public URL schema

| Role        | URL                              | Example                           |
|-------------|----------------------------------|-----------------------------------|
| Service     | `<name>.chitty.cc`               | `notion.chitty.cc`                |
| Agent       | `agent.chitty.cc/<name>/`        | `agent.chitty.cc/notion/`         |
| Actor       | `actor.chitty.cc/<name>/`        | `actor.chitty.cc/dispute/`        |
| Anima       | `anima.chitty.cc/<name>/`        | `anima.chitty.cc/casey/`          |
| SDK         | `sdk.chitty.cc/<name>/`          | `sdk.chitty.cc/evidence/`         |
| Aggregator  | `mcp.chitty.cc/<name>/mcp`       | `mcp.chitty.cc/notion/mcp`        |

No `chitty` / `chittyagent-` prefix anywhere in `<name>` — the subdomain
(service) or path parent (agent / actor / anima / sdk) carries the role.
`chittyentity/workers/chittyagent-*` is the old source path and no longer
canonical. (The `wrangler.jsonc` comment claiming `<name>.agent.chitty.cc/mcp`
is also stale — the live pattern is the table above.)

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

Tool implementations live in `chittyentity/chittyagents/<name>/` (or the
sibling `chittyactors/`, `chittyanimas/`, `chittysdks/` directories). `<name>`
is the bare role name — no `Chitty` or `chittyagent-` prefix. If you find
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

# Direct call (bypass aggregator) — pick the URL from the schema above:
#   Service: https://<name>.chitty.cc/mcp
#   Agent:   https://agent.chitty.cc/<name>/mcp
#   Actor:   https://actor.chitty.cc/<name>/mcp
#   Anima:   https://anima.chitty.cc/<name>/mcp
#   SDK:     https://sdk.chitty.cc/<name>/mcp
curl -sX POST https://<name>.chitty.cc/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",...}'
```

## Adding or wrapping a service

See `docs/MCP-SOP.md`. The short version:

1. Pick the role directory in `chittyentity/`: `chittyagents/`, `chittyactors/`,
   `chittyanimas/`, or `chittysdks/`. Create `<name>/src/index.ts` under it
   (`<name>` is the bare role name, no prefix) and add the canonical McpAgent
   block (or run `scripts/scaffold-mcp.ts --<role> <name>`).
2. Deploy that worker. Verify its direct URL from the schema above returns ≥1
   tool (e.g. `https://notion.chitty.cc/mcp` for a service,
   `https://agent.chitty.cc/dispute/mcp` for an agent).
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
