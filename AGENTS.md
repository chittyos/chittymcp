---
service_chittyid: "TBD-pending-canonical-mint"
service_name: "chittymcp"
canonical_uri: "chittycanon://core/services/chittymcp"
pentad_version: "0.1.0"
tier: 9
last_reviewed: "2026-05-26"
---

# chittymcp — AGENTS

## Overview
ChittyMCP is an MCP **aggregator** and **router**, not a tool-implementation repository. There are no agents defined or implemented in this repository.

## Upstream Agents
All tool and agent implementations live in the `chittyentity` repository under `workers/chittyagent-*`.

ChittyMCP federates these service MCPs under a single canonical endpoint (`mcp.chitty.cc`) using Cloudflare service bindings.

## Adding a New Agent
To add a new agent to the ecosystem:
1. Implement the agent in `chittyentity/workers/chittyagent-<name>`.
2. Add the agent to the `services[]` array in `wrangler.jsonc` of this repo.
3. Add the agent to `SERVICE_MAP` in `src/worker/index.ts`.
4. Deploy `chittymcp`.
