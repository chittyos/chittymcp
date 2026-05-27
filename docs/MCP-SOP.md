# MCP-SOP v1 — Canonical procedure for ChittyOS service MCPs

> **Source of truth.** This document supersedes any contradicting language in
> per-service READMEs, the legacy `src/servers/` Node MCP stack, or older
> CLAUDE.md fragments that describe `mcp-evidence-server` / `mcp-unified-consolidated`.
>
> If you are about to add or modify a service MCP, follow this SOP end-to-end.

---

## 1. Topology (binding)

```
   CF Gateway  ── registry of record (per-service registration + tags)
        │
        ├──► chittymcp   (mcp.chitty.cc)        — all services, machine surface
        ├──► chittymsg   (msg.chitty.cc)        — domain:messaging only
        └──► ch1tty      (ch1tty.chitty.cc)     — audience:human ∧ auth:oauth-ok
```

- Service MCPs are **not** exposed directly to end clients. They are reached
  through one of the three aggregators (or future focused collections).
- Per-service Cloudflare Access policies remain for ops/debugging, but client
  routing is always through an aggregator.
- Adding a service to an aggregator is **never** a hand edit on the aggregator
  side — it is a tag at registration time.

## 2. Required elements (every service MCP)

Each `chittyagent-<name>` worker MUST expose:

| Element     | Path / Mechanism                       | Required | Notes |
|-------------|----------------------------------------|----------|-------|
| Transport   | `POST /mcp` (Streamable HTTP)          | yes      | MCP spec v2025-03-26 |
| `tools/list` | via MCP                                | yes      | ≥1 tool, real backend |
| `tools/call` | via MCP                                | yes      | No mocks (see §6) |
| `prompts/list` | via MCP                              | recommended | Domain-specific prompts |
| `resources/list` | via MCP                            | recommended | Read-only artifact handles |
| `/health`   | `GET`, returns `{status,service,version}` | yes   | Real-dependency probe |
| `/mcp/manifest` | `GET`, alchemization manifest      | yes (alchemize-bound) | See `shared/alchemize.ts` |
| DO binding  | `<Name>Agent extends McpAgent`         | yes      | Inline per-worker (esbuild constraint) |
| Tail consumer | `chittytrack`                        | yes      | Wrangler `tail_consumers[]` |

## 3. Naming conventions (binding)

### Service name
- Worker: `chittyagent-<name>` — lowercase, kebab, no `chitty` prefix on `<name>`
- DO class: `<Name>Agent` (PascalCase, suffix `Agent`)
- DO binding (env): `<NAME>_AGENT` (UPPER_SNAKE)

### Tool name
**Pattern:** `<service>_<verb>` or `<service>_<noun>_<verb>`. Lowercase snake.

| Good                   | Bad                  | Reason |
|------------------------|----------------------|--------|
| `tasks_list`           | `listTasks`          | wrong case |
| `auth_resolve_token`   | `resolveAuthToken`   | wrong case |
| `evidence_ingest`      | `ingest_evidence`    | verb-last |
| `tasks_lease_claim`    | `claim`              | not namespaced |

Aggregators namespace as `<service>/<tool>` (e.g. `tasks/tasks_list`).
Keep the service prefix in the inner tool name too — clients that bypass
the aggregator (direct `<name>.chitty.cc/mcp`) still need self-descriptive names.

### Verbs
Canonical verbs (extend cautiously, document if new):
`list, get, create, update, delete, claim, release, complete, fail, cancel,
heartbeat, resolve, validate, ingest, search, render`.

### Tool grouping
If a service has >8 tools, group by capability domain in the tool name:
`storage_object_put`, `storage_object_get`, `storage_bucket_list`.

## 4. The McpAgent wrap (canonical template)

There is **no shared `McpAgent` base class** in `workers/shared/` — `agents/mcp`
cannot be imported from `workers/shared/` because esbuild walks up from the
importing file and won't resolve from a parent without its own `node_modules`.
Use the template below inline in each worker (or generate it via
`scripts/scaffold-mcp.ts`):

