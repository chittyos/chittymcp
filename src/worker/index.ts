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
  SVC_AI: Fetcher;
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
  SVC_BINDINGS: Fetcher;
  // MCP_API_KEY: shared secret required for /mcp aggregator + /{service}/mcp proxy.
  // Set via `wrangler secret put MCP_API_KEY`.
  MCP_API_KEY?: string;
  // Comma-separated allowlist of CF Access service-token client IDs permitted
  // to reach the MCP surface. Set via `wrangler secret put MCP_ALLOWED_ACCESS_CLIENT_IDS`.
  MCP_ALLOWED_ACCESS_CLIENT_IDS?: string;
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
  // Inbound auth for POST /admin/bind — beacons from chittyagent-* workers
  // present this Bearer to request an auto-bind PR. Set via
  // `wrangler secret put BIND_BEACON_TOKEN`.
  BIND_BEACON_TOKEN?: string;
  // GitHub PAT used to open the auto-bind PR against CHITTYOS/chittymcp.
  // Needs `repo` scope. Set via `wrangler secret put BIND_GH_TOKEN`.
  BIND_GH_TOKEN?: string;
  // Optional: GitHub App credentials path is detected but currently
  // returns not_implemented — PAT path is the supported flow.
  BIND_GH_APP_ID?: string;
  BIND_GH_APP_PRIVATE_KEY?: string;
  BIND_GH_APP_INSTALLATION_ID?: string;
  // Override the target repo for the auto-bind PR (default CHITTYOS/chittymcp).
  BIND_GH_REPO?: string;
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
  ai:               { binding: "SVC_AI",               label: "AI Gateway (chittyclaw)" },
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
  bindings:         { binding: "SVC_BINDINGS",         label: "Service-binding reconciler" },
};

const MCP_REGISTRY_KEY = "services:v1";

