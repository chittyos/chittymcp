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
  SVC_ALCHEMIST: Fetcher;
  SVC_AUTH: Fetcher;
  SVC_AUTOASSIST: Fetcher;
  SVC_BLUEBUBBLES: Fetcher;
  SVC_CANON: Fetcher;
  SVC_CH1TTY: Fetcher;
  SVC_CHATGPT: Fetcher;
  SVC_CLEANER: Fetcher;
  SVC_CLOUDFLARE: Fetcher;
  SVC_DISPATCH: Fetcher;
  SVC_DISPUTE: Fetcher;
  SVC_EVIDENCE: Fetcher;
  SVC_FINANCE: Fetcher;
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
  SVC_SANDBOX: Fetcher;
  SVC_SCRAPE: Fetcher;
  SVC_SHIP: Fetcher;
  SVC_STORAGE: Fetcher;
  SVC_TASKS: Fetcher;
  SVC_TWILIO: Fetcher;
  SVC_VIEWPORT: Fetcher;
  // MCP_API_KEY: shared secret required for /mcp aggregator + /{service}/mcp proxy.
  // Set via `wrangler secret put MCP_API_KEY`.
  MCP_API_KEY?: string;
  MCP_REGISTRY?: KVNamespace;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CHITTYAUTH_ISSUED_MCP_ADMIN_TOKEN?: string;
  CHITTYREGISTER_POSTURE_URL?: string;
  CHITTYAUTH_ISSUED_REGISTER_TOKEN?: string;
  // Cloudflare Access Application Audience tag for mcp.chitty.cc — when
  // present, JWT verification requires this aud claim. Optional but
  // recommended for production.
  CF_ACCESS_AUD?: string;
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
  alchemist:        { binding: "SVC_ALCHEMIST",        label: "Alchemist (telemetry + entity graph)" },
  auth:             { binding: "SVC_AUTH",             label: "ChittyAuth (identity + tokens)" },
  autoassist:       { binding: "SVC_AUTOASSIST",       label: "AutoAssist" },
  bluebubbles:      { binding: "SVC_BLUEBUBBLES",      label: "BlueBubbles bridge" },
  canon:            { binding: "SVC_CANON",            label: "Canon (governance)" },
  ch1tty:           { binding: "SVC_CH1TTY",           label: "Ch1tty Gateway" },
  chatgpt:          { binding: "SVC_CHATGPT",          label: "ChatGPT Bridge" },
  cleaner:          { binding: "SVC_CLEANER",          label: "Cleaner" },
  cloudflare:       { binding: "SVC_CLOUDFLARE",       label: "Cloudflare ops" },
  dispatch:         { binding: "SVC_DISPATCH",         label: "Dispatch" },
  dispute:          { binding: "SVC_DISPUTE",          label: "Dispute Management" },
  evidence:         { binding: "SVC_EVIDENCE",         label: "Evidence Pipeline" },
  finance:          { binding: "SVC_FINANCE",          label: "Finance (Mercury + Neon)" },
  gam:              { binding: "SVC_GAM",              label: "Google Workspace Admin" },
  helper:           { binding: "SVC_HELPER",           label: "Ecosystem Helper" },
  imessage:         { binding: "SVC_IMESSAGE",         label: "iMessage ops" },
  market:           { binding: "SVC_MARKET",           label: "ChittyMarket" },
  neon:             { binding: "SVC_NEON",             label: "Neon Postgres ops" },
  notes:            { binding: "SVC_NOTES",            label: "Notes & Knowledge" },
  notion:           { binding: "SVC_NOTION",           label: "Notion workspace ops" },
  orchestrator:     { binding: "SVC_ORCHESTRATOR",     label: "Orchestrator" },
  quo:              { binding: "SVC_QUO",              label: "Quo unified messaging" },
  resolve:          { binding: "SVC_RESOLVE",          label: "Resolve" },
  sandbox:          { binding: "SVC_SANDBOX",          label: "Code Mode Sandbox" },
  scrape:           { binding: "SVC_SCRAPE",           label: "Scrape" },
  ship:             { binding: "SVC_SHIP",             label: "Ship & Deploy" },
  storage:          { binding: "SVC_STORAGE",          label: "Document Storage" },
  tasks:            { binding: "SVC_TASKS",            label: "Tasks Queue" },
  twilio:           { binding: "SVC_TWILIO",           label: "Twilio bridge" },
  viewport:         { binding: "SVC_VIEWPORT",         label: "Session Viewport" },
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

