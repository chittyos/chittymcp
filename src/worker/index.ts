/**
 * ChittyMCP — MCP Aggregator Worker
 *
 * Serves mcp.chitty.cc — federates every chittyagent-* MCP under a single
 * surface via Cloudflare Service Bindings (no HTTP round-trips).
 *
 *   mcp.chitty.cc/mcp              → aggregated tools/list + tools/call (namespaced)
 *   mcp.chitty.cc/<name>/mcp       → proxied directly to chittyagent-<name>
 *   mcp.chitty.cc/v0.1/servers     → official MCP-spec discovery endpoint
 *   mcp.chitty.cc/health           → liveness
 *
 * Membership source of truth: docs/agent-registry-triage.json (Bucket A).
 * Per-aggregator policy filter (chittymsg = domain:messaging, ch1tty =
 * audience:human+auth:oauth-ok) is encoded in the SERVICE_MAP tags below;
 * downstream aggregators read /v0.1/servers and filter client-side.
 */

interface Env {
  SVC_ALCHEMIST: Fetcher;
  SVC_AUTH: Fetcher;
  SVC_AUTOASSIST: Fetcher;
  SVC_CANON: Fetcher;
  SVC_CH1TTY: Fetcher;
  SVC_CHATGPT: Fetcher;
  SVC_CLEANER: Fetcher;
  SVC_DISPATCH: Fetcher;
  SVC_DISPUTE: Fetcher;
  SVC_GAM: Fetcher;
  SVC_HELPER: Fetcher;
  SVC_IMESSAGE: Fetcher;
  SVC_MARKET: Fetcher;
  SVC_NEON: Fetcher;
  SVC_NOTES: Fetcher;
  SVC_NOTION: Fetcher;
  SVC_ORCHESTRATOR: Fetcher;
  SVC_QUO: Fetcher;
  SVC_RESOLVE: Fetcher;
  SVC_SCRAPE: Fetcher;
  SVC_SHIP: Fetcher;
  SVC_STORAGE: Fetcher;
  MCP_API_KEY?: string;
}

type BindingKey = keyof Env;

interface ServiceEntry {
  binding: BindingKey;
  label: string;
  description: string;
  tags: {
    surface: "all";
    domain: string;
    audience: "machine" | "human" | "both";
    auth: "service-binding" | "token" | "oauth-ok";
    tier: 0 | 1 | 2 | 3 | 4 | 5;
  };
}