// Allowlist of CF Access service-token client IDs permitted to reach the MCP
// surface. CF Access service tokens are (client_id, secret) pairs; the secret
// is 64 chars of unguessable cryptographic material. We trust a request whose
// client_id is on this operator-managed allowlist AND that presents a secret
// (the secret's unguessability is the actual auth factor; the allowlist scopes
// WHICH issued tokens may use this surface). Set as a wrangler secret,
// comma-separated. This replaces the previous self-referential HEAD-probe to
// mcp.chitty.cc, which looped a subrequest back into this same worker and
// stalled the MCP session with zero bytes until the client timed out.
function allowedAccessClientIds(env: Env): Set<string> {
  return new Set(
    (env.MCP_ALLOWED_ACCESS_CLIENT_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

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
  // edge doesn't validate them. Validate against an operator-managed
  // allowlist of permitted client IDs (no network call). The previous
  // implementation HEAD-probed mcp.chitty.cc/admin/* to ask CF Access — but
  // that route is served by THIS worker, so the subrequest looped back into
  // itself and Cloudflare stalled it, hanging the MCP session with zero bytes
  // until the client timed out. CF Access's team-domain get-identity endpoint
  // does NOT accept raw service-token headers (returns 400 "no app token
  // set"), so an allowlist is the correct, deterministic, stall-free check.
  const svcId = request.headers.get("CF-Access-Client-Id");
  const svcSecret = request.headers.get("CF-Access-Client-Secret");
  if (svcId && svcSecret) {
    const allowed = allowedAccessClientIds(env);
    if (allowed.size === 0) {
      console.log(`[auth] ${reqUrl} REJECTED svc-token-no-allowlist ua=${ua.slice(0, 60)}`);
    } else if (allowed.has(svcId)) {
      console.log(`[auth] ${reqUrl} accepted=cf-access-service-token ua=${ua.slice(0, 60)}`);
      return null;
    } else {
      console.log(`[auth] ${reqUrl} REJECTED svc-token-not-allowed ua=${ua.slice(0, 60)}`);
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
    // Custom 'oauth:'-prefixed opaque bearer. The previous implementation
    // validated this by HEAD-probing mcp.chitty.cc/admin/* — the same
    // self-referential subrequest loop that stalled the service-token branch.
    // No real ChittyOS caller sends an 'oauth:'-prefixed bearer (legitimate
    // CF Access OAuth flows return JWT-form bearers, handled by the JWT verify
    // path above), so this branch fails CLOSED fast rather than hanging the
    // session. If an opaque-OAuth path is reintroduced, validate it without a
    // subrequest to this worker's own hostname.
    console.log(`[auth] ${reqUrl} REJECTED oauth-opaque-unsupported ua=${ua.slice(0, 60)}`);
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

// Per-isolate index: exposed tool name → serviceId. Populated during
// tools/list, read during tools/call. MCP clients always list before call
// within a session, and Cloudflare keeps the isolate warm, so this is
// reliable; a prefix-match fallback covers cold-isolate edge cases.
const TOOL_ROUTE_INDEX = new Map<string, string>();
// Same pattern for prompts (name → serviceId) and resources (uri → serviceId).
// Populated during prompts/list and resources/list respectively. Pass-through
// naming, consistent with the post-#104 tools convention.
const PROMPT_ROUTE_INDEX = new Map<string, string>();
const RESOURCE_ROUTE_INDEX = new Map<string, string>();

/** Resolve a tool name to its serviceId: index first, then prefix match. */
function resolveToolService(
  toolName: string,
  serviceMap: Record<string, { binding: BindingKey; label: string }>,
): string | null {
  const cached = TOOL_ROUTE_INDEX.get(toolName);
  if (cached && serviceMap[cached]) return cached;
  // Fallback: longest underscored-service-id prefix match.
  let best: string | null = null;
  for (const id of Object.keys(serviceMap)) {
    const p = id.replace(/-/g, "_");
    if (toolName === p || toolName.startsWith(p + "_")) {
      if (!best || p.length > best.replace(/-/g, "_").length) best = id;
    }
  }
  return best;
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
    // Pure pass-through: expose each tool by its real upstream name. Tool
    // names across all services are globally unique (verified — zero
    // collisions), so no namespace prefix is needed. This keeps names
    // regex-valid for Claude/ChatGPT (^[a-zA-Z0-9_-]+$, no "/") and avoids
    // the redundant "alchemist/alchemist_*" the slash-namespace produced.
    // Populate the route index so tools/call can map name → service.
    for (const t of tools) {
      if (t?.name) TOOL_ROUTE_INDEX.set(t.name, serviceId);
    }
    return tools;
  } catch (err) {
    console.error(`[ChittyMCP] discover ${serviceId}: ${err}`);
    return [];
  }
}

/**
 * Generic per-service MCP list call.
 *
 * Discovers items from a bound service for an MCP list-style method
 * (`prompts/list`, `resources/list`, ...). Tolerates upstreams that don't
 * implement the method — a `-32601 Method not found` becomes an empty list
 * so one missing upstream cannot nuke the aggregate response.
 *
 * Returns the raw item array (or [] on error/missing) — caller decides how
 * to index/namespace.
 */
async function discoverMcpItems(
  service: Fetcher,
  serviceId: string,
  method: "prompts/list" | "resources/list",
  resultKey: "prompts" | "resources",
): Promise<unknown[]> {
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
            capabilities: { prompts: {}, resources: {} },
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
          method,
          id: 2,
        }),
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
    // -32601 Method not found is expected for services that don't yet
    // expose prompts/resources — treat as empty, not error.
    if (parsed?.error?.code === -32601) return [];
    const items = parsed?.result?.[resultKey];
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.error(`[ChittyMCP] discover ${method} ${serviceId}: ${err}`);
    return [];
  }
}

async function discoverPrompts(
  service: Fetcher,
  serviceId: string,
): Promise<unknown[]> {
  const items = await discoverMcpItems(service, serviceId, "prompts/list", "prompts");
  for (const p of items) {
    const name = (p as { name?: string })?.name;
    if (name) PROMPT_ROUTE_INDEX.set(name, serviceId);
  }
  return items;
}

async function discoverResources(
  service: Fetcher,
  serviceId: string,
): Promise<unknown[]> {
  const items = await discoverMcpItems(service, serviceId, "resources/list", "resources");
  for (const r of items) {
    const uri = (r as { uri?: string })?.uri;
    if (uri) RESOURCE_ROUTE_INDEX.set(uri, serviceId);
  }
  return items;
}

/** Forward a generic JSON-RPC method to a bound service. */
async function forwardMcpCall(
  service: Fetcher,
  method: string,
  params: unknown,
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
        method,
        params,
        id: requestId,
      }),
    }),
  );
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

