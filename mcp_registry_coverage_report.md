# MCP Registry Coverage & Alignment Report
**Document ID**: `REP-MCP-REGISTRY-COVERAGE-2026-06-13`  
**Status**: DRAFT  
**Subject**: Analysis of registered ChittyOS services vs. active MCP server capabilities.  
**Auditor**: Antigravity (Advanced Agentic Coding)  

---

## Overview

This report cross-references all **39 registered services** from the ChittyRegistry (`GET /api/v1/tools`) with the **16 registered MCP servers** (`GET /v0.1/servers`) to identify:
1. Services that have active MCP interfaces but are missing from the server catalog.
2. Foundation services that lack direct MCP interfaces and rely on mediation.
3. Non-MCP services (webhooks, automation tasks, UIs) that do not require MCP endpoints.

---

## Service vs. MCP Alignment Matrix

Below is the cross-reference mapping of all 39 registered services:

| Name | Type / Description | Has MCP Code? | Registered in Server Catalog? | Status / Gaps |
| --- | --- | --- | --- | --- |
| `chittyagent-helper` | Navigation Agent | **Yes** | No | **Registration Gap**: Not registered in `/v0.1/servers`. |
| `chittyagent-autoassist` | Loop Runner | **Yes** | No | **Registration Gap**: Not registered in `/v0.1/servers`. |
| `chittyagent-tasks` | Inter-agent Tasks | **Yes** | No | **Registration Gap**: Missing from `/v0.1/servers`. |
| `chittyagent-dispute` | Dispute management | **Yes** | No | **Registration Gap**: Missing from `/v0.1/servers`. |
| `chittyagent-finance` | Ledger integration | **Yes** | No | **Registration Gap**: Missing from `/v0.1/servers`. |
| `chittyagent-notes` | RAG over Apple Notes | **Yes** | **Yes** | Aligned (Active remote: `notes.chitty.cc`). |
| `chittyagent-ship` | Deployment assistant | **Yes** | **Yes** | Aligned (Active remote: `ship.chitty.cc`). |
| `chittyagent-gam` | Google Admin proxy | **Yes** | **Yes** | Aligned (Active remote: `gam.agent.chitty.cc`). |
| `chittyagent-neon` | Neon PostgreSQL proxy | **Yes** | **Yes** | Aligned (Active remote: `neon.agent.chitty.cc`). |
| `chittyagent-imessage` | iMessage sync | **Yes** | **Yes** | Aligned (Active remote: `imessage.chitty.cc`). |
| `chittyconnect` | Core API & AI spine | **Yes** | **Yes** | Aligned (Active remote: `connect.chitty.cc`). |
| `chittyevidence-db` | Legal evidence tracker | **Yes** | **Yes** | Aligned (Registered as `chittyevidence-search`). |
| `chittystorage` | Content-addressed storage | **Yes** | No | **Endpoint Drift**: Exposes `/mcp` in endpoints but not registered in servers catalog. |
| `chittyauth` | Identity & token issuer | **Yes** | No | Exposes `/auth/mcp` via Hono, but missing from servers catalog. |
| `chittyregistry` | Service directory | **Yes** | No | Aggregated via `chittymcp`, missing from servers catalog. |
| `chittyschema` | Schema validation | **Yes** | No | Exposes `/schema/mcp`, missing from servers catalog. |
| `chittyledger` | Core financial ledger | No | No | Meditated via `chittyconnect` proxy. |
| `chittymint` | Cryptographic mint | No | No | Meditated via `chittyconnect` proxy. |
| `chittyregister` | Compliance gateway | No | No | Meditated via `chittyconnect` proxy. |
| `chittyintel` | Data/Intel service | No | No | Internal dependency. |
| `chittychronicle` | Event log broker | No | No | Ingestion-only REST endpoint. |
| `openclaw` | Local TUI VM agent | No | No | Run-once local agent. |
| `daily-comms-triage` | Triage automation | No | No | Cron-driven worker (non-interactive). |
| `daily-comms-triage-realtime` | Realtime triage | No | No | Webhook-driven worker (non-interactive). |
| `flow-hash-check` | Workflow monitor | No | No | Cron-driven worker (non-interactive). |
| `comptroller` | Budget controller | No | No | Cron/REST monitoring service. |
| `chittyagent-ui` | Dashboard UI | No | No | Static frontend. |
| `chittybrand-cdn` | Asset CDN | No | No | Static content delivery. |
| `chittyapi` | Public gateway API | No | No | REST wrapper. |
| `chittybeacon` | Health beacon | No | No | Monitoring target. |
| `chittycan` | Internal utility | No | No | Non-MCP. |
| `chittycert` | Certifier service | No | No | Internal cryptographic helper. |
| `chittycharge` | Payments gateway | No | No | REST API endpoint. |
| `chittycommand` | Terminal command API | No | No | Internal execution engine. |
| `chittyconcierge` | Workspace assistant | No | No | Internal helper. |
| `chittycounsel` | Legal reasoning tool | No | No | REST-only service. |
| `chittydiscovery` | Service discovery mesh | No | No | Internal system mesh. |
| `chittydlvr` | Delivery router | No | No | REST API. |
| `chittydna` | Identity validation | No | No | Internal verification helper. |
| `chittydocs` | Documentation index | No | No | Static markdown server. |

---

## Critical Gaps & Recommendations

### 1. Registry Servers Catalog Sync (Severity: High)
* **Gap**: 5 critical operational agents (`helper`, `autoassist`, `tasks`, `dispute`, `finance`) are fully implemented as MCP servers in the source code but are **completely missing** from the `/v0.1/servers` catalog.
* **Impact**: External client routers and automated builders (such as `chittyagent-mcp-builder`) cannot discover these servers' manifests, versions, or schemas.
* **Action**: Run `mcp_builder_sync_registry` or publish server manifests for these workers to align the catalog with the codebase.

### 2. Endpoints Exposure Discrepancies (Severity: Medium)
* **Gap**: `chittystorage` exposes `/mcp` in its registered service endpoints metadata, but is not cataloged as a server.
* **Action**: Audit the `chittystorage` worker to verify if the `/mcp` endpoint is active, and update the registry mapping.

### 3. Mediation vs. Exposure Paradigm
* **Design Decision**: Core foundation services (`ledger`, `mint`, `register`) are kept non-MCP and mediated via `chittyconnect` (Chronicle / API proxy) to preserve per-Consumer cost and audit-chain attribution. This is a secure, correct alignment with the ChittyOS architecture and should be maintained.

---

*Document Category: Governance Audit Finding / Registry Mapping*  
*Canonical Reference: chittycanon://docs/ops/policy/audit-mcp-registry-coverage-2026-06-13*  
