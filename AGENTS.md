---
service_chittyid: "TBD-pending-canonical-mint"
service_name: "chittymcp"
canonical_uri: "chittycanon://core/services/chittymcp"
pentad_version: "0.1.0"
tier: 2
last_reviewed: "2026-10-11"
---

# chittymcp — AGENTS

## Operational boundary

`https://mcp.chitty.cc/mcp` is the **Cloudflare-managed native MCP portal**
(`chitty-mcp`). It is not served by the code in this repository.

The legacy service-binding aggregator in this repository is exposed, where
approved and deployed, only at `mcp-aggregator.chitty.cc`.

Never add `mcp.chitty.cc/*` to `wrangler.jsonc` or reconstruct it from
`src/worker/index.ts` using `/admin/reconcile/routes`.

## Integration

- Registration governance: ChittyRegister, ChittyRegistry/Neon, ChittyCanon.
- Agent implementations: `chittyos/chittyentity` `chittyagent-*` projections.
- Public portal servers, access, OAuth, tool/prompt exposure: Cloudflare One.
- Credential custody/injection: ChittyConnect broker + ChittySecrets at runtime.
- Optional internal federation: service bindings and `SERVICE_MAP` in this repo.

For new capabilities, implement and verify an existing owned agent first.
Register through the governed catalog and then reconcile Cloudflare's native
server and portal objects (with policy and rollback checks). Do not assume
adding a binding or updating legacy static `SERVICE_MAP` exposes the tool
through the public managed portal.

## Verification

1. Check current DNS CNAME of `mcp.chitty.cc` (native gateway).
2. Check Cloudflare managed portal `chitty-mcp` and Access app.
3. Check legacy Worker routes do not include `mcp.chitty.cc/*`.
4. Inspect `mcp-aggregator.chitty.cc` route independently.
5. Authenticate with MCP Inspector and call one real tool through the portal;
   a catalog status of `ready` alone is not a functional proof.
6. Verify per-role restrictions; legal/evidence and finance writes remain
   separately authorized and audited.

Run the existing test/build checks before merging. Do not deploy a route,
OAuth, or credential change without the governance approval gate.