// ─────────────────────────────────────────────────────────────────────────────
// Auto-bind beacon (POST /admin/bind)
//
// chittyagent-<name> workers POST here after a successful deploy. The handler
// opens a PR against CHITTYOS/chittymcp adding the SVC_<NAME> service binding
// (wrangler.jsonc) and the SERVICE_MAP / Env entries (src/worker/index.ts).
// No mocks — real GitHub REST calls via BIND_GH_TOKEN. Fails closed on any
// upstream error.
// ─────────────────────────────────────────────────────────────────────────────

interface BindBeaconPayload {
  service: string;
  url: string;
  deploy_id?: string;
  commit_sha?: string;
}

const SERVICE_NAME_RE = /^chittyagent-[a-z][a-z0-9-]*$/;

function ghHeaders(token: string): Record<string, string> {
  return {
    "authorization": `Bearer ${token}`,
    "accept": "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "chittymcp-auto-bind/1.0",
    "content-type": "application/json",
  };
}

async function ghFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: any; text: string }> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...ghHeaders(token), ...(init?.headers || {}) },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  return { status: res.status, body, text };
}

/**
 * Insert `<binding>: Fetcher;` into the Env interface after the last
 * `SVC_*: Fetcher;` line, preserving the surrounding 2-space indent.
 */
function patchWorkerIndex(source: string, sub: string, bindingName: string, label: string): string {
  // Insert into Env interface — find last `  SVC_*: Fetcher;` line.
  const envRegex = /(  SVC_[A-Z0-9_]+: Fetcher;\n)(?![\s\S]*  SVC_[A-Z0-9_]+: Fetcher;\n)/;
  const envInsert = `  ${bindingName}: Fetcher;\n`;
  let patched = source.replace(envRegex, (m) => m + envInsert);
  if (patched === source) {
    throw new Error("patchWorkerIndex: could not locate last SVC_* line in Env interface");
  }

  // Insert into SERVICE_MAP — find the closing `};` of `const SERVICE_MAP: ... = {`.
  // Match the block start and capture up to the closing brace.
  const mapStart = patched.indexOf("const SERVICE_MAP: Record<string, ServiceEntry> = {");
  if (mapStart === -1) throw new Error("patchWorkerIndex: SERVICE_MAP not found");
  // Find the matching `};` that closes that object literal.
  const mapEnd = patched.indexOf("\n};", mapStart);
  if (mapEnd === -1) throw new Error("patchWorkerIndex: SERVICE_MAP close not found");
  const entry = `  ${sub.padEnd(17)} { binding: "${bindingName}",${" ".repeat(Math.max(1, 21 - bindingName.length))}label: ${JSON.stringify(label)} },\n`;
  patched = patched.slice(0, mapEnd + 1) + entry + patched.slice(mapEnd + 1);

  // Re-key the entry with proper "key:" form. The padEnd above gave us
  // "<sub>             " — append a colon at the right spot.
  // Simpler: rebuild the inserted line cleanly.
  const cleanEntry = `  ${sub}: { binding: "${bindingName}", label: ${JSON.stringify(label)} },\n`;
  patched = patched.replace(entry, cleanEntry);

  return patched;
}

/**
 * Insert a service-binding entry into wrangler.jsonc preserving JSONC comments.
 * Inserts before the closing `]` of the top-level `"services"` array.
 */
