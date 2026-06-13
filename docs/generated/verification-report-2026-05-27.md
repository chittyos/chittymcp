# ChittyMCP — Independent Verification Report

**Date:** 2026-05-27
**Verifier:** session-scoped independent check against prior session's claims
**Method:** live HTTP probes + repo state inspection (no inferred state)

## Verdict

**Conditional PASS.** Aggregator and discovery surface are live and consistent
with documented architecture. Two upstream service workers have routing bugs.
Prompts/resources coverage is sparse. MCP_API_KEY rotated.

---

## 1. PR merge states (task 1)

| Repo         | PR    | Title                                                    | State  |
|--------------|-------|----------------------------------------------------------|--------|
| chittymcp    | #76   | docs: refresh CHARTER for aggregator topology           | OPEN   |
| chittymcp    | #77   | chore(sop): MCP-SOP v1 + scaffolder + refresh stale docs | MERGED |
| chittymcp    | #83   | fix(mcp): public OAuth discovery + CF Access JWT auth   | MERGED |
| chittymcp    | #84   | fix(mcp): align worker with CF Access mcp-type OAuth    | MERGED |
| chittymcp    | #85   | chore(aggregator): bind cloudflare + finance            | MERGED |
| chittymcp    | #86   | chore(triage): architecture realized                    | MERGED |
| chittymcp    | #87   | fix(mcp): restore OAuth metadata handlers + CF_ACCESS_AUD | MERGED |
| chittyentity | #271-#290 (excl. 277) + #292 | all McpAgent wrap PRs                 | MERGED |

**#76 OPEN** — original charter refresh PR; effectively superseded by #77+
since CHARTER content was rewritten in subsequent docs (MCP-SOP, triage).
Should be closed or rebased; flag for cleanup.

## 2. Worker OAuth implementation (task 2)

`src/worker/index.ts` current state:

- **`SERVICE_MAP`** (line 85): 38 entries, matches wrangler bindings.
- **`requireBearerTokenAsync`** (line 379): three accepted auth paths:
  1. `Cf-Access-Jwt-Assertion` header (upstream-validated by CF Access)
  2. Static `Bearer MCP_API_KEY` (service-to-service)
  3. CF Access JWT validated against JWKS via `jose` (end-user OAuth)
- **`WWW-Authenticate`** (line 404, 441): RFC 6750/9728 compliant with
  `resource_metadata` URL.
- **`/v0.1/servers` + `/.well-known/chitty.json`**: public discovery,
  same 38 services.
- **`/.well-known/oauth-protected-resource`**: worker-served, points
  `authorization_servers` at `https://chittycorp.cloudflareaccess.com`.
- **`/.well-known/oauth-authorization-server`**: worker proxies to the
  team-level AS metadata at `chittycorp.cloudflareaccess.com/.well-known/...`.

**No conflict with CF Access mcp-type.** The worker only owns the two
metadata paths; CF Access mcp-type owns `/register`, `/authorize`,
`/token`, `/sse`. Bypass apps for the metadata paths route to the worker;
no bypass for OAuth flow paths so mcp-type handles them natively.

## 3. Live endpoints (task 3)

| Endpoint                                         | HTTP | Notes                              |
|--------------------------------------------------|------|------------------------------------|
| `GET /health`                                    | 200  | 38 services in payload             |
| `GET /v0.1/servers`                              | 200  | 38 servers, full metadata          |
| `GET /.well-known/chitty.json`                   | 200  | identical to /v0.1/servers         |
| `GET /.well-known/oauth-protected-resource`      | 200  | AS=chittycorp.cloudflareaccess.com |
| `GET /.well-known/oauth-authorization-server`    | 200  | proxies team-level AS metadata     |
| `POST /mcp` (no auth)                            | 401  | RFC 6750/9728-compliant            |

`WWW-Authenticate` header on the 401:
```
Bearer realm="chittymcp", error="invalid_token",
error_description="Missing or invalid access token",
resource_metadata="https://mcp.chitty.cc/.well-known/oauth-protected-resource"
```

## 4. Tool inventory (task 4)

Generated `docs/generated/mcp-tool-inventory.json` from live probes.

**Aggregator:** `mcp.chitty.cc/mcp` → 153 tools, 0 prompts, 0 resources.

**Per-service (38 total):**
- **36 LIVE** with sessionable `tools/list` responses.
- **2 FAILED**:
  - `ch1tty`: HTTP 401 (upstream worker enforces its own bearer that the
    aggregator's MCP_API_KEY isn't authoritative for — see
    chittyentity/workers/chittyagent-ch1tty auth path).
  - `storage`: HTTP 404 "Not Found" — storage worker has no `/mcp` route
    mounted (McpAgent likely not wired into the worker's default fetch
    handler).
- **Sum of per-service tool counts = 153** (matches aggregator exactly).

**2 LIVE-but-EMPTY:** `orchestrator`, `ship` return session but
`tools/list` is empty (`tools: []`). Wrap exists but no tools registered.

## 5. Count reconciliation (task 5)