type PostureFetchResult =
  | { status: "ok"; services: DynamicServiceEntry[] }
  | { status: "not_configured" }
  | { status: "fetch_failed"; error: string };

async function fetchPostureRegistry(env: Env): Promise<PostureFetchResult> {
  const url = env.CHITTYREGISTER_POSTURE_URL;
  if (!url) return { status: "not_configured" };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.CHITTYAUTH_ISSUED_REGISTER_TOKEN) {
    headers.authorization = `Bearer ${env.CHITTYAUTH_ISSUED_REGISTER_TOKEN}`;
  }
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[posture] fetch threw url=${url} err=${msg}`);
    return { status: "fetch_failed", error: `network: ${msg}` };
  }
  if (!res.ok) {
    console.error(`[posture] fetch non-2xx url=${url} status=${res.status}`);
    return { status: "fetch_failed", error: `http ${res.status}` };
  }
  let payload: { services?: DynamicServiceEntry[] };
  try {
    payload = await res.json() as { services?: DynamicServiceEntry[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[posture] non-JSON body url=${url} err=${msg}`);
    return { status: "fetch_failed", error: `parse: ${msg}` };
  }
  if (!Array.isArray(payload.services)) {
    return { status: "fetch_failed", error: "payload.services not an array" };
  }
  return { status: "ok", services: payload.services };
}

type SyncResult =
  | { status: "synced"; count: number }
  | { status: "no_kv" }
  | { status: "fetch_failed"; error: string }
  | { status: "empty" }
  | { status: "kv_write_failed"; count: number; error: string };