function patchWranglerJsonc(source: string, sub: string, bindingName: string): string {
  const servicesIdx = source.indexOf('"services":');
  if (servicesIdx === -1) throw new Error("patchWranglerJsonc: services key not found");
  const openIdx = source.indexOf("[", servicesIdx);
  if (openIdx === -1) throw new Error("patchWranglerJsonc: services [ not found");
  // Walk to matching closing bracket (no nested arrays in this section, but be safe).
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < source.length; i++) {
    const c = source[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) { closeIdx = i; break; }
    }
  }
  if (closeIdx === -1) throw new Error("patchWranglerJsonc: services ] not found");
  // Find the last non-whitespace character before closeIdx; if it's `,` we
  // can just append. If it's `}`, we need to add a comma to the prior line.
  let j = closeIdx - 1;
  while (j > openIdx && /\s/.test(source[j])) j--;
  const trailingChar = source[j];
  const entry = `    { "binding": "${bindingName}", "service": "chittyagent-${sub}" }`;
  let insertion: string;
  let insertAt: number;
  if (trailingChar === ",") {
    insertion = `\n${entry}\n  `;
    insertAt = j + 1;
  } else if (trailingChar === "}") {
    // Add comma after the prior entry, then our entry.
    insertion = `,\n${entry}\n  `;
    insertAt = j + 1;
  } else if (trailingChar === "[") {
    // Empty services array.
    insertion = `\n${entry}\n  `;
    insertAt = j + 1;
  } else {
    throw new Error(`patchWranglerJsonc: unexpected trailing char ${trailingChar}`);
  }
  return source.slice(0, insertAt) + insertion + source.slice(insertAt);
}

function subFromService(service: string): string {
  return service.replace(/^chittyagent-/, "");
}

function bindingNameFromSub(sub: string): string {
  return "SVC_" + sub.replace(/-/g, "_").toUpperCase();
}

