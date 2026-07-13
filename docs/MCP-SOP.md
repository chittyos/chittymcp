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
**Pattern:** `<verb>` or `<noun>_<verb>` — **BARE. Do NOT prefix with the
service name.** Lowercase snake. The MCP server name (`chittyagent-<name>`) and
the aggregator namespace already carry the service; repeating it in the tool
name is redundant and compounds badly through layers.

| Good        | Bad                  | Reason |
|-------------|----------------------|--------|
| `list`      | `tasks_list`         | service prefix is redundant (server is already `chittyagent-tasks`) |
| `search`    | `notes_search`       | `chittyagent-notes` already names the service |
| `resolve_token` | `auth_resolve_token` | drop the `auth_` prefix |
| `ingest`    | `ingest_evidence`    | verb-last AND redundant |
| `list`      | `listTasks`          | wrong case |

**Why bare (binding):** an aggregator namespaces as `<service>/<tool>` and a
downstream connector adds its OWN name on top. A service-prefixed tool
therefore triples the service token end-to-end — e.g. `quo_send_message`
federated through chittymsg and surfaced via the Chitty_Msg connector becomes
`Chitty_Msg__chittyagent-quo_quo_send_message` ("quo" ×3). Bare `send_message`
renders as `Chitty_Msg__chittyagent-quo_send_message` — the service appears
exactly once, where it belongs (the server name). A client connected directly
to `<name>.chitty.cc/mcp` already knows which server it called, so bare names
are still self-descriptive there.

### Verbs
Canonical verbs (extend cautiously, document if new):
`list, get, create, update, delete, claim, release, complete, fail, cancel,
heartbeat, resolve, validate, ingest, search, render`.

### Tool grouping
If a service has >8 tools, group by capability domain in the tool name (still
service-prefix-free): `object_put`, `object_get`, `bucket_list`.

## 3.5 Prompt & Resource conventions (binding)

Ratified from live precedent in `chittyagent-quo` and `chittyagent-imessage`
(the first two workers to ship prompts + resources). `chittyagent-quo` is the
canonical reference implementation — read its `src/prompts.ts` and
`src/resources.ts`.

### Prompt name
**Pattern:** `<verb>` snake_case — **BARE, same rule as tools (§3).** Do NOT
prefix with the service name; the server + aggregator namespace already carry
it. `triage_inbound`, `summarize_thread`, `unified_brief` — good.
`quo_triage_inbound` — bad (redundant `quo_`).

A prompt body (the rendered `messages[].content.text`) SHOULD name the concrete
bare tools the LLM is expected to call — prompts orchestrate this service's own
tools by name (`search`, `list_messages`, …).

### Resource URI + name
**Resource name:** bare `<noun>` (`phone_numbers`, not `quo_phone_numbers`) —
same bare rule as tools/prompts.

**URI scheme:** `<service>://<domain>/<noun>` (kebab segments). Here the
`<service>://` *scheme* IS the namespace mechanism for resources (the analog of
the aggregator's `<service>/` tool prefix), so it names the service exactly
once — that is correct, not redundant. NEVER `chitty://`, NEVER `chittycanon://`.

| Scheme | Owner | Meaning |
|--------|-------|---------|
| `chittycanon://` | ChittyGov | canonical governance/service **identity** in the graph |
| `chitty://` | reserved | ecosystem-internal cross-service references |
| `<service>://` | the worker | **MCP resource handles** — live, read-only runtime data |

An MCP resource URI is a transport handle for live data, NOT a canonical graph
identifier — conflating them with `chittycanon://` is a violation.
Examples: `quo://phone-numbers`, `quo://config/routing`, `imsg://sync/state`.

- **Resource name** (first arg): bare `<noun>` snake_case (`phone_numbers`,
  NOT `quo_phone_numbers`), mirroring the bare tool/prompt rule.
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

## 3.6 Baseline tools (binding — every service MCP)

Every ChittyOS MCP server MUST expose these meta-tools, named exactly (bare,
per §3):

| Tool | Contract |
|------|----------|
| `status` | Returns `{service, version, status, deps?}` — the MCP mirror of the `/health` HTTP endpoint. Real-dependency probe, no mocks (§6). |
| `describe` | Returns the service's full surface: `{service, version, canonical_uri, tools: [{name, description}], prompts: [...], resources: [...]}`. Self-documenting; the payload is the same shape POSTed to ChittySchema (below). |

### Schema self-registration (binding)
On deploy (or first `init()`), every service MUST register its tool surface
with the canonical registry:

```
POST https://schema.chitty.cc/api/tools/register
{ "server": "chittyagent-<name>", "name": "<bare_tool_name>",
  "description": "...", "inputSchema": { ... } }
```

one POST per tool, bare names only (ChittySchema keys them
`tool:chittyagent-<name>:<bare_name>`). The gatekeeper compliance check treats
an MCP-serving worker with zero entries at
`GET schema.chitty.cc/api/tools/chittyagent-<name>` as non-compliant.
Implementation lives in `workers/shared/baseline-tools.ts` (chittyentity) —
use it; do not hand-roll.

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
    "<verb>",                         // BARE — no service prefix (§3)
    "<one-line description>",
    { /* zod schema */ },
    async (input) => {
      try {
        const out = await <existingFunction>(env, input);
        return _t(out);
      } catch (e) { return _e(`<verb> failed: ${(e as Error).message}`); }
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
    "<verb>",                         // BARE — no service prefix (§3.5)
    { title: "<human label>", description: "<what it does + which tools it orchestrates>",
      argsSchema: { /* zod validators */ } },
    (args) => ({ messages: [{ role: "user", content: { type: "text", text:
      [ "<task>", "", "Use `<tool>` to …" ].join("\n") } }] }),
  );
}

// src/resources.ts — LIVE data only, no mocks (see §6)
// @canon: chittycanon://gov/governance#core-types
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function register<Name>Resources(
  server: McpServer, env: Env, getCredential: (n: string) => Promise<string>,
) {
  server.registerResource(
    "<noun>", "<service>://<domain>/<noun>",   // bare name; service lives in the URI scheme
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
- Generate that evidence with **`scripts/verify-mcp.sh`** — it runs the full
  `initialize → tools/list → prompts/list → resources/list` handshake (and
  `--read` proves every resource returns live data):
  ```bash
  scripts/verify-mcp.sh <service> --read          # canonical <name>.chitty.cc
  scripts/verify-mcp.sh <service> --origin --read  # if the canonical domain is Access-gated
  MCP_BEARER=$KEY scripts/verify-mcp.sh mcp.chitty.cc/<service>/mcp  # aggregated path
  ```
- **Verification ≠ persistence.** Deploying an unmerged branch to production to
  capture this evidence is transient — the next deploy of that worker from
  `main` reverts it. The prompts/resources are durable ONLY once the PR merges.
  Treat the PR as the source of truth, not the live-but-unmerged deployment.

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
