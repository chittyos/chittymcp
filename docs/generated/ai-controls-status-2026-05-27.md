# CF AI Controls — MCP Server Status

**Date:** 2026-05-27
**Method:** `/accounts/{id}/access/ai-controls/mcp/servers` via CloudflareMCP

## Totals

| Status   | Count |
|----------|-------|
| ready    | 33    |
| stale    | 10    |
| error    | 4     |
| waiting  | 1     |
| **total**| **48**|

Session delta: **22 → 33 ready** (+11 services hardened).

## Ready (33 services)

All 22 chittyagent-* workers (alchemist… viewport range, full list in
`mcp-tool-inventory.json`) plus quo, openai-docs, cloudeflare-codemode,
ChittyAgent Notion, ChittyAgent Auth, ChittyAgent Gam, ChittyAgent
Chatgpt, ChittyAgent Dispute, ChittyAgent Notes, ChittyAgent Twilio,
ChittyAgent Human Escalator, ChittyAgent Bridge Consent, ChittyAgent
Bluebubbles, ChittyAgent Scrape, ChittyEvidence.

## Stale (10 services — out of scope)

All Mercury accounts: `mercury-{apt,arb,cfc,chitty,city,icb,jav,mnw,nick,mr-nice-weird}`.
Error uniform: `Invalid oauth credentials. Please contact your administrator`.
Resolution requires Mercury account admin to refresh OAuth tokens; cannot
fix from chittymcp / chittyentity code.

## Error / Waiting (5 non-Mercury services)

| ID                        | Status  | Hostname                                              | Issue                                       |
|---------------------------|---------|-------------------------------------------------------|---------------------------------------------|
| notion                    | stale   | https://mcp.notion.com/mcp                            | External Notion server auth failure         |
| imsg                      | error   | https://imsg.chitty.cc/mcp                            | 530 — legacy aggregator endpoint, no DNS    |
| chittygpt                 | error   | https://connect.chitty.cc/chatgpt/mcp                 | 500 — legacy ChittyConnect MCP shim         |
| chittyagent-storage       | error   | https://chittyagent-storage.ccorp.workers.dev/mcp     | Polls timeout — McpAgent init returns 0 tools (proxy fails) |
| chittyagent-ship          | error   | https://chittyagent-ship.ccorp.workers.dev/mcp        | Polls timeout — registerTools throws (likely Hyperdrive connect) |
| chittyagent-orchestrator  | waiting | https://chittyagent-orchestrator.ccorp.workers.dev/mcp| Polls slow — 0 tools at init                |

All three chittyagent-* workers respond `200` to direct curl on /mcp
initialize (~1s) AND tools/list (~250ms), but return empty tools[].
Root cause: `registerTools(this.server, this.env, this.sql)` throws
silently if `this.sql` (Hyperdrive → Neon) is unreachable from the
workers.dev URL context. Fix belongs in chittyentity per-service —
either provide a fallback tool list when sql is unavailable, or
diagnose Hyperdrive connectivity from the workers.dev fetch path.

## Changes shipped this session

### chittymcp
- PR #89: MCP-spec cursor pagination on `tools/list` (page size 20),
  fixing Claude.ai portal "Array must contain at most 20 element(s)".

### chittyentity
- PR #293: Enabled `workers_dev: true` on auth, gam, orchestrator,
  storage, chatgpt. Added `StorageProxyAgent.serve("/mcp")` to storage
  worker (was using `routeAgentRequest` which doesn't route /mcp).

### Cloudflare Access (via CloudflareMCP)
- Deleted 9 wrongful OAuth-flow bypass apps + 2 empty duplicate mcp-type
  apps (PR #84-era leftovers).
- Created 3 correct `decision: bypass` apps for `mcp.chitty.cc/v0.1/servers`,
  `mcp.chitty.cc/*/mcp`, `mcp.chitty.cc/*/mcp/*`.
- Restored OAuth metadata bypass apps for `/.well-known/oauth-*` paths.

### AI Controls re-registrations (DELETE + POST, hostname is immutable on PUT)
14 servers re-pointed at working hostnames. Auth-type set to `bearer`
with rotated MCP_API_KEY where the aggregator URL is used, else
`unauthenticated` with the per-worker workers.dev URL.

## Next actions

1. **chittyentity-ship + orchestrator**: catch `registerTools` exceptions
   in `async init()` so the McpAgent doesn't silently fall back to empty
   tools. Add a Hyperdrive health check + degraded-mode tool list.
2. **chittyentity-storage**: rework as a real MCP server with own tools
   (or make the upstream proxy resilient when storage.chitty.cc/mcp
   is unreachable).
3. **Mercury OAuth refresh**: out of code scope, needs Mercury admin.
4. **Legacy endpoints** (imsg, chittygpt): retire or repoint at canonical
   replacements (quo aggregates messaging; chittymcp aggregates ChatGPT).
5. **Notion**: external auth — re-issue Notion OAuth credentials in the
   AI Controls connector.
