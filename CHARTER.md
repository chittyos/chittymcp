# ChittyMCP Charter

## Classification
- **Tier**: 2 (Platform / Aggregator)
- **Organization**: CHITTYOS
- **Domain**: MCP Aggregation
- **Role**: Universal MCP aggregator over all CF-gateway-registered service MCPs

## Mission

ChittyMCP is the **universal MCP aggregator** for the ChittyOS ecosystem. Individual
service MCPs are registered in the Cloudflare gateway as the source of truth; ChittyMCP
federates them under a single canonical endpoint (`mcp.chitty.cc`) so any MCP client
(Claude, ChatGPT, agents, IDEs) gets one URL and discovers the full surface.

## Aggregator Topology

CF Gateway is the registry of record. Three aggregators consume it:

| Aggregator | Surface | Audience | Auth |
|------------|---------|----------|------|
| **chittymcp** (this repo) | All services / all tools | Machines, agents, devs | Service-binding / token |
| **chittymsg** | Messaging-domain MCPs (quo, gmail, imsg, openphone, rmail, …) | Comms surfaces | Token |
| **ch1tty** | Smart / AI gateway, curated subset | Humans, portal | OAuth |

### Membership (hybrid: tags + per-aggregator policy)

Each CF-registered service MCP declares tags at registration time
(`domain:messaging`, `audience:human`, `auth:oauth-ok`, `surface:all`, …).
Each aggregator applies a policy filter over those tags:

- **chittymcp**: includes everything with `surface:all` (default for new services)
- **chittymsg**: `domain:messaging`
- **ch1tty**: `audience:human AND auth:oauth-ok`

New services join their relevant aggregators automatically by declaring the right tags;
aggregator-side policy can still reject (fail-closed).

## Endpoint Convention

```
mcp.chitty.cc/{service-name}/mcp  →  chittyagent-{service-name}
```

Routed via Cloudflare service bindings (no HTTP round-trips). See `wrangler.jsonc`
for the live binding list.

## Scope

### IS Responsible For
- Federating CF-registered service MCPs under `mcp.chitty.cc`
- Routing `/{name}/mcp` requests to the bound service worker
- Membership enforcement (tag + policy filter)
- Exposing the official MCP `/v0.1/servers` discovery endpoint
- Health / observability surface for the aggregator itself

### IS NOT Responsible For
- Tool implementation (lives in each `chittyagent-*` service)
- Service registration (CF gateway + ChittyRegistry)
- Identity / token issuance (ChittyID, ChittyAuth)
- OAuth gating (that is ch1tty's job)
- Persistent state for tool calls (each upstream owns its state)

## Dependencies

| Type | Service | Purpose |
|------|---------|---------|
| Source of truth | Cloudflare gateway | Service MCP registration |
| Peer | ChittyRegistry | Canonical service catalog (`/v0.1/servers`) |
| Peer | chittymsg | Messaging-domain aggregator |
| Peer | ch1tty | OAuth-protected smart gateway |
| Upstream (bindings) | chittyagent-dispute, chittyagent-notes, chittyagent-ship, chittystorage, chittyrouter, chittycommand, chittyregistry, chittyconnect, chittyagent-ch1tty | Federated MCP backends |

Live binding set: see `wrangler.jsonc → services[]`.

## Compliance

- [x] CLAUDE.md present
- [x] Single wrangler config (`wrangler.jsonc`)
- [x] Tail consumer wired to `chittytrack`
- [x] Routes `mcp.chitty.cc/*` to consolidated worker (`src/worker/index.ts`)
- [ ] All upstream services declare tags at CF gateway registration
- [ ] `/v0.1/servers` discovery endpoint live
- [ ] Per-aggregator policy filter implemented in `src/worker/`
- [ ] Legacy directories (`mcp-evidence-server`, `mcp-unified-consolidated`, `chittyos-*-mcp`, `mcp-chittyconnect`, `mcp-handler.js`, etc.) removed or moved to `archive/`

## Ownership

| Role | Owner |
|------|-------|
| Service Owner | ChittyOS |
| Technical Lead | @chittyos-infrastructure |
| Contact | mcp@chitty.cc |

---
*Charter Version: 2.0.0 | Last Updated: 2026-05-26*
