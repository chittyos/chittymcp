---
service_chittyid: "TBD-pending-canonical-mint"
service_name: "chittymcp"
canonical_uri: "chittycanon://core/services/chittymcp"
pentad_version: "0.1.0"
tier: 9
last_reviewed: "2026-05-26"
---

# chittymcp — SECURITY

## Security Model

- **Aggregator Gateway:** ChittyMCP gates access with `Bearer $MCP_API_KEY` (stored in Cloudflare secrets).
- **Upstream Services:** Upstream service workers (`chittyagent-*`) are reached via Cloudflare service bindings. No public authentication is required from `chittymcp` to the upstream workers, as they intrinsically trust the service binding.
- **Direct Calls:** Direct calls to `<name>.chitty.cc/mcp` (bypassing the aggregator) use Cloudflare Access + per-worker bearer tokens (managed in each worker's `auth.ts`).
- **Secrets Management:** All secrets flow through 1Password into the Cloudflare secrets store. Secrets are never hardcoded in the repository.

## Policy Enforcement
Per-aggregator policy is enforced at **compile time**: each service's `category` in `SERVICE_MAP` is mapped to a sub-view via `VIEW_CATEGORIES` in `src/worker/index.ts`. Both are **generated projections** of the ChittyRegistry manifest (the registry of record) — not a runtime read of Cloudflare gateway or KV state. There is no runtime membership store, so no request can be served against a stale or divergent service list.