const SERVICE_MAP: Record<string, ServiceEntry> = {
  alchemist:    { binding: "SVC_ALCHEMIST",    label: "Alchemist",          description: "Telemetry ingest + entity graph",      tags: { surface: "all", domain: "observability",  audience: "machine", auth: "service-binding", tier: 3 } },
  auth:         { binding: "SVC_AUTH",         label: "Auth",               description: "ChittyAuth identity + tokens",         tags: { surface: "all", domain: "identity",       audience: "machine", auth: "service-binding", tier: 1 } },
  autoassist:   { binding: "SVC_AUTOASSIST",   label: "AutoAssist",         description: "Automated tenant / lead assist",       tags: { surface: "all", domain: "comms",          audience: "machine", auth: "service-binding", tier: 4 } },
  canon:        { binding: "SVC_CANON",        label: "Canon",              description: "Canonical pattern + governance",       tags: { surface: "all", domain: "governance",     audience: "machine", auth: "service-binding", tier: 1 } },
  ch1tty:       { binding: "SVC_CH1TTY",       label: "Ch1tty Gateway",     description: "Identity-bound smart MCP gateway",     tags: { surface: "all", domain: "identity",       audience: "human",   auth: "oauth-ok",        tier: 2 } },
  chatgpt:      { binding: "SVC_CHATGPT",      label: "ChatGPT Bridge",     description: "ChatGPT connector + proxy",            tags: { surface: "all", domain: "ai",             audience: "both",    auth: "token",           tier: 4 } },
  cleaner:      { binding: "SVC_CLEANER",      label: "Cleaner",            description: "Cleaning ops + scheduling",            tags: { surface: "all", domain: "ops",            audience: "machine", auth: "service-binding", tier: 4 } },
  dispatch:     { binding: "SVC_DISPATCH",     label: "Dispatch",           description: "Task dispatch + queueing",             tags: { surface: "all", domain: "ops",            audience: "machine", auth: "service-binding", tier: 3 } },
  dispute:      { binding: "SVC_DISPUTE",     label: "Dispute",             description: "Dispute intake + comms intelligence",  tags: { surface: "all", domain: "legal",          audience: "both",    auth: "token",           tier: 4 } },
  gam:          { binding: "SVC_GAM",          label: "GAM",                description: "Google Workspace admin",               tags: { surface: "all", domain: "ops",            audience: "machine", auth: "service-binding", tier: 3 } },
  helper:       { binding: "SVC_HELPER",       label: "Helper",             description: "Ecosystem navigation + Q&A",           tags: { surface: "all", domain: "meta",           audience: "both",    auth: "token",           tier: 3 } },
  imessage:     { binding: "SVC_IMESSAGE",     label: "iMessage",           description: "iMessage thread access",               tags: { surface: "all", domain: "messaging",      audience: "human",   auth: "oauth-ok",        tier: 4 } },
  market:       { binding: "SVC_MARKET",       label: "Market",             description: "ChittyMarket artifact + tooling",      tags: { surface: "all", domain: "platform",       audience: "machine", auth: "service-binding", tier: 2 } },
  neon:         { binding: "SVC_NEON",         label: "Neon",               description: "Neon Postgres ops + branches",         tags: { surface: "all", domain: "infra",          audience: "machine", auth: "service-binding", tier: 2 } },
  notes:        { binding: "SVC_NOTES",        label: "Notes",              description: "Cross-channel notes + knowledge",      tags: { surface: "all", domain: "knowledge",      audience: "both",    auth: "token",           tier: 4 } },
  notion:       { binding: "SVC_NOTION",       label: "Notion",             description: "Notion workspace ops",                 tags: { surface: "all", domain: "knowledge",      audience: "both",    auth: "token",           tier: 4 } },
  orchestrator: { binding: "SVC_ORCHESTRATOR", label: "Orchestrator",       description: "Skill + agent dispatch",               tags: { surface: "all", domain: "meta",           audience: "both",    auth: "token",           tier: 2 } },
  quo:          { binding: "SVC_QUO",          label: "Quo",                description: "Quo unified messaging",                tags: { surface: "all", domain: "messaging",      audience: "both",    auth: "token",           tier: 4 } },
  resolve:      { binding: "SVC_RESOLVE",      label: "Resolve",            description: "Resolution + escalation",              tags: { surface: "all", domain: "ops",            audience: "machine", auth: "service-binding", tier: 4 } },
  scrape:       { binding: "SVC_SCRAPE",       label: "Scrape",             description: "Web scraping + extraction",            tags: { surface: "all", domain: "ingest",         audience: "machine", auth: "service-binding", tier: 3 } },
  ship:         { binding: "SVC_SHIP",         label: "Ship",               description: "Deploy + branch lifecycle",            tags: { surface: "all", domain: "infra",          audience: "machine", auth: "service-binding", tier: 3 } },
  storage:      { binding: "SVC_STORAGE",      label: "Storage",            description: "Content-addressed document storage",   tags: { surface: "all", domain: "storage",        audience: "machine", auth: "service-binding", tier: 2 } },
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version",
    "Access-Control-Expose-Headers": "mcp-session-id",
  };
}

/** Fail-closed Bearer check. Returns null on success, or a 401/503. */
function requireBearerToken(request: Request, env: Env): Response | null {
  const expected = env.MCP_API_KEY;
  if (!expected) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "MCP_API_KEY not configured on aggregator" } }),
      { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1] !== expected) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized" } }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
  return null;
}

function sseResponse(data: unknown, headers?: Record<string, string>): Response {
  return new Response(`event: message\ndata: ${JSON.stringify(data)}\n\n`, {
    headers: { "Content-Type": "text/event-stream", ...corsHeaders(), ...headers },
  });
}

async function discoverTools(
  service: Fetcher,
  serviceId: string,
): Promise<Array<{ name: string; description: string; inputSchema: unknown }>> {
  try {
    const initResp = await service.fetch(
      new Request("https://internal/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "chittymcp", version: "2.0.0" } },
          id: 1,
        }),
      }),
    );
    const sessionId = initResp.headers.get("mcp-session-id");
    if (!sessionId) return [];

    const listResp = await service.fetch(
      new Request("https://internal/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Mcp-Session-Id": sessionId,
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 2 }),
      }),
    );

    const contentType = listResp.headers.get("content-type") || "";
    let parsed: any;
    if (contentType.includes("text/event-stream")) {
      const text = await listResp.text();
      const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) return [];
      parsed = JSON.parse(dataLine.slice(6));
    } else {
      parsed = await listResp.json();
    }
    const tools = parsed?.result?.tools ?? [];
    return tools.map((t: any) => ({
      ...t,
      name: `${serviceId}/${t.name}`,
      description: `[${serviceId}] ${t.description || t.name}`,
    }));
  } catch (err) {
    console.error(`[ChittyMCP] discover ${serviceId}: ${err}`);
    return [];
  }
}