async function syncRegistryFromPosture(env: Env): Promise<SyncResult> {
  if (!env.MCP_REGISTRY) return { status: "no_kv" };
  const result = await fetchPostureRegistry(env);
  if (result.status !== "ok") {
    return result.status === "not_configured"
      ? { status: "fetch_failed", error: "CHITTYREGISTER_POSTURE_URL not set" }
      : { status: "fetch_failed", error: result.error };
  }
  if (result.services.length === 0) return { status: "empty" };
  try {
    await env.MCP_REGISTRY.put(MCP_REGISTRY_KEY, JSON.stringify(result.services));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[posture] KV write failed err=${msg}`);
    return { status: "kv_write_failed", count: result.services.length, error: msg };
  }
  return { status: "synced", count: result.services.length };
}

class CfApiError extends Error {
  status: number;
  method: string;
  path: string;
  constructor(message: string, status: number, method: string, path: string) {
    super(message);
    this.name = "CfApiError";
    this.status = status;
    this.method = method;
    this.path = path;
  }
}

async function cfApi<T = unknown>(env: Env, path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new CfApiError("CLOUDFLARE_API_TOKEN is not configured", 0, method, path);
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      ...(init?.headers || {}),
    },
  });
  let payload: { success: boolean; result: T; errors?: Array<{ message: string }> } | null = null;
  try {
    payload = await res.json() as typeof payload;
  } catch {
    // Non-JSON body (CF edge HTML during incidents, gateway errors, etc.)
    throw new CfApiError(`Cloudflare returned non-JSON body (HTTP ${res.status})`, res.status, method, path);
  }
  if (!res.ok || !payload || !payload.success) {
    const msg = payload?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new CfApiError(msg, res.status, method, path);
  }
  return payload.result;
}

interface ReconcileResult {
  ok: boolean;
  script: string;
  desiredCount: number;
  created: string[];
  deleted: string[];
  failed: Array<{ op: "create" | "delete"; pattern: string; error: string }>;
}

async function reconcileRoutes(env: Env, serviceMap: Record<string, ServiceEntry>): Promise<ReconcileResult> {
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
  const failed: ReconcileResult["failed"] = [];

  // Per-iteration try/catch so one failed route doesn't leave the zone half-reconciled
  // without an audit trail. Continue past failures and return a complete envelope.
  for (const pattern of desiredPatterns) {
    if (existingPatterns.has(pattern)) continue;
    try {
      await cfApi(env, `/zones/${zoneId}/workers/routes`, {
        method: "POST",
        body: JSON.stringify({ pattern, script }),
      });
      created.push(pattern);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[reconcile] create failed pattern=${pattern} err=${msg}`);
      failed.push({ op: "create", pattern, error: msg });
    }
  }

  for (const route of existingForScript) {
    if (desiredPatterns.has(route.pattern)) continue;
    try {
      await cfApi(env, `/zones/${zoneId}/workers/routes/${route.id}`, { method: "DELETE" });
      deleted.push(route.pattern);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[reconcile] delete failed pattern=${route.pattern} err=${msg}`);
      failed.push({ op: "delete", pattern: route.pattern, error: msg });
    }
  }

  return {
    ok: failed.length === 0,
    script,
    desiredCount: desiredPatterns.size,
    created,
    deleted,
    failed,
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

/**
 * Fail-closed Bearer token check for MCP surface routes.
 * Returns null on success, or a 401 Response on failure.
 */
// Cache the JWKS in memory per-isolate so verification doesn't fetch on every
// request. Refreshed by jose's createRemoteJWKSet rotation logic.
let cfAccessJwks: ReturnType<typeof import("jose").createRemoteJWKSet> | null = null;
async function verifyCfAccessJwt(token: string, env: Env): Promise<boolean> {
  try {
    const { jwtVerify, createRemoteJWKSet } = await import("jose");
    if (!cfAccessJwks) {
      cfAccessJwks = createRemoteJWKSet(new URL("https://chittycorp.cloudflareaccess.com/cdn-cgi/access/certs"));
    }
    // Verify signature + issuer only. CF Access OAuth issues tokens whose
    // `aud` claim is the DCR-registered client_id (e.g. Claude.ai's
    // registration), NOT the mcp-type app's AUD. Enforcing CF_ACCESS_AUD
    // here would falsely reject all OAuth-flow Bearer tokens from clients
    // like Claude.ai's MCP connector. The mcp-type app's policy gate at
    // CF Access already enforces app-level authorization upstream.
    await jwtVerify(token, cfAccessJwks, { issuer: "https://chittycorp.cloudflareaccess.com" });
    // CF_ACCESS_AUD intentionally NOT enforced — see comment above.
    void env;
    return true;
  } catch {
    return false;
  }
}

async function requireBearerTokenAsync(request: Request, env: Env): Promise<Response | null> {
  const reqUrl = new URL(request.url).pathname;
  const cfJwt = request.headers.get("Cf-Access-Jwt-Assertion");
  const authHeader = request.headers.get("Authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearer = m?.[1];
  const bearerKind = bearer ? (bearer.split(".").length === 3 ? "jwt" : "opaque") : "none";
  const ua = request.headers.get("user-agent") || "";

  if (cfJwt) {
    console.log(`[auth] ${reqUrl} accepted=cf-access-header ua=${ua.slice(0, 60)}`);
    return null;
  }

  // CF Access service token headers — /mcp is bypassed in CF Access so the
  // edge doesn't validate them. Worker proxies the headers to CF Access
  // get-identity, which accepts service tokens via the same headers and
  // returns 200 with the bearer identity if valid.
  const svcId = request.headers.get("CF-Access-Client-Id");
  const svcSecret = request.headers.get("CF-Access-Client-Secret");
  if (svcId && svcSecret) {
    try {
      // Validate by HEAD'ing a CF-Access-gated path on the same domain with
      // the same headers. If CF Access at the edge accepts the service
      // token, response is 200; if invalid, 401/403. We choose /admin/ping
      // which is a path NOT in any bypass app — CF Access fully gates it
      // — so its 200 vs 401 is a clean signal of token validity. (We never
      // implement /admin/ping in the worker; CF Access returns 404 with
      // our worker as origin AFTER it validates, which still proves the
      // token is valid because we only see 401 when CF Access rejects.)
      const r = await fetch("https://mcp.chitty.cc/admin/cf-validate-svc-token", {
        method: "HEAD",
        headers: { "CF-Access-Client-Id": svcId, "CF-Access-Client-Secret": svcSecret },
        redirect: "manual",
      });
      // CF Access rejects with 401/302. Anything else (200, 404, etc) means
      // the request passed CF Access and reached the worker (or beyond).
      if (r.status !== 401 && r.status !== 302 && r.status !== 403) {
        console.log(`[auth] ${reqUrl} accepted=cf-access-service-token ua=${ua.slice(0, 60)}`);
        return null;
      }
      console.log(`[auth] ${reqUrl} REJECTED svc-token-${r.status} ua=${ua.slice(0, 60)}`);
    } catch (e) {
      console.log(`[auth] ${reqUrl} REJECTED svc-token-err ua=${ua.slice(0, 60)}`);
    }
  }

  if (bearer && env.MCP_API_KEY && bearer === env.MCP_API_KEY) {
    console.log(`[auth] ${reqUrl} accepted=mcp-api-key ua=${ua.slice(0, 60)}`);
    return null;
  }

  if (bearer && bearer.split(".").length === 3) {
    if (await verifyCfAccessJwt(bearer, env)) {
      console.log(`[auth] ${reqUrl} accepted=cf-access-jwt ua=${ua.slice(0, 60)}`);
      return null;
    }
    console.log(`[auth] ${reqUrl} REJECTED jwt-verify-failed bearer_kind=${bearerKind} ua=${ua.slice(0, 60)}`);
  } else if (bearer && bearer.startsWith("oauth:")) {
    // CF Access OAuth opaque token. CF Access edge validates the Bearer
    // when a request hits a CF-Access-gated path. We HEAD a path that's
    // gated by the mcp-type Access app (NOT in any bypass app) using the
    // same Bearer. CF Access accepts opaque OAuth tokens issued by its
    // OAuth flow as valid bearer auth for the Access app whose AUD they
    // were issued for. Response 401/403/302 = invalid; anything else =
    // CF Access accepted and forwarded (worker returns 404 because no
    // route, but the validation signal is "did CF Access let it through").
    try {
      const r = await fetch("https://mcp.chitty.cc/admin/cf-validate-bearer", {
        method: "HEAD",
        headers: { authorization: `Bearer ${bearer}` },
        redirect: "manual",
      });
      if (r.status !== 401 && r.status !== 403 && r.status !== 302) {
        console.log(`[auth] ${reqUrl} accepted=cf-access-oauth-opaque ua=${ua.slice(0, 60)}`);
        return null;
      }
      console.log(`[auth] ${reqUrl} REJECTED oauth-opaque-cf-${r.status} ua=${ua.slice(0, 60)}`);
    } catch (e) {
      console.log(`[auth] ${reqUrl} REJECTED oauth-opaque-err ua=${ua.slice(0, 60)}`);
    }
  } else {
    console.log(`[auth] ${reqUrl} REJECTED no-auth bearer_kind=${bearerKind} cf_jwt=${!!cfJwt} ua=${ua.slice(0, 60)}`);
  }

  // RFC 6750 + RFC 9728: signal the protected-resource metadata location.
  const wwwAuth =
    'Bearer realm="chittymcp", error="invalid_token", ' +
    'error_description="Missing or invalid access token", ' +
    'resource_metadata="https://mcp.chitty.cc/.well-known/oauth-protected-resource"';
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized" } }),
    {
      status: 401,
      headers: { "Content-Type": "application/json", "WWW-Authenticate": wwwAuth, ...corsHeaders() },
    },
  );
}

function requireBearerToken(request: Request, env: Env): Response | null {
  // Path A — Cloudflare Access already validated the user upstream. The
  // Cf-Access-Jwt-Assertion header is injected only by CF Access after a
  // successful policy match, and the worker route is configured behind that
  // Access app. Treat its presence as proof of OAuth-authenticated access.
  if (request.headers.get("Cf-Access-Jwt-Assertion")) {
    return null;
  }
  const expected = env.MCP_API_KEY;
  if (!expected) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "MCP_API_KEY not configured on aggregator" },
      }),
      { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1] !== expected) {
    // RFC 6750 + RFC 9728: signal the protected-resource metadata location so
    // the MCP client can begin the OAuth dance instead of failing opaquely.
    const wwwAuth =
      'Bearer realm="chittymcp", error="invalid_token", ' +
      'error_description="Missing or invalid access token", ' +
      'resource_metadata="https://mcp.chitty.cc/.well-known/oauth-protected-resource"';
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "unauthorized" },
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": wwwAuth,
          ...corsHeaders(),
        },
      },
    );
  }
  return null;
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

    // Cheap branches first — these don't need the dynamic service map and
    // shouldn't pay a KV read per request.
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method === "GET" && path === "/health") {
      return Response.json({
        status: "ok",
        service: "chittymcp",
        version: "2.0.0",
        services: Object.keys(SERVICE_MAP),
        count: Object.keys(SERVICE_MAP).length,
      }, { headers: corsHeaders() });
    }

    // Public discovery + OAuth metadata — MUST be reachable without auth so
    // MCP clients can discover where to authenticate.
    if (request.method === "GET" && (path === "/v0.1/servers" || path === "/.well-known/chitty.json")) {
      return Response.json({
        servers: Object.entries(SERVICE_MAP).map(([id, s]) => ({
          id,
          name: `chittyagent-${id}`,
          label: s.label,
          transport: "streamable-http",
          endpoints: {
            aggregated: `https://mcp.chitty.cc/${id}/mcp`,
            canonical: `https://${id}.chitty.cc/mcp`,
          },
        })),
        generated_at: new Date().toISOString(),
        aggregator: "chittymcp",
        count: Object.keys(SERVICE_MAP).length,
      }, { headers: corsHeaders() });
    }

    // OAuth 2.0 Protected Resource metadata (RFC 9728). Empirically the
    // mcp-type Application at mcp.chitty.cc does NOT publish per-app DCR at
    // /register (it returns 401 with the current policy set). The team-level
    // OAuth server at chittycorp.cloudflareaccess.com DOES support public DCR.
    // Per-app OAuth Provider — matches mcp.ch1tty.com pattern. Worker hosts
    // OAuth endpoints at the resource hostname (https://mcp.chitty.cc/*) and
    // proxies the actual handshake to Cloudflare Access OAuth. MCP clients
    // (Claude.ai, ChatGPT) that require AS-equals-resource binding then
    // accept this server.
    const TEAM = "https://chittycorp.cloudflareaccess.com";
    const SELF = "https://mcp.chitty.cc";

    if (request.method === "GET" && path === "/.well-known/oauth-protected-resource") {
      return Response.json({
        resource: SELF,
        authorization_servers: [SELF],
        bearer_methods_supported: ["header"],
        resource_documentation: "https://github.com/CHITTYOS/chittymcp/blob/main/docs/MCP-SOP.md",
      }, { headers: corsHeaders() });
    }

    if (request.method === "GET" && path === "/.well-known/oauth-authorization-server") {
      // Spec-compliant AS metadata advertising worker-hosted endpoints.
      return Response.json({
        issuer: SELF,
        authorization_endpoint: `${SELF}/authorize`,
        token_endpoint: `${SELF}/token`,
        registration_endpoint: `${SELF}/register`,
        revocation_endpoint: `${SELF}/token`,
        response_types_supported: ["code"],
        response_modes_supported: ["query"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: ["mcp:read", "mcp:invoke"],
      }, { headers: corsHeaders() });
    }

    // DCR proxy — forward client registration to CF Access team domain, but
    // present it as our endpoint. Critical for Claude.ai / ChatGPT which
    // require AS-equals-resource and use DCR.
    if (request.method === "POST" && path === "/register") {
      try {
        const body = await request.text();
        const upstream = await fetch(`${TEAM}/cdn-cgi/access/oauth/registration`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        const text = await upstream.text();
        // Rewrite registration_client_uri to our domain so clients re-use the proxy.
        const rewritten = text.replace(
          `${TEAM}/cdn-cgi/access/oauth/registration`,
          `${SELF}/register`,
        );
        return new Response(rewritten, {
          status: upstream.status,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      } catch (err) {
        return Response.json({ error: "upstream_unreachable", detail: String(err).slice(0, 200) }, { status: 502, headers: corsHeaders() });
      }
    }

    // Authorization endpoint — 302 to CF Access's authorization endpoint
    // preserving all query params. CF Access handles the user consent UI.
    if (request.method === "GET" && path === "/authorize") {
      const qs = url.search;
      return Response.redirect(`${TEAM}/cdn-cgi/access/oauth/authorization${qs}`, 302);
    }

    // Token endpoint — proxy POST body to CF Access. Also handles revocation
    // since we advertise the same URL for both.
    if (request.method === "POST" && path === "/token") {
      try {
        const body = await request.text();
        const headers: Record<string, string> = { "content-type": request.headers.get("content-type") || "application/x-www-form-urlencoded" };
        const auth = request.headers.get("authorization");
        if (auth) headers.authorization = auth;
        const upstream = await fetch(`${TEAM}/cdn-cgi/access/oauth/token`, {
          method: "POST",
          headers,
          body,
        });
        const text = await upstream.text();
        return new Response(text, {
          status: upstream.status,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      } catch (err) {
        return Response.json({ error: "upstream_unreachable", detail: String(err).slice(0, 200) }, { status: 502, headers: corsHeaders() });
      }
    }

    // Everything below depends on the active (posture-filtered) service map.
    const serviceMap = await loadActiveServices(env);

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

    // Admin-gated: leaks internal binding topology. Behind CHITTYAUTH_ISSUED_MCP_ADMIN_TOKEN.
    if (request.method === "GET" && path === "/registry/services") {
      const deny = requireAdmin(request, env);
      if (deny) return deny;
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
      const ok = result.status === "synced";
      const status = ok ? 200 : 502;
      return Response.json({ ok, ...result }, { status });
    }

    if (request.method === "POST" && path === "/admin/reconcile/routes") {
      const deny = requireAdmin(request, env);
      if (deny) return deny;
      const result = await reconcileRoutes(env, serviceMap);
      // 207-style partial success → 502 if any route failed, 200 if clean.
      return Response.json(result, { status: result.ok ? 200 : 502 });
    }

    // Per-service proxy: /dispute/mcp → SVC_DISPUTE /mcp (auth-gated, dynamic serviceMap)
    for (const [prefix, svc] of Object.entries(serviceMap)) {
      if (path === `/${prefix}/mcp` || path.startsWith(`/${prefix}/mcp/`)) {
        const authErr = await requireBearerTokenAsync(request, env);
        if (authErr) return authErr;
        const service = env[svc.binding] as Fetcher;
        const newUrl = new URL(request.url);
        newUrl.pathname = path.slice(`/${prefix}`.length) || "/";
        return service.fetch(new Request(newUrl.toString(), request));
      }
    }

    // Aggregated MCP at /mcp (auth-gated)
    if ((path === "/mcp" || path.startsWith("/mcp/")) && request.method === "POST") {
      const authErr = await requireBearerTokenAsync(request, env);
      if (authErr) return authErr;

      let body: any;
      try {
        body = await request.clone().json();
      } catch {
        return sseResponse({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error: request body is not valid JSON" },
        });
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
        );
      }

      if (body.method === "tools/list") {
        // MCP-spec cursor pagination. Some MCP clients (Claude.ai connector
        // portal as of 2026-05) reject a tools[] array longer than 20.
        // Default page size 20; clients can pass cursor= to walk pages.
        const PAGE_SIZE = 20;
        const allTools = (await Promise.all(
          Object.entries(serviceMap).map(async ([id, svc]) => {
            const service = env[svc.binding] as Fetcher;
            return discoverTools(service, id);
          }),
        )).flat();
        const cursor = typeof body.params?.cursor === "string" ? body.params.cursor : null;
        const startIdx = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
        const slice = allTools.slice(startIdx, startIdx + PAGE_SIZE);
        const endIdx = startIdx + slice.length;
        const nextCursor = endIdx < allTools.length ? String(endIdx) : undefined;
        const result: Record<string, unknown> = { tools: slice };
        if (nextCursor) result.nextCursor = nextCursor;
        return sseResponse({
          jsonrpc: "2.0",
          id: body.id,
          result,
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
