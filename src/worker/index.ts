/**
 * ChittyMCP — MCP Aggregator Worker
 *
 * Serves mcp.chitty.cc — collects all ChittyOS service MCP endpoints
 * into one surface via service bindings (no HTTP round-trips).
 *
 *   mcp.chitty.cc/mcp           → aggregated (all tools, namespaced)
 *   mcp.chitty.cc/dispute/mcp   → proxied to chittyagent-dispute
 *   mcp.chitty.cc/notes/mcp     → proxied to chittyagent-notes
 *   etc.
 */

interface Env {
  SVC_DISPUTE: Fetcher;
  SVC_NOTES: Fetcher;
  SVC_SHIP: Fetcher;
  SVC_STORAGE: Fetcher;
  SVC_ROUTER: Fetcher;
  SVC_COMMAND: Fetcher;
  SVC_REGISTRY: Fetcher;
  SVC_CONNECT: Fetcher;
  SVC_CH1TTY: Fetcher;
}

type BindingKey = keyof Env;

interface ServiceEntry {
  binding: BindingKey;
  label: string;
}

const SERVICE_MAP: Record<string, ServiceEntry> = {
  dispute:  { binding: "SVC_DISPUTE",  label: "Dispute Management" },
  notes:    { binding: "SVC_NOTES",    label: "Notes & Knowledge" },
  ship:     { binding: "SVC_SHIP",     label: "Ship & Deploy" },
  storage:  { binding: "SVC_STORAGE",  label: "Document Storage" },
  router:   { binding: "SVC_ROUTER",   label: "Routing & Delivery" },
  command:  { binding: "SVC_COMMAND",  label: "Command & Control" },
  registry: { binding: "SVC_REGISTRY", label: "Service Registry" },
  connect:  { binding: "SVC_CONNECT",  label: "ChittyConnect Spine" },
  ch1tty:   { binding: "SVC_CH1TTY",   label: "Ch1tty Gateway" },
};

// Explicit allowlist for known MCP client origins. Browser-based MCP clients
// (ChatGPT, Claude.ai, MCP Inspector) must be enumerated; non-browser clients
// (Claude Code, mcp-cli, etc.) don't enforce CORS and aren't affected.
const ALLOWED_ORIGINS = new Set<string>([
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://claude.ai",
  "https://www.claude.ai",
  "https://inspector.modelcontextprotocol.io",
]);

function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get("Origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version",
    "Access-Control-Expose-Headers": "mcp-session-id",
    "Vary": "Origin",
  };
}

function sseResponse(data: unknown, headers?: Record<string, string>, request?: Request): Response {
  return new Response(
    `event: message\ndata: ${JSON.stringify(data)}\n\n`,
    { headers: { "Content-Type": "text/event-stream", ...corsHeaders(request), ...headers } },
  );
}

/** Discover tools from a service binding via MCP initialize + tools/list */
async function discoverTools(
  service: Fetcher,
  serviceId: string,
): Promise<Array<{ name: string; description: string; inputSchema: unknown }>> {
  try {
    const initResp = await service.fetch(
      new Request("https://internal/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "chittymcp", version: "1.0.0" },
          },
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
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 2,
        }),
      }),
    );

    // The bound service may reply as either SSE (text/event-stream) or
    // plain JSON-RPC (application/json) — handle both content types.
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

/** Forward a tool call to the right service, stripping the namespace */
async function forwardToolCall(
  service: Fetcher,
  toolName: string,
  args: Record<string, unknown>,
  requestId: unknown,
  request: Request,
): Promise<Response> {
  const initResp = await service.fetch(
    new Request("https://internal/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "chittymcp", version: "1.0.0" },
        },
        id: 99,
      }),
    }),
  );

  const sessionId = initResp.headers.get("mcp-session-id");
  if (!sessionId) {
    return sseResponse(
      {
        jsonrpc: "2.0",
        id: requestId,
        error: { code: -32000, message: "Failed to establish backend session" },
      },
      undefined,
      request,
    );
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    // Health
    if (request.method === "GET" && path === "/health") {
      return Response.json({
        status: "ok",
        service: "chittymcp",
        version: "1.0.0",
        services: Object.keys(SERVICE_MAP),
      });
    }

    // Service index
    if (request.method === "GET" && (path === "/" || path === "")) {
      return Response.json({
        service: "chittymcp",
        description: "ChittyOS MCP Aggregator",
        aggregated: "/mcp",
        services: Object.fromEntries(
          Object.entries(SERVICE_MAP).map(([id, s]) => [id, { path: `/${id}/mcp`, label: s.label }]),
        ),
      });
    }

    // Per-service proxy: /dispute/mcp → SVC_DISPUTE /mcp
    // Auth is enforced by Cloudflare Access at the perimeter (mcp.chitty.cc).
    // Service bindings are internal — no public ingress to upstream workers.
    for (const [prefix, svc] of Object.entries(SERVICE_MAP)) {
      if (path === `/${prefix}/mcp` || path.startsWith(`/${prefix}/mcp/`)) {
        const service = env[svc.binding] as Fetcher;
        const newUrl = new URL(request.url);
        newUrl.pathname = path.slice(`/${prefix}`.length) || "/";
        return service.fetch(new Request(newUrl.toString(), request));
      }
    }

    // Aggregated MCP at /mcp
    // Auth is enforced by Cloudflare Access at the perimeter (mcp.chitty.cc).
    if ((path === "/mcp" || path.startsWith("/mcp/")) && request.method === "POST") {
      let body: any;
      try {
        body = await request.clone().json();
      } catch {
        return sseResponse(
          {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error: request body is not valid JSON" },
          },
          undefined,
          request,
        );
      }

      if (body.method === "initialize") {
        return sseResponse(
          {
            jsonrpc: "2.0",
            id: body.id,
            result: {
              protocolVersion: "2025-03-26",
              capabilities: { tools: { listChanged: true } },
              serverInfo: { name: "chittymcp", version: "1.0.0" },
            },
          },
          { "mcp-session-id": crypto.randomUUID() },
          request,
        );
      }

      if (body.method === "tools/list") {
        const results = await Promise.all(
          Object.entries(SERVICE_MAP).map(async ([id, svc]) => {
            const service = env[svc.binding] as Fetcher;
            return discoverTools(service, id);
          }),
        );
        return sseResponse(
          {
            jsonrpc: "2.0",
            id: body.id,
            result: { tools: results.flat() },
          },
          undefined,
          request,
        );
      }

      if (body.method === "tools/call") {
        const fullName: string = body.params?.name || "";
        const slash = fullName.indexOf("/");
        if (slash === -1) {
          return sseResponse(
            {
              jsonrpc: "2.0",
              id: body.id,
              error: { code: -32602, message: "Tool must be namespaced: service/tool" },
            },
            undefined,
            request,
          );
        }

        const serviceId = fullName.slice(0, slash);
        const toolName = fullName.slice(slash + 1);
        const svc = SERVICE_MAP[serviceId];
        if (!svc) {
          return sseResponse(
            {
              jsonrpc: "2.0",
              id: body.id,
              error: { code: -32602, message: `Unknown service: ${serviceId}. Available: ${Object.keys(SERVICE_MAP).join(", ")}` },
            },
            undefined,
            request,
          );
        }

        return forwardToolCall(
          env[svc.binding] as Fetcher,
          toolName,
          body.params?.arguments || {},
          body.id,
          request,
        );
      }

      return sseResponse(
        {
          jsonrpc: "2.0",
          id: body.id,
          error: { code: -32601, message: `Method not found: ${body.method}` },
        },
        undefined,
        request,
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};
