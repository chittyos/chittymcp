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
  MCP_REGISTRY?: KVNamespace;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CHITTYAUTH_ISSUED_MCP_ADMIN_TOKEN?: string;
  CHITTYREGISTER_POSTURE_URL?: string;
  CHITTYAUTH_ISSUED_REGISTER_TOKEN?: string;
}

type BindingKey = keyof Env;

interface ServiceEntry {
  binding: BindingKey;
  label: string;
}

interface DynamicServiceEntry {
  id: string;
  sub: string;
  binding: BindingKey;
  label: string;
  enabled?: boolean;
  posture?: string;
  trust_score?: number;
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

const MCP_REGISTRY_KEY = "services:v1";

function requireAdmin(request: Request, env: Env): Response | null {
  const expected = env.CHITTYAUTH_ISSUED_MCP_ADMIN_TOKEN;
  if (!expected) {
    return new Response("admin token not configured", { status: 503 });
  }
  const auth = request.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (provided !== expected) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}

function isEligibleByPosture(entry: DynamicServiceEntry): boolean {
  if (entry.enabled === false) return false;
  const posture = (entry.posture || "unknown").toLowerCase();
  const trust = entry.trust_score ?? 0;
  const postureAllowed = posture === "trusted" || posture === "verified" || posture === "certified";
  return postureAllowed || trust >= 70;
}

async function loadActiveServices(env: Env): Promise<Record<string, ServiceEntry>> {
  const fallback = SERVICE_MAP;
  if (!env.MCP_REGISTRY) return fallback;

  try {
    const raw = await env.MCP_REGISTRY.get(MCP_REGISTRY_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as DynamicServiceEntry[];
    const active: Record<string, ServiceEntry> = {};
    for (const entry of parsed) {
      if (!entry?.id || !entry?.sub || !entry?.binding || !entry?.label) continue;
      if (!isEligibleByPosture(entry)) continue;
      active[entry.sub] = { binding: entry.binding, label: entry.label };
    }
    return Object.keys(active).length > 0 ? active : fallback;
  } catch (err) {
    console.error(`[ChittyMCP] Failed to load dynamic service map: ${err}`);
    return fallback;
  }
}

async function fetchPostureRegistry(env: Env): Promise<DynamicServiceEntry[] | null> {
  const url = env.CHITTYREGISTER_POSTURE_URL;
  if (!url) return null;
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.CHITTYAUTH_ISSUED_REGISTER_TOKEN) {
      headers.authorization = `Bearer ${env.CHITTYAUTH_ISSUED_REGISTER_TOKEN}`;
    }
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) return null;
    const payload = await res.json() as { services?: DynamicServiceEntry[] };
    return Array.isArray(payload.services) ? payload.services : null;
  } catch {
    return null;
  }
}

async function syncRegistryFromPosture(env: Env): Promise<{ synced: boolean; count: number }> {
  if (!env.MCP_REGISTRY) return { synced: false, count: 0 };
  const services = await fetchPostureRegistry(env);
  if (!services || services.length === 0) return { synced: false, count: 0 };
  await env.MCP_REGISTRY.put(MCP_REGISTRY_KEY, JSON.stringify(services));
  return { synced: true, count: services.length };
}

async function cfApi<T = unknown>(env: Env, path: string, init?: RequestInit): Promise<T> {
  if (!env.CLOUDFLARE_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN is not configured");
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      ...(init?.headers || {}),
    },
  });
  const payload = await res.json() as { success: boolean; result: T; errors?: Array<{ message: string }> };
  if (!res.ok || !payload.success) {
    throw new Error(payload.errors?.map((e) => e.message).join("; ") || `Cloudflare API failed: ${res.status}`);
  }
  return payload.result;
}