```ts
// ── MCP Server ──────────────────────────────────────────────────────
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const _t = (d: unknown) => ({
  content: [{ type: "text" as const, text: typeof d === "string" ? d : JSON.stringify(d, null, 2) }],
});
const _e = (m: string) => ({
  content: [{ type: "text" as const, text: m }],
  isError: true as const,
});

function register<Name>Tools(server: McpServer, env: Env) {
  server.tool(
    "<service>_<verb>",
    "<one-line description>",
    { /* zod schema */ },
    async (input) => {
      try {
        const out = await <existingFunction>(env, input);
        return _t(out);
      } catch (e) { return _e(`<service>_<verb> failed: ${(e as Error).message}`); }
    },
  );
  // …more server.tool() calls
}

export class <Name>Agent extends McpAgent<Env> {
  server = new McpServer({ name: "chittyagent-<name>", version: V });
  async init() { register<Name>Tools(this.server, this.env); }
}

const mcpHandler = <Name>Agent.serve("/mcp", { binding: "<NAME>_AGENT" });

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => {
    const u = new URL(req.url);
    if (u.pathname === "/mcp" || u.pathname.startsWith("/mcp/")) {
      return mcpHandler.fetch(req, env, ctx);
    }
    return existingApp.fetch(req, env, ctx); // preserves REST/webhook surface
  },
};
```

### Required deps (per worker `package.json`)
```json
"@modelcontextprotocol/sdk": "^1.25.2",
"agents": "^0.3.10",
"zod": "^3.23.0"
```

### Required wrangler additions
```jsonc
"durable_objects": {
  "bindings": [
    { "name": "<NAME>_AGENT", "class_name": "<Name>Agent" }
  ]
},
"migrations": [
  { "tag": "v<N>", "new_sqlite_classes": ["<Name>Agent"] }
]
```

## 5. Endpoints (binding)

Every service MCP MUST be reachable at three addresses, all serving identical
content via the same DO:

| Address                                   | Purpose                       |
|-------------------------------------------|-------------------------------|
| `https://<name>.chitty.cc/mcp`            | **Canonical** — clients use this |
| `https://<name>.agent.chitty.cc/mcp`      | Legacy — kept until migration done |
| `https://mcp.chitty.cc/<name>/mcp`        | Aggregated through chittymcp  |

Wrangler routes for the worker should bind both `<name>.chitty.cc` and
`<name>.agent.chitty.cc` as custom domains. The `/v0.1/servers` discovery
payload exposes all three under `endpoints.{canonical,deployed,aggregated}` —
clients SHOULD prefer `canonical`.

## 6. No mocks (binding — from global CLAUDE.md)

- No placeholder route bodies. Every tool calls a real implementation.
- No `vi.mock(...)` on DB/service modules in new tests.
- Every PR body MUST include a real `tools/list` curl output from the
  deployed endpoint as evidence the wrap landed.

## 7. Step-by-step (the procedure)

| # | Action | Gate |
|---|--------|------|
| 1 | Run `scripts/scaffold-mcp.ts --service <name>` (or apply template by hand) | Code compiles |
| 2 | `npm install` in the worker's directory | `agents`, `@modelcontextprotocol/sdk`, `zod` resolved |
| 3 | `npx wrangler deploy --env production` | Deploy succeeds; DO migration applied |
| 4 | `curl -sX POST https://<name>.chitty.cc/mcp …` (initialize + tools/list) | ≥1 tool returned |
| 5 | If new service: register with CF gateway with `surface:all` + correct domain/audience/auth/tier tags | Registry returns entry |
| 6 | Add `SVC_<NAME>` binding to `chittymcp/wrangler.jsonc` + entry in `SERVICE_MAP` (`src/worker/index.ts`) | Aggregated `mcp.chitty.cc/<name>/mcp` returns same tools |
| 7 | Open PR with the three `tools/list` outputs in body | Reviewer can verify without re-running |

## 8. Anti-patterns (don't)

- ❌ Editing `~/.claude/.mcp.json` to add a new MCP — capabilities are centralized
- ❌ Implementing tool logic inside `chittymcp` — it is a router only
- ❌ Returning placeholder envelopes — see §6
- ❌ Adding aggregator-level allowlists — tag the service, let policy filter
- ❌ Importing `agents/mcp` from `workers/shared/` — esbuild will fail
- ❌ Defining tool names without the `<service>_` prefix
- ❌ Committing without proving `tools/list` works against the deployed URL

## 9. Future: autobuild / autoheal

Once Bucket A + B are at 100% MCP coverage and Bucket C is deployed, the
loop becomes:

- `chittyagent-autoassist` watches `mcp.chitty.cc/v0.1/servers` + `chittytrack`
  for services that fail SOP gates (missing prompts, drift from naming,
  health regressions).
- `chittyagent-alchemist` aggregates per-tool cost/error envelopes and feeds
  SLOs back into the autoassist loop.
- Fractal builder: `scripts/scaffold-mcp.ts` is the leaf operation; autoassist
  invokes it through ch1tty / orchestrator when a Bucket C service goes live.

That stage is gated by this SOP being stable and Bucket A/B fully migrated.
