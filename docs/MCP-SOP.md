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

## 3.5 Prompt & Resource conventions (binding)

Ratified from live precedent in `chittyagent-quo` and `chittyagent-imessage`
(the first two workers to ship prompts + resources). `chittyagent-quo` is the
canonical reference implementation — read its `src/prompts.ts` and
`src/resources.ts`.

### Prompt name
**Pattern:** `<service>_<verb>` snake_case — **same rule as tools.** The
aggregator namespaces prompts as `<service>/<prompt>`, so the service prefix
MUST stay in the inner name for direct-call self-description.

- `quo_triage_inbound`, `quo_summarize_thread`, `imsg_unified_brief` — good.
- **Bare parity names** (`send_text_message`, `create_contact`) are a
  sanctioned EXCEPTION, permitted ONLY to shadow a *named external connector's*
  prompt surface, and MUST carry a justifying comment (e.g.
  `// Parity prompts — match Quo's official Anthropic connector names`).
  Absent that, the `<service>_` prefix is mandatory.

A prompt body (the rendered `messages[].content.text`) SHOULD name the concrete
`<service>_*` tools the LLM is expected to call — prompts orchestrate this
service's own tools by name.

### Resource URI + name
**URI scheme:** `<service>://<domain>/<noun>` (kebab segments) — the service's
OWN scheme. NEVER `chitty://` and NEVER `chittycanon://`.

| Scheme | Owner | Meaning |
|--------|-------|---------|
| `chittycanon://` | ChittyGov | canonical governance/service **identity** in the graph |
| `chitty://` | reserved | ecosystem-internal cross-service references |
| `<service>://` | the worker | **MCP resource handles** — live, read-only runtime data |

An MCP resource URI is a transport handle for live data, NOT a canonical graph
identifier — conflating them with `chittycanon://` is a violation.
Examples: `quo://phone-numbers`, `quo://config/routing`, `imsg://sync/state`.

- **Resource name** (first arg): `<service>_<noun>` snake_case
  (`quo_phone_numbers`), mirroring tool naming.
- **MIME type:** explicit, always. `application/json` default; `text/markdown`
  for rendered docs; `text/plain` for logs.

### Argument schema
Plain object of Zod validators (NOT a wrapped `z.object()`):
`argsSchema: { from: e164, body: z.string().min(1) }`. Constrain types
semantically (shared `e164` regex, `.min(1)`, `.int().min().max()`). Use
`.describe()` on any argument whose purpose isn't obvious from its name.

### Capabilities
SDK-derived — do NOT hand-write the `capabilities` block. Calling
`registerPrompt` / `registerResource` in `init()` makes McpServer advertise the
`prompts` / `resources` capabilities automatically. Leave `listChanged` /
`subscribe` OFF unless the list is dynamic or you actually honor
`resources/subscribe` (declaring `subscribe` without implementing it is a
non-working-endpoint violation).

### @canon citation
Cite canon ONCE at the module header of `prompts.ts` / `resources.ts`:
```ts
// @canon: chittycanon://gov/governance#core-types
// @canonical-uri: chittycanon://core/services/chittyagent-<name>
```
Do NOT scatter P/L/T/E/A references into individual prompts.

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

### The prompt/resource wrap (canonical template)

Keep prompts and resources in **separate files** (`prompts.ts`, `resources.ts`) —
do not inline into the agent class. Register them in `init()` alongside tools.

```ts
// src/prompts.ts — static templates, no env needed
// @canon: chittycanon://gov/governance#core-types
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function register<Name>Prompts(server: McpServer) {
  server.registerPrompt(
    "<service>_<verb>",
    { title: "<human label>", description: "<what it does + which tools it orchestrates>",
      argsSchema: { /* zod validators */ } },
    (args) => ({ messages: [{ role: "user", content: { type: "text", text:
      [ "<task>", "", "Use `<service>_<tool>` to …" ].join("\n") } }] }),
  );
}

// src/resources.ts — LIVE data only, no mocks (see §6)
// @canon: chittycanon://gov/governance#core-types
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function register<Name>Resources(
  server: McpServer, env: Env, getCredential: (n: string) => Promise<string>,
) {
  server.registerResource(
    "<service>_<noun>", "<service>://<domain>/<noun>",
    { title: "<label>", description: "<live data this serves>", mimeType: "application/json" },
    async (uri) => {
      const data = await /* real REST client / Neon query / env config */;
      return { contents: [{ uri: uri.href, mimeType: "application/json",
        text: JSON.stringify(data, null, 2) }] };
    },
  );
}

// in the agent: async init() {
//   register<Name>Tools(this.server, this.env);
//   register<Name>Prompts(this.server);
//   register<Name>Resources(this.server, this.env, (n) => resolveCredential(this.env, n, SERVICE));
// }
```

**No-resource is a valid outcome.** If a service has no real live data to expose
(a pure-action worker), ship prompts only and say so — do NOT fabricate a
resource to fill the slot. Mock resources violate §6.

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
  deployed endpoint as evidence the wrap landed. When the PR adds prompts or
  resources, it MUST also include `prompts/list` and `resources/list` output
  from the deployed endpoint — every resource proven to return live data.

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