async function reconcileRoutes(env: Env, serviceMap: Record<string, ServiceEntry>) {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  if (!zoneId || !accountId) {
    throw new Error("CLOUDFLARE_ZONE_ID/CLOUDFLARE_ACCOUNT_ID are required");
  }

  const script = "chittymcp";
  const existing = await cfApi<Array<{ id: string; pattern: string; script: string }>>(
    env,
    `/zones/${zoneId}/workers/routes`,
    { method: "GET" },
  );

  const desiredPatterns = new Set<string>(["mcp.chitty.cc/mcp*"]);
  for (const sub of Object.keys(serviceMap)) {
    desiredPatterns.add(`mcp.chitty.cc/${sub}/mcp*`);
  }

  const existingForScript = existing.filter((r) => r.script === script && r.pattern.startsWith("mcp.chitty.cc/"));
  const existingPatterns = new Set(existingForScript.map((r) => r.pattern));

  const created: string[] = [];
  const deleted: string[] = [];

  for (const pattern of desiredPatterns) {
    if (!existingPatterns.has(pattern)) {
      await cfApi(env, `/zones/${zoneId}/workers/routes`, {
        method: "POST",
        body: JSON.stringify({ pattern, script }),
      });
      created.push(pattern);
    }
  }

  for (const route of existingForScript) {
    if (!desiredPatterns.has(route.pattern)) {
      await cfApi(env, `/zones/${zoneId}/workers/routes/${route.id}`, { method: "DELETE" });
      deleted.push(route.pattern);
    }
  }

  return {
    script,
    desiredCount: desiredPatterns.size,
    created,
    deleted,
  };
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, mcp-session-id, mcp-protocol-version",
    "Access-Control-Expose-Headers": "mcp-session-id",
  };
}

function sseResponse(data: unknown, headers?: Record<string, string>): Response {
  return new Response(
    `event: message\ndata: ${JSON.stringify(data)}\n\n`,
    { headers: { "Content-Type": "text/event-stream", ...corsHeaders(), ...headers } },
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

    const text = await listResp.text();
    const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
    if (!dataLine) return [];

    const parsed = JSON.parse(dataLine.slice(6));
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const serviceMap = await loadActiveServices(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
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
          Object.entries(serviceMap).map(([id, s]) => [id, { path: `/${id}/mcp`, label: s.label }]),
        ),
      });
    }

    if (request.method === "GET" && path === "/registry/services") {
      return Response.json({
        service: "chittymcp",
        source: env.MCP_REGISTRY ? "dynamic-or-fallback" : "static",
        services: Object.fromEntries(
          Object.entries(serviceMap).map(([id, s]) => [id, { path: `/${id}/mcp`, label: s.label }]),
        ),
      });
    }

    if (request.method === "POST" && path === "/admin/registry/sync") {
      const deny = requireAdmin(request, env);
      if (deny) return deny;
      const result = await syncRegistryFromPosture(env);
      return Response.json({ ok: true, ...result });
    }

    if (request.method === "POST" && path === "/admin/reconcile/routes") {
      const deny = requireAdmin(request, env);
      if (deny) return deny;
      const result = await reconcileRoutes(env, serviceMap);
      return Response.json({ ok: true, ...result });
    }

    // Per-service proxy: /dispute/mcp → SVC_DISPUTE /mcp
    for (const [prefix, svc] of Object.entries(serviceMap)) {
      if (path === `/${prefix}/mcp` || path.startsWith(`/${prefix}/mcp/`)) {
        const service = env[svc.binding] as Fetcher;
        const newUrl = new URL(request.url);
        newUrl.pathname = path.slice(`/${prefix}`.length) || "/";
        return service.fetch(new Request(newUrl.toString(), request));
      }
    }

    // Aggregated MCP at /mcp
    if ((path === "/mcp" || path.startsWith("/mcp/")) && request.method === "POST") {
      const body = (await request.clone().json()) as any;

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
        );
      }

      if (body.method === "tools/list") {
        const results = await Promise.all(
          Object.entries(serviceMap).map(async ([id, svc]) => {
            const service = env[svc.binding] as Fetcher;
            return discoverTools(service, id);
          }),
        );
        return sseResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: results.flat() },
        });
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
        const svc = serviceMap[serviceId];
        if (!svc) {
          return sseResponse({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32602, message: `Unknown service: ${serviceId}. Available: ${Object.keys(serviceMap).join(", ")}` },
          });
        }

        return forwardToolCall(
          env[svc.binding] as Fetcher,
          toolName,
          body.params?.arguments || {},
          body.id,
        );
      }

      return sseResponse({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32601, message: `Method not found: ${body.method}` },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
