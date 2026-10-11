# ChittyMCP Charter

## Classification
- **Tier**: 2 (Platform / internal MCP aggregator)
- **Organization**: CHITTYOS
- **Canonical service**: `chittycanon://core/services/chittymcp`
- **Runtime host**: `mcp-aggregator.chitty.cc` (legacy Worker projection)
- **Public MCP host**: `mcp.chitty.cc` — Cloudflare **managed** MCP Portal, **not** served by this Worker.

## Decision and ownership (2026-10-11)

**The operator's authoritative decision is that `https://mcp.chitty.cc/mcp`
is a Cloudflare-managed native MCP Portal** (`chitty-mcp`, ChittyCorp Cloudflare account).
Cloudflare Access manages external OAuth, portal session authentication,
federation, tool/prompt exposure, and portal-level policies. This repository
MUST NOT claim that hostname in Worker routes, DNS, public OAuth metadata,
auto-binding, or route reconciliation.

- **ChittyRegister/Neon** owns governed service-registration records.
- **ChittyRegistry** owns service discovery/catalog projections.
- **ChittyCanon** owns ontology and canonical identity/URI conventions.
- **Cloudflare One** owns the deployed native MCP servers and role portals.
- **ChittyEntity** owns governed agent implementation projections, not their identity class/ontology.
- **This repository** owns only its legacy service-binding aggregator and internal routing logic.

The existing smart slim-MCP at `mcp.ch1tty.com` is a separate capability,
not an alias to the managed native portal.

## Legacy aggregation (isolated)

The legacy Worker remains bound, where configured, to
`https://mcp-aggregator.chitty.cc`, not `mcp.chitty.cc`.

| Endpoint | Purpose |
|---|---|
| `/mcp` | Internal legacy tool federation |
| `/{service}/mcp` | Service-binding proxy for explicitly bound agents |
| `/v0.1/servers` | Legacy Worker discovery (not Cloudflare portal discovery) |
| `/cpa/mcp` | Legacy `category:finance` view |
| `/msg/mcp` | Legacy `category:communication` view |
| `/health` | Worker liveness |

The legacy category views **do not** substitute for role-specific Cloudflare
managed portals. A missing category fails closed. None of these endpoints
should be advertised as paths under the native managed portal.

## Route governance

- The Worker config may include `mcp-aggregator.chitty.cc/*`.
- The Worker config **must not** include `mcp.chitty.cc/*`.
- `POST /admin/reconcile/routes` may reconcile **only legacy-owned routes**;
  it must never create, modify, or delete the managed portal's routes.
- A change to managed portal DNS, Access, membership, OAuth, or policy goes
  through Cloudflare's native MCP/Access APIs and an audited reversible plan.
- Never weaken Access or hardcode credentials to mask an authentication defect.
  Credentials are brokered at runtime through ChittyConnect/ChittySecrets.
- Cloudflare portal `Ready` reports a successful capability sync, not proof
  of authorized tool invocation. Validate via MCP Inspector and client calls.
- Keep legal/evidence capabilities in the Legal trust domain.

## Existing infrastructure

- Main native portal: `chitty-mcp` at `mcp.chitty.cc`.
- Legacy Worker: `chittymcp` at `mcp-aggregator.chitty.cc`.
- Source file: `src/worker/index.ts`; bindings: `wrangler.jsonc`.
- Runtime membership authority must not be inferred from historical static
  `SERVICE_MAP` entries or an old triage snapshot.

## Compliance and verification

Before promotion, compare managed portal API state, Worker routes, custom
domains, proxied DNS, Access apps/policies, registry records, service
authentication, and individual `tools/list` plus prompts/resources.
A legacy health 200 or registry status `active` is insufficient to certify
a functional public MCP connection.

## Ownership
- **Service owner**: ChittyOS
- **Technical lead**: @chittyos-infrastructure
- **Contact**: mcp@chitty.cc

---
*Charter version 2.1.0 — source correction; not evidence of production deployment.*
