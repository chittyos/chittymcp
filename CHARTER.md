# ChittyMCP Charter

## Classification
- **Tier**: 2 (Platform / Aggregator)
- **Organization**: CHITTYOS
- **Domain**: MCP Aggregation
- **Role**: Universal MCP aggregator over the ChittyOS service MCPs (membership is a compile-time projection of ChittyRegistry)

## Mission

ChittyMCP is the **universal MCP aggregator** for the ChittyOS ecosystem. **ChittyRegistry
(registry.chitty.cc) is the registry of record** for service membership; ChittyMCP's
membership is a **compile-time generated projection** of that registry (`SERVICE_MAP` +
`VIEW_CATEGORIES` + wrangler `services[]` bindings). ChittyMCP federates the services
under a single canonical endpoint (`mcp.chitty.cc`) so any MCP client (Claude, ChatGPT,
agents, IDEs) gets one URL and discovers the full surface.

## Aggregator Topology

**ChittyRegistry is the registry of record.** Three aggregators consume generated
projections of it (the Cloudflare gateway performs edge auth/routing but is **not** the
membership authority):

| Aggregator | Endpoint | Surface | Audience | Auth |
|------------|----------|---------|----------|------|
| **chittymcp** (this repo) | `/mcp` | All services / all tools | Machines, agents, devs | Service-binding / token |
| **chittycpa** | `/cpa/mcp` | `category:finance` MCPs (finance; +future stripe/quickbooks/plaid) | Finance / accounting surfaces | Token |
| **chittymsg** | `/msg/mcp` | `category:communication` MCPs (quo, twilio, imessage, bluebubbles, notes, dispute, autoassist) | Comms surfaces | Token |
| **ch1tty** | (separate gateway) | Smart / AI gateway, curated subset | Humans, portal | OAuth |

### Membership (category-based aggregate sub-views)

Each service entry in `SERVICE_MAP` (src/worker/index.ts) carries a `category`
(`finance`, `communication`, `platform`, `infra`, `legal`, …), reusing the
`category` vocabulary from ch1tty `servers.json`. A POST to `/{view}/mcp`
federates only the services whose category matches the view's category, then
runs the identical aggregate pipeline (initialize / tools/list / tools/call /
prompts / resources) over that filtered set.

- **chittymcp** (`/mcp`): every bound service (no filter)
- **chittycpa** (`/cpa/mcp`): `category === "finance"`
- **chittymsg** (`/msg/mcp`): `category === "communication"`

View → category mapping lives in `VIEW_CATEGORIES` (src/worker/index.ts). New
services join a view automatically by declaring the matching `category`; an
empty filtered set fails CLOSED (zero tools, not the full surface). View names
never shadow a real service id — a service named like a view wins the route.

> NOTE (2026-06): Prior versions of this charter described `domain:`/`surface:`
> tag filters. Those were **documentation-only and never enforced** in the
> worker. The category-based sub-views above are the real, implemented
> mechanism that replaces them.

## Endpoint Convention

```
mcp.chitty.cc/{service-name}/mcp  →  chittyagent-{service-name}
```

Routed via Cloudflare service bindings (no HTTP round-trips). See `wrangler.jsonc`
for the live binding list.

## Scope

### IS Responsible For
- Federating the projected service MCPs under `mcp.chitty.cc`
- Routing `/{name}/mcp` requests to the bound service worker
- Membership enforcement (category filter over the compile-time `SERVICE_MAP` projection — no runtime membership read)
- Exposing the official MCP `/v0.1/servers` discovery endpoint
- Health / observability surface for the aggregator itself

### IS NOT Responsible For
- Tool implementation (lives in each `chittyagent-*` service)
- Service registration (ChittyRegistry — the registry of record)
- Identity / token issuance (ChittyID, ChittyAuth)
- OAuth gating (that is ch1tty's job)
- Persistent state for tool calls (each upstream owns its state)

## Dependencies

| Type | Service | Purpose |
|------|---------|---------|
| Registry of record | ChittyRegistry | Canonical service catalog; membership projected to `SERVICE_MAP` + wrangler bindings at build time |
| Edge | Cloudflare Access / gateway | Per-service auth + routing (NOT the membership authority) |
| Peer | chittymsg | Messaging-domain aggregator |
| Peer | ch1tty | OAuth-protected smart gateway |
| Upstream (bindings) | chittyagent-dispute, chittyagent-notes, chittyagent-ship, chittystorage, chittyrouter, chittycommand, chittyregistry, chittyconnect, chittyagent-ch1tty | Federated MCP backends |

Live binding set: see `wrangler.jsonc → services[]`.

## Compliance

- [x] CLAUDE.md present
- [x] Single wrangler config (`wrangler.jsonc`)
- [x] Tail consumer wired to `chittytrack`
- [x] Routes `mcp.chitty.cc/*` to consolidated worker (`src/worker/index.ts`)
- [ ] All upstream services registered in ChittyRegistry (membership projected into `SERVICE_MAP` + wrangler bindings)
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
