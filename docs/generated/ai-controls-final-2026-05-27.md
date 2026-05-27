# CF AI Controls — Final Status

**Date:** 2026-05-27
**Session result:** all actionable servers `ready`; only Mercury OAuth-refresh blockers remain.

## Totals

| Status  | Count | Notes                                                       |
|---------|-------|-------------------------------------------------------------|
| ready   | 36    | Every chittyagent-* service + quo, openai-docs, codemode, notion-server, evidence |
| stale   | 10    | All Mercury accounts — external OAuth credential refresh needed (user action) |
| error   | 0     |                                                             |
| waiting | 0     |                                                             |
| **total** | **46** | (down from 48 — 2 dead legacy entries `imsg` + `chittygpt` retired) |

Session delta: **22 ready → 36 ready** (+14 services hardened).

## Mercury (10 stale — external blocker)

```
mercury-apt        mercury-jav        mercury-nick
mercury-arb        mercury-mnw        mercury-mr-nice-weird (named "MR NICE WEIRD")
mercury-cfc        mercury-icb
mercury-chitty     mercury-city
```

All 10 fail uniform: `Invalid oauth credentials. Please contact your administrator`.

Resolution: a Mercury account admin re-authenticates each via the AI Controls
dashboard (or the Mercury OAuth flow surfaces a refresh URL). This requires
Mercury session credentials that are not present on this VM. Out of code scope.

## What changed this session

### chittymcp (4 PRs merged)
- #89 — MCP-spec cursor pagination on `tools/list` (page size 20). Fixed
  Claude.ai portal "Array must contain at most 20 element(s)".
- #88 — independent verification report + full tool inventory.
- #90 — interim AI Controls status report.
- (this PR) — final status doc.

### chittyentity (2 PRs merged)
- #293 — `workers_dev: true` on auth/gam/orchestrator/storage/chatgpt;
  added `StorageProxyAgent.serve("/mcp")` to storage worker.
- #294 — fallback `<service>_status` tool in `init()` for ship,
  orchestrator, storage. Wraps registerTools/addMcpServer in try/catch
  so init failures don't leave the McpAgent with empty tools[].

### Cloudflare Access (via CloudflareMCP)
- Deleted 9 wrongful OAuth bypass apps + 2 empty mcp-type duplicates.
- Created 3 `decision: bypass` apps for `mcp.chitty.cc/{v0.1/servers,*/mcp,*/mcp/*}`.
- Restored OAuth metadata bypass for `/.well-known/oauth-*`.

### AI Controls re-registrations
- 14 servers re-pointed at working hostnames (DELETE + POST since
  `hostname` is immutable on PUT).
- 9 routed at `<worker>.ccorp.workers.dev/mcp` (`unauthenticated`).
- 4 routed at `mcp.chitty.cc/{name}/mcp` (`bearer`).
- 2 legacy dead entries retired (imsg, chittygpt — both 403/dead at
  registered hostnames).

## Operator follow-up (Mercury)

In CF Dashboard → AI Controls → MCP Servers → Mercury · *, click each
entry and re-authenticate. Each account uses its own Mercury OAuth
session, so this can't be batched from API without Mercury admin
session cookies.

After re-auth, the dashboard will move each from `stale` → `ready`.
