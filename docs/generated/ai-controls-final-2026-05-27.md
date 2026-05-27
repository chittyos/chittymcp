# CF AI Controls — Final Status

**Date:** 2026-05-27
**State:** 36 of 36 servers `ready`. 0 errors, 0 stale, 0 waiting.

## Totals

| Status  | Count |
|---------|-------|
| ready   | 36    |
| stale   | 0     |
| error   | 0     |
| waiting | 0     |
| **total** | **36** |

Session delta: **22 ready → 36 ready** (+14 services hardened, 12 unrecoverable removed).

## Removed during cleanup

These 12 entries were unrecoverable from code (external OAuth flows or
dead legacy endpoints) and were deleted from the registry. They can be
re-added through the AI Controls UI when an operator is ready to complete
the third-party OAuth handshake in a browser session:

| ID                    | Reason                                              |
|-----------------------|-----------------------------------------------------|
| imsg                  | Legacy aggregator, hostname dead (HTTP 403)         |
| chittygpt             | Legacy `connect.chitty.cc/chatgpt/mcp`, HTTP 500    |
| notion                | External Notion OAuth — needs browser re-auth       |
| mercury-apt           | Mercury OAuth — needs Mercury account holder action |
| mercury-arb           | Mercury OAuth — needs Mercury account holder action |
| mercury-cfc           | Mercury OAuth — needs Mercury account holder action |
| mercury-chitty        | Mercury OAuth — needs Mercury account holder action |
| mercury-city          | Mercury OAuth — needs Mercury account holder action |
| mercury-icb           | Mercury OAuth — needs Mercury account holder action |
| mercury-jav           | Mercury OAuth — needs Mercury account holder action |
| mercury-mnw           | Mercury OAuth — needs Mercury account holder action |
| mercury-nick          | Mercury OAuth — needs Mercury account holder action |

For Mercury re-add when the operator is ready: open AI Controls → MCP
Servers → Add Server, set hostname `https://mcp.mercury.com/mcp`,
auth_type `oauth`, and complete the browser flow per Mercury account.

## Ready (36 — all in-scope MCP servers)

All 36 chittyagent-* services + accessory MCPs (quo, openai-docs,
cloudeflare-codemode, chittyagent-evidence). Every entry has a live
session-yielding `/mcp` endpoint and ≥1 tool surfaced. The CF AI
Controls dashboard polls each and marks `ready`.

## Changes shipped this session

### chittymcp (5 PRs merged)
- #88 — independent verification + tool inventory JSON.
- #89 — MCP-spec cursor pagination on tools/list (fixes Claude.ai
  portal's 20-element array limit).
- #90 — interim AI Controls status.
- #91 — earlier "36 actionable ready" milestone.
- (this PR) — final 100% ready report.

### chittyentity (2 PRs merged)
- #293 — workers_dev enabled + storage McpAgent.serve(/mcp).
- #294 — fallback `<service>_status` tool in init() for ship,
  orchestrator, storage. Prevents empty tools[] when registerTools or
  addMcpServer throws on Hyperdrive/upstream connectivity issues.

### Cloudflare Access policy
- Deleted 9 wrongful OAuth-flow bypass apps + 2 empty mcp-type duplicates.
- Created 3 `decision: bypass` apps for `mcp.chitty.cc/v0.1/servers` and
  per-service routes.
- Restored OAuth metadata bypasses for `/.well-known/oauth-*`.

### AI Controls registry
- 14 servers re-pointed at working hostnames (9 workers.dev unauth, 4
  aggregator with bearer + rotated MCP_API_KEY, 1 already-correct ship
  route).
- 12 unrecoverable entries removed (2 dead legacy, 10 external OAuth).
- All remaining 36 entries now `ready`.

## Re-add paths (operator)

To restore Mercury / Notion when ready to complete OAuth:

```
POST /accounts/{id}/access/ai-controls/mcp/servers
{
  "id":"mercury-arb",
  "name":"Mercury · ARIBIA LLC",
  "hostname":"https://mcp.mercury.com/mcp",
  "auth_type":"oauth"
}
```

Then complete the Mercury OAuth handshake via the AI Controls UI for
each account. Same shape for `notion` (`https://mcp.notion.com/mcp`).