async function forwardToolCall(
  service: Fetcher,
  toolName: string,
  args: Record<string, unknown>,
  requestId: unknown,
): Promise<Response> {
  const initResp = await service.fetch(
    new Request("https://internal/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "chittymcp", version: "2.0.0" } },
        id: 99,
      }),
    }),
  );
  const sessionId = initResp.headers.get("mcp-session-id");
  if (!sessionId) {
    return sseResponse({
      jsonrpc: "2.0",
      id: requestId,
      error: { code: -32000, message: "Failed to establish backend session" },
    });
  }
  return service.fetch(
    new Request("https://internal/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Mcp-Session-Id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: toolName, arguments: args },
        id: requestId,
      }),
    }),
  );
}

/** Build the /v0.1/servers MCP-spec discovery payload. */
function buildServersIndex(): Record<string, unknown> {
  return {
    servers: Object.entries(SERVICE_MAP).map(([id, s]) => ({
      id,
      name: `chittyagent-${id}`,
      label: s.label,
      description: s.description,
      transport: "streamable-http",
      endpoints: {
        aggregated: `https://mcp.chitty.cc/${id}/mcp`,
        canonical: `https://${id}.chitty.cc/mcp`,
        deployed: `https://${id}.agent.chitty.cc/mcp`,
      },
      tags: s.tags,
    })),
    generated_at: new Date().toISOString(),
    aggregator: "chittymcp",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

    if (request.method === "GET" && path === "/health") {
      return Response.json({
        status: "ok",
        service: "chittymcp",
        version: "2.0.0",
        services: Object.keys(SERVICE_MAP),
        count: Object.keys(SERVICE_MAP).length,
      });
    }

    // MCP-spec discovery. Two paths serve identical content:
    //   /v0.1/servers          — canonical (needs CF Access bypass policy)
    //   /.well-known/chitty.json — already bypassed, works from any client
    if (
      request.method === "GET" &&
      (path === "/v0.1/servers" || path === "/.well-known/chitty.json")
    ) {
      return Response.json(buildServersIndex(), { headers: corsHeaders() });
    }

    if (request.method === "GET" && (path === "/" || path === "")) {
      return Response.json({
        service: "chittymcp",
        description: "ChittyOS MCP Aggregator",
        aggregated: "/mcp",
        discovery: "/v0.1/servers",
        services: Object.fromEntries(
          Object.entries(SERVICE_MAP).map(([id, s]) => [id, { path: `/${id}/mcp`, label: s.label, tags: s.tags }]),
        ),
      });
    }

    // Per-service proxy
    for (const [prefix, svc] of Object.entries(SERVICE_MAP)) {
      if (path === `/${prefix}/mcp` || path.startsWith(`/${prefix}/mcp/`)) {
        const authErr = requireBearerToken(request, env);
        if (authErr) return authErr;
        const service = env[svc.binding] as Fetcher;
        const newUrl = new URL(request.url);
        newUrl.pathname = path.slice(`/${prefix}`.length) || "/";
        return service.fetch(new Request(newUrl.toString(), request));
      }
    }

    // Aggregated MCP
    if ((path === "/mcp" || path.startsWith("/mcp/")) && request.method === "POST") {
      const authErr = requireBearerToken(request, env);
      if (authErr) return authErr;

      let body: any;
      try {
        body = await request.clone().json();
      } catch {
        return sseResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      }

      if (body.method === "initialize") {
        return sseResponse(
          {
            jsonrpc: "2.0",
            id: body.id,
            result: {
              protocolVersion: "2025-03-26",
              capabilities: { tools: { listChanged: true } },
              serverInfo: { name: "chittymcp", version: "2.0.0" },
            },
          },
          { "mcp-session-id": crypto.randomUUID() },
        );
      }

      if (body.method === "tools/list") {
        const results = await Promise.all(
          Object.entries(SERVICE_MAP).map(async ([id, svc]) => discoverTools(env[svc.binding] as Fetcher, id)),
        );
        return sseResponse({ jsonrpc: "2.0", id: body.id, result: { tools: results.flat() } });
      }

      if (body.method === "tools/call") {
        const fullName: string = body.params?.name || "";
        const slash = fullName.indexOf("/");
        if (slash === -1) {
          return sseResponse({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32602, message: "Tool must be namespaced: service/tool" },
          });
        }
        const serviceId = fullName.slice(0, slash);
        const toolName = fullName.slice(slash + 1);
        const svc = SERVICE_MAP[serviceId];
        if (!svc) {
          return sseResponse({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32602, message: `Unknown service: ${serviceId}. Available: ${Object.keys(SERVICE_MAP).join(", ")}` },
          });
        }
        return forwardToolCall(env[svc.binding] as Fetcher, toolName, body.params?.arguments || {}, body.id);
      }

      return sseResponse({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `Method not found: ${body.method}` } });
    }

    return new Response("Not Found", { status: 404 });
  },
};