async function handleAdminBind(request: Request, env: Env): Promise<Response> {
  // Auth — Bearer must match BIND_BEACON_TOKEN.
  if (!env.BIND_BEACON_TOKEN) {
    return Response.json({ error: "bind_beacon_not_configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1] !== env.BIND_BEACON_TOKEN) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse + validate.
  let payload: BindBeaconPayload;
  try {
    payload = await request.json() as BindBeaconPayload;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!payload?.service || !payload?.url) {
    return Response.json({ error: "missing_fields", required: ["service", "url"] }, { status: 400 });
  }
  if (!SERVICE_NAME_RE.test(payload.service)) {
    return Response.json({ error: "invalid_service_name", service: payload.service }, { status: 400 });
  }
  let parsedUrl: URL;
  try { parsedUrl = new URL(payload.url); } catch {
    return Response.json({ error: "invalid_url" }, { status: 400 });
  }
  if (!parsedUrl.hostname.endsWith(".chitty.cc")) {
    return Response.json({ error: "url_not_chitty_cc", hostname: parsedUrl.hostname }, { status: 400 });
  }

  const sub = subFromService(payload.service);
  const bindingName = bindingNameFromSub(sub);

  // Idempotency check #1 — already in the in-memory SERVICE_MAP.
  if (SERVICE_MAP[sub]) {
    return Response.json({ status: "already_bound", reason: "service_map", sub, binding: bindingName });
  }

  // GitHub App path detected but not implemented — fail loud rather than silent.
  if (env.BIND_GH_APP_ID || env.BIND_GH_APP_PRIVATE_KEY || env.BIND_GH_APP_INSTALLATION_ID) {
    if (!env.BIND_GH_TOKEN) {
      return Response.json(
        { error: "gh_app_not_implemented", hint: "configure BIND_GH_TOKEN (PAT) for now" },
        { status: 501 },
      );
    }
  }
  if (!env.BIND_GH_TOKEN) {
    return Response.json({ error: "bind_gh_token_not_configured" }, { status: 503 });
  }
  const token = env.BIND_GH_TOKEN;
  const repo = env.BIND_GH_REPO || "CHITTYOS/chittymcp";
  const branchName = `bot/bind-${sub}`;

  // Idempotency check #2 — open PR or branch already exists.
  const existingBranch = await ghFetch(token, `/repos/${repo}/branches/${encodeURIComponent(branchName)}`);
  if (existingBranch.status === 200) {
    // Look up open PR from that branch.
    const owner = repo.split("/")[0];
    const prs = await ghFetch(token, `/repos/${repo}/pulls?state=open&head=${owner}:${encodeURIComponent(branchName)}`);
    const existingPr = Array.isArray(prs.body) && prs.body[0];
    if (existingPr) {
      return Response.json({
        status: "already_bound",
        reason: "open_pr_exists",
        pr_url: existingPr.html_url,
        pr_number: existingPr.number,
      });
    }
    return Response.json({
      status: "already_bound",
      reason: "branch_exists",
      branch: branchName,
    });
  }
  if (existingBranch.status !== 404) {
    return Response.json(
      { error: "github_branch_lookup_failed", status: existingBranch.status, detail: existingBranch.text.slice(0, 500) },
      { status: 502 },
    );
  }

  // Fetch main SHA.
  const mainRef = await ghFetch(token, `/repos/${repo}/git/ref/heads/main`);
  if (mainRef.status !== 200 || !mainRef.body?.object?.sha) {
    return Response.json(
      { error: "github_main_ref_failed", status: mainRef.status, detail: mainRef.text.slice(0, 500) },
      { status: 502 },
    );
  }
  const mainSha: string = mainRef.body.object.sha;

  // Fetch the two files we're going to mutate.
  const wranglerPath = "wrangler.jsonc";
  const indexPath = "src/worker/index.ts";
  const wranglerFile = await ghFetch(token, `/repos/${repo}/contents/${wranglerPath}?ref=main`);
  if (wranglerFile.status !== 200 || !wranglerFile.body?.content) {
    return Response.json(
      { error: "github_get_wrangler_failed", status: wranglerFile.status, detail: wranglerFile.text.slice(0, 500) },
      { status: 502 },
    );
  }
  const indexFile = await ghFetch(token, `/repos/${repo}/contents/${indexPath}?ref=main`);
  if (indexFile.status !== 200 || !indexFile.body?.content) {
    return Response.json(
      { error: "github_get_index_failed", status: indexFile.status, detail: indexFile.text.slice(0, 500) },
      { status: 502 },
    );
  }

  const decode = (b64: string) => {
    // Workers atob returns Latin1; decode as UTF-8 via TextDecoder.
    const bin = atob(b64.replace(/\n/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  };
  const encode = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  };

  const wranglerSrc = decode(wranglerFile.body.content);
  const indexSrc = decode(indexFile.body.content);

  // Idempotency check #3 — already present in main's wrangler.jsonc.
  if (wranglerSrc.includes(`"service": "${payload.service}"`)) {
    return Response.json({ status: "already_bound", reason: "wrangler_already_lists" });
  }

  let nextWrangler: string;
  let nextIndex: string;
  try {
    nextWrangler = patchWranglerJsonc(wranglerSrc, sub, bindingName);
    const labelTitle = sub.charAt(0).toUpperCase() + sub.slice(1);
    nextIndex = patchWorkerIndex(indexSrc, sub, bindingName, `${labelTitle} (auto-bound)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "patch_failed", detail: msg }, { status: 500 });
  }

  // Create branch.
  const createRef = await ghFetch(token, `/repos/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
  });
  if (createRef.status !== 201) {
    return Response.json(
      { error: "github_create_branch_failed", status: createRef.status, detail: createRef.text.slice(0, 500) },
      { status: 502 },
    );
  }

  const commitMsg = (file: string) =>
    `feat(aggregator): auto-bind ${payload.service} (${file})\n\nbeacon: ${payload.url}\ndeploy_id: ${payload.deploy_id || "n/a"}\ncommit_sha: ${payload.commit_sha || "n/a"}`;

  const putWrangler = await ghFetch(token, `/repos/${repo}/contents/${wranglerPath}`, {
    method: "PUT",
    body: JSON.stringify({
      message: commitMsg(wranglerPath),
      content: encode(nextWrangler),
      sha: wranglerFile.body.sha,
      branch: branchName,
    }),
  });
  if (putWrangler.status !== 200 && putWrangler.status !== 201) {
    return Response.json(
      { error: "github_put_wrangler_failed", status: putWrangler.status, detail: putWrangler.text.slice(0, 500) },
      { status: 502 },
    );
  }

  const putIndex = await ghFetch(token, `/repos/${repo}/contents/${indexPath}`, {
    method: "PUT",
    body: JSON.stringify({
      message: commitMsg(indexPath),
      content: encode(nextIndex),
      sha: indexFile.body.sha,
      branch: branchName,
    }),
  });
  if (putIndex.status !== 200 && putIndex.status !== 201) {
    return Response.json(
      { error: "github_put_index_failed", status: putIndex.status, detail: putIndex.text.slice(0, 500) },
      { status: 502 },
    );
  }

  // Open PR.
  const prBody =
    `Auto-bind triggered by post-deploy beacon from \`${payload.service}\`.\n\n` +
    `- url: ${payload.url}\n` +
    `- deploy_id: \`${payload.deploy_id || "n/a"}\`\n` +
    `- commit_sha: \`${payload.commit_sha || "n/a"}\`\n\n` +
    `Adds:\n` +
    `- \`${bindingName}: Fetcher\` to \`Env\`\n` +
    `- \`${sub}\` entry to \`SERVICE_MAP\`\n` +
    `- \`{ binding: "${bindingName}", service: "${payload.service}" }\` to \`wrangler.jsonc\` services[]\n\n` +
    `Once merged + deployed, aggregator surfaces tools at \`mcp.chitty.cc/${sub}/mcp\`.`;
  const openPr = await ghFetch(token, `/repos/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `feat(aggregator): auto-bind ${payload.service}`,
      head: branchName,
      base: "main",
      body: prBody,
    }),
  });
  if (openPr.status !== 201 || !openPr.body?.html_url) {
    return Response.json(
      { error: "github_open_pr_failed", status: openPr.status, detail: openPr.text.slice(0, 500) },
      { status: 502 },
    );
  }

  return Response.json({
    status: "pr_opened",
    pr_url: openPr.body.html_url,
    pr_number: openPr.body.number,
    branch: branchName,
    binding: bindingName,
    sub,
  });
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

    // Auto-bind beacon — uses its own BIND_BEACON_TOKEN, not the admin token,
    // so chittyagent-* workers can call it without holding admin credentials.
    if (request.method === "POST" && path === "/admin/bind") {
      return handleAdminBind(request, env);
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
    // Treat `/` (no path) the same as `/mcp` for POST — some MCP clients
    // (Claude.ai connector when user enters `mcp.chitty.cc` without trailing
    // `/mcp`) post the JSON-RPC body directly to root. Without this, the
    // connector probes root, gets the service-index JSON, fails to find
    // MCP tools, and reports "There was a problem connecting".
    if ((path === "/" || path === "" || path === "/mcp" || path.startsWith("/mcp/")) && request.method === "POST") {
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
              capabilities: {
                tools: { listChanged: true },
                prompts: { listChanged: true },
                resources: { listChanged: true, subscribe: false },
              },
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
        const toolName: string = body.params?.name || "";
        // Legacy support: accept old "service/tool" form too.
        if (toolName.includes("/")) {
          const [sid, ...rest] = toolName.split("/");
          const svc = serviceMap[sid];
          if (svc) {
            return forwardToolCall(env[svc.binding] as Fetcher, rest.join("/"), body.params?.arguments || {}, body.id);
          }
        }
        let serviceId = resolveToolService(toolName, serviceMap);
        if (!serviceId) {
          // Cold isolate with empty index — repopulate via a discovery sweep.
          await Promise.all(Object.entries(serviceMap).map(([id, svc]) =>
            discoverTools(env[svc.binding] as Fetcher, id)));
          serviceId = resolveToolService(toolName, serviceMap);
        }
        if (!serviceId) {
          return sseResponse({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32602, message: `Unknown tool: ${toolName}` },
          });
        }
        const svc = serviceMap[serviceId];
        return forwardToolCall(
          env[svc.binding] as Fetcher,
          toolName,
          body.params?.arguments || {},
          body.id,
        );
      }

      // Aggregate prompts/list across all bound services. Pass-through naming
      // (consistent with post-#104 tools convention). Cursor pagination mirrors
      // tools/list. Per-service `-32601` is tolerated as "no prompts" so a
      // single unimplemented upstream doesn't fail the aggregate.
      if (body.method === "prompts/list") {
        const PAGE_SIZE = 50;
        const allPrompts = (await Promise.all(
          Object.entries(serviceMap).map(([id, svc]) =>
            discoverPrompts(env[svc.binding] as Fetcher, id),
          ),
        )).flat();
        const cursor = typeof body.params?.cursor === "string" ? body.params.cursor : null;
        const startIdx = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
        const slice = allPrompts.slice(startIdx, startIdx + PAGE_SIZE);
        const endIdx = startIdx + slice.length;
        const nextCursor = endIdx < allPrompts.length ? String(endIdx) : undefined;
        const result: Record<string, unknown> = { prompts: slice };
        if (nextCursor) result.nextCursor = nextCursor;
        return sseResponse({ jsonrpc: "2.0", id: body.id, result });
      }

      if (body.method === "prompts/get") {
        const promptName: string = body.params?.name || "";
        let serviceId = PROMPT_ROUTE_INDEX.get(promptName) || null;
        if (!serviceId || !serviceMap[serviceId]) {
          // Cold isolate — repopulate index via a discovery sweep.
          await Promise.all(Object.entries(serviceMap).map(([id, svc]) =>
            discoverPrompts(env[svc.binding] as Fetcher, id)));
          serviceId = PROMPT_ROUTE_INDEX.get(promptName) || null;
        }
        if (!serviceId) {
          return sseResponse({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32602, message: `Unknown prompt: ${promptName}` },
          });
        }
        const svc = serviceMap[serviceId];
        return forwardMcpCall(
          env[svc.binding] as Fetcher,
          "prompts/get",
          body.params,
          body.id,
        );
      }

      // Aggregate resources/list across all bound services. Resources carry
      // their own URI scheme (e.g. notion://, file://), so we index by URI
      // rather than rewriting names. Per-service `-32601` tolerated.
      if (body.method === "resources/list") {
        const PAGE_SIZE = 50;
        const allResources = (await Promise.all(
          Object.entries(serviceMap).map(([id, svc]) =>
            discoverResources(env[svc.binding] as Fetcher, id),
          ),
        )).flat();
        const cursor = typeof body.params?.cursor === "string" ? body.params.cursor : null;
        const startIdx = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
        const slice = allResources.slice(startIdx, startIdx + PAGE_SIZE);
        const endIdx = startIdx + slice.length;
        const nextCursor = endIdx < allResources.length ? String(endIdx) : undefined;
        const result: Record<string, unknown> = { resources: slice };
        if (nextCursor) result.nextCursor = nextCursor;
        return sseResponse({ jsonrpc: "2.0", id: body.id, result });
      }

      if (body.method === "resources/read") {
        const uri: string = body.params?.uri || "";
        let serviceId = RESOURCE_ROUTE_INDEX.get(uri) || null;
        if (!serviceId || !serviceMap[serviceId]) {
          await Promise.all(Object.entries(serviceMap).map(([id, svc]) =>
            discoverResources(env[svc.binding] as Fetcher, id)));
          serviceId = RESOURCE_ROUTE_INDEX.get(uri) || null;
        }
        if (!serviceId) {
          return sseResponse({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32602, message: `Unknown resource: ${uri}` },
          });
        }
        const svc = serviceMap[serviceId];
        return forwardMcpCall(
          env[svc.binding] as Fetcher,
          "resources/read",
          body.params,
          body.id,
        );
      }

      // resources/templates/list — clients may call this to discover URI
      // templates. No upstream currently advertises templates; return empty
      // so clients don't crash on -32601. When an upstream starts exposing
      // templates we'll fan out the same way as resources/list.
      if (body.method === "resources/templates/list") {
        return sseResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: { resourceTemplates: [] },
        });
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
