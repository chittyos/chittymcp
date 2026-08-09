# SOP: Adding a New Service MCP to ChittyMCP

This is the canonical procedure for exposing a ChittyOS service's MCP through the
`mcp.chitty.cc` aggregator. Follow it in order — each step has an explicit
gate before the next.

## Topology recap

```
       ┌────────────────────────────────────────────────────┐
       │  ChittyRegistry  (registry of record)              │
       │  Canonical catalog → generated manifest → compile- │
       │  time projection (SERVICE_MAP + wrangler bindings) │
       └────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
    chittymcp             chittymsg               ch1tty
   (all services)       (domain:messaging)   (audience:human
                                              AND auth:oauth-ok)
```

Aggregator membership is a **compile-time projection** of ChittyRegistry into
`SERVICE_MAP` + wrangler `services[]` bindings. You add a service by landing a
**reviewed PR** that edits those projections — the `/admin/bind` deploy beacon
opens exactly that PR automatically. It is never a runtime tag flip, and there
is no KV/posture fallback that could serve a divergent membership.

## Step 1 — Build the service MCP

Each service exposes its own MCP endpoint inside its worker:

- Route: `<service>.chitty.cc/mcp` (POST, MCP JSON-RPC)
- Lists tools, handles tool calls, returns standard MCP responses.

Validate:
```
curl -s -X POST https://<service>.chitty.cc/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq .
```
**Gate:** `tools/list` returns ≥1 tool. Do not proceed otherwise.

## Step 2 — Register in CF gateway with tags

Register the service MCP through the gateway with the canonical tag set:

| Tag | Required? | Values |
|-----|-----------|--------|
| `surface` | yes | `all` (default), or omit to exclude from chittymcp |
| `domain` | yes | `messaging`, `legal`, `finance`, `infra`, `evidence`, `identity`, `comms`, … |
| `audience` | yes | `machine` (default), `human`, `both` |
| `auth` | yes | `service-binding`, `token`, `oauth-ok` |
| `tier` | recommended | `0`–`5` per ChittyOS tier model |

ChittyRegistry (registry.chitty.cc) is the registry of record; the aggregator
surfaces a compile-time projection of it via `/v0.1/servers`. The gateway tags
are edge auth/routing metadata, not the membership authority.

**Gate:** `curl https://registry.chitty.cc/v0.1/servers | jq '.[] | select(.name=="<service>")'`
returns your entry with tags.

## Step 3 — Add the service binding to chittymcp

Edit `wrangler.jsonc` only — never `wrangler.toml` (deprecated):

```jsonc
"services": [
  // …existing…
  { "binding": "SVC_<UPPER>", "service": "chittyagent-<name>" }
]
```

Binding name convention: `SVC_<UPPER_SNAKE>`. Service name must match the
deployed worker name exactly.

## Step 4 — Wire the route in `src/worker/index.ts`

The worker maps `mcp.chitty.cc/<name>/mcp` to the bound service. Confirm the
route resolver picks up the new binding (it should be data-driven off the
bindings list — if you have to add a hand-written case, refactor first).

## Step 5 — Deploy & smoke-test

```
npx wrangler deploy
curl -s -X POST https://mcp.chitty.cc/<name>/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length'
```
**Gate:** number matches what `<service>.chitty.cc/mcp` returns directly.

## Step 6 — Verify aggregator membership

```
curl -s https://mcp.chitty.cc/v0.1/servers   | jq '.[] | select(.name=="<name>")'
curl -s https://msg.chitty.cc/v0.1/servers   | jq '.[] | select(.name=="<name>")'  # if domain:messaging
curl -s https://ch1tty.chitty.cc/v0.1/servers| jq '.[] | select(.name=="<name>")'  # if audience:human + auth:oauth-ok
```
**Gate:** appears in every aggregator whose policy its tags match, and only those.

## Step 7 — Document & PR

- Add a row to the upstream table in `CHARTER.md`
- Open PR with the wrangler diff, a link to the gateway registration, and the
  three curl outputs from step 6 in the PR body (real responses, not mocks).

## Anti-patterns (do not do)

- ❌ Adding a new MCP to `~/.claude/.mcp.json` — capabilities are centralized
- ❌ Hand-editing aggregator allowlists instead of tagging at the gateway
- ❌ Implementing MCP tool logic inside `chittymcp` — it is purely a router
- ❌ Using HTTP fetch to call an upstream that already has a service binding
- ❌ Committing a route that returns a placeholder envelope ("no mocks" rule)