Prior session log claimed "49 workers" — that number is wrong.
**Verified actual counts:**

| Count | Source | Notes |
|-------|--------|-------|
| 39    | `ls chittyentity/workers/chittyagent-*` | Total worker dirs |
| 38    | grep `McpAgent` in workers/*/src/*.ts | All except `ui` (React app, not an MCP candidate) |
| 38    | SVC_* bindings in chittymcp/wrangler.jsonc | Matches McpAgent count |
| 38    | SERVICE_MAP entries in src/worker/index.ts | Matches bindings |
| 38    | `/v0.1/servers` discovery payload | Matches code |
| 36    | services with sessionable `/{name}/mcp` (live) | ch1tty 401, storage 404 |
| 34    | services with ≥1 tool exposed | + 2 with 0 tools (orchestrator, ship) |
| 153   | total tools across all services | Matches aggregator's aggregated count |

**Exclusions explained:**
- `ui` (1 dir): React frontend, not an MCP server. Permanent exclusion.
- `ch1tty`, `storage` (2 services): present in SERVICE_MAP, McpAgent wraps
  exist, deployed — but upstream routing/auth bugs prevent the aggregator
  from getting a session. Fix belongs in chittyentity.
- `orchestrator`, `ship` (2 services): wraps register no tools at init.
  Fix belongs in chittyentity.

The "49" figure from the eval doc appears to count something other than
`workers/chittyagent-*` dirs — perhaps the chittyentity monorepo's full
worker count including non-chittyagent prefixes. Not consequential here.

## 6. Prompts/resources audit (task 6)

**Massive gap.** Of 38 wrapped services:

- **1 service** (`quo`) exposes prompts: 7 prompts.
- **1 service** (`quo`) exposes resources: 3 resources.
- **37 services** expose 0 prompts and 0 resources.
- **Aggregator** doesn't aggregate prompts or resources from upstreams
  (only tools).

This contradicts the original user goal which specified
"required elements (tools, prompts, resources)." Tools coverage is good;
prompts/resources is essentially non-existent.

## 7. Security: MCP_API_KEY rotation (task 7)

**Rotated.** Old key was in `/tmp/mcp_key`; new key generated via
`openssl rand -base64 32`, pushed to chittymcp worker via
`wrangler secret put MCP_API_KEY`, validated by hitting `tools/list`
(returned 153 tools = the new key works), then `/tmp/mcp_key` overwritten
with the new value and chmodded `600`.

Old key is no longer accepted by the worker. Any service-to-service
caller that hard-coded the old key needs to be updated.

## 8. Final status (task 8)

```json
{
  "verified_live": [
    "mcp.chitty.cc aggregator + bindings (38 services, 153 tools)",
    "/health, /v0.1/servers, /.well-known/chitty.json (200, 38 servers)",
    "/.well-known/oauth-protected-resource (200, points at CF Access team domain)",
    "/.well-known/oauth-authorization-server (200, proxies team-level AS metadata)",
    "RFC 6750/9728-compliant 401 with resource_metadata pointer",
    "DCR at chittycorp.cloudflareaccess.com/cdn-cgi/access/oauth/registration (verified live, returns client_id)",
    "MCP_API_KEY rotated and verified"
  ],
  "failed": [
    "ch1tty/mcp → HTTP 401 (upstream worker auth)",
    "storage/mcp → HTTP 404 (no /mcp route mounted)",
    "orchestrator/mcp → session but tools/list empty",
    "ship/mcp → session but tools/list empty"
  ],
  "skipped_with_reason": [
    "ui — React app, not an MCP candidate",
    "Claude.ai connector re-add — out of session scope; user must remove + re-add"
  ],
  "security_findings": [
    "MCP_API_KEY rotated this session (previous value lived in /tmp/mcp_key plaintext on VM)",
    "/tmp/mcp_key now chmod 600",
    "37 of 38 services have no prompts or resources (capability surface incomplete)",
    "PR #76 left OPEN — superseded by #77+ but still present in PR list",
    "Worker JWT verification (jose) does not enforce CF_ACCESS_AUD if not set — verified secret is configured"
  ],
  "next_actions": [
    "Fix chittyentity ch1tty worker — accept aggregator MCP_API_KEY OR route ch1tty/mcp differently",
    "Fix chittyentity storage worker — mount McpAgent at /mcp",
    "Fix chittyentity orchestrator + ship — register actual tools at McpAgent init",
    "Aggregate prompts and resources in the chittymcp worker (not just tools)",
    "Implement domain-specific prompts and resources in at least the 6 heaviest services",
    "Close or rebase chittymcp PR #76",
    "Audit tool naming for collisions: 153 tools, all currently namespaced as <service>/<tool> at the aggregator — verify no service exposes a tool with a name that conflicts with another service's namespace",
    "Schema correctness audit: validate every tool's inputSchema with a JSON Schema validator",
    "Smoke-test every tool with a no-op invocation to catch destructive defaults",
    "Verify Claude.ai connector re-add succeeds after metadata changes"
  ]
}
```
