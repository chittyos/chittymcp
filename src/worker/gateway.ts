/**
 * Gateway-entrypoint identity forwarding.
 *
 * Contract: dev-ops/proposals/GATEWAY_BINDING_CONTRACT.md (v0.1).
 *
 * A service whose BINDING NAME is in GATEWAY_BINDINGS is bound to the agent's
 * named entrypoint `Gateway` (wrangler.jsonc `entrypoint`). The decision is
 * keyed on the binding, never on the route prefix or the KV registry entry: a
 * registry entry can map any `sub` onto any binding, so a sub-keyed flag would
 * let `{sub:"x", binding:"SVC_OLMEC"}` reach the Gateway with chittymcp's own
 * token and the client's forged X-Chitty-* headers. That entrypoint trusts two
 * headers, so chittymcp must:
 *   - strip every inbound `X-Chitty-*` header from the client request,
 *   - set `X-Chitty-Caller` to the principal it authenticated (never empty),
 *   - set `X-Chitty-Via: chittymcp`,
 *   - NOT forward its own service token (or the client's bearer) on that call,
 *   - refuse the call when it cannot resolve a principal.
 * Other bindings keep the existing behaviour (chittymcp's own
 * CHITTY_AUTH_SERVICE_TOKEN as the upstream bearer), except that inbound
 * X-Chitty-* is stripped on every proxied request.
 *
 * The principal handed to these helpers must come from gatewayPrincipal(),
 * which additionally requires the Access JWT `aud` to be on the
 * GATEWAY_ACCESS_AUDS allowlist.
 */

export const GATEWAY_VIA = "chittymcp";

/** Bindings wired to a `Gateway` entrypoint. Code-owned; never read from KV. */
export const GATEWAY_BINDINGS: ReadonlySet<string> = new Set(["SVC_OLMEC"]);

export interface UpstreamTarget {
  binding: string;
}

export function isGatewayTarget(svc: UpstreamTarget): boolean {
  return GATEWAY_BINDINGS.has(svc.binding);
}

/** Normalise a JWT `aud` claim (string | string[] | absent) to a string list. */
export function audiencesFromClaims(claims: Record<string, unknown> | null): string[] {
  const aud = claims?.aud;
  if (typeof aud === "string") return [aud];
  if (Array.isArray(aud)) return aud.filter((a): a is string => typeof a === "string");
  return [];
}

/**
 * Principal usable for a gateway-entrypoint call: the edge principal, only when
 * the verified Access JWT `aud` intersects `allowlistCsv` (GATEWAY_ACCESS_AUDS).
 * Empty/unset allowlist → null (fail closed). Logs rejected aud values, never
 * the token.
 */
export function gatewayPrincipal(
  principal: string | null,
  aud: string[],
  allowlistCsv: string | undefined,
): string | null {
  if (!principal) return null;
  const allowed = new Set((allowlistCsv || "").split(",").map((s) => s.trim()).filter(Boolean));
  if (aud.some((a) => allowed.has(a))) return principal;
  console.log(
    `[gateway] REJECTED aud-not-allowed aud=${JSON.stringify(aud)} allowlist_size=${allowed.size}`,
  );
  return null;
}

// Test seam: lets the in-process suite verify Access JWTs against a locally
// generated key instead of the team's remote certs endpoint. Not reachable
// from any request path or env var; production never calls the setter.
type JwksResolver = Parameters<typeof import("jose").jwtVerify>[1];
let accessJwksOverride: JwksResolver | null = null;
export function setAccessJwksForTest(jwks: JwksResolver | null): void {
  accessJwksOverride = jwks;
}
export function accessJwksForTest(): JwksResolver | null {
  return accessJwksOverride;
}

/**
 * Principal from verified Cloudflare Access JWT claims: `sub`, else `email`.
 * Returns null when neither is a non-empty string.
 */
export function principalFromAccessClaims(claims: Record<string, unknown> | null): string | null {
  if (!claims) return null;
  for (const key of ["sub", "email"]) {
    const v = claims[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Headers that authenticate chittymcp's upstream call to `svc`.
 * Returns null when `svc` is a gateway entrypoint and no principal is known —
 * the caller must refuse the call and not invoke the binding.
 */
export function upstreamAuthHeaders(
  svc: UpstreamTarget,
  chittyAuthToken: string,
  principal: string | null,
): Record<string, string> | null {
  if (isGatewayTarget(svc)) {
    if (!principal) return null;
    return { "X-Chitty-Caller": principal, "X-Chitty-Via": GATEWAY_VIA };
  }
  return { "Authorization": chittyAuthToken ? `Bearer ${chittyAuthToken}` : "" };
}

/**
 * Build the per-service proxy request (`/{prefix}/mcp` → binding `/mcp`).
 * Returns null when the call must be refused (gateway service, no principal).
 */
export function buildProxyRequest(
  request: Request,
  upstreamUrl: string,
  svc: UpstreamTarget,
  chittyAuthToken: string,
  principal: string | null,
): Request | null {
  const proxyReq = new Request(upstreamUrl, request);
  // Inbound X-Chitty-* is client-controlled; never forward it to any agent.
  for (const name of [...proxyReq.headers.keys()]) {
    if (name.toLowerCase().startsWith("x-chitty-")) proxyReq.headers.delete(name);
  }
  if (!isGatewayTarget(svc)) {
    if (chittyAuthToken) proxyReq.headers.set("Authorization", `Bearer ${chittyAuthToken}`);
    return proxyReq;
  }
  const auth = upstreamAuthHeaders(svc, chittyAuthToken, principal);
  if (!auth) return null;
  // The client's credentials (MCP_API_KEY / Access JWT, as bearer, Access
  // assertion header or CF_Authorization cookie) are not the agent's to see.
  proxyReq.headers.delete("Authorization");
  proxyReq.headers.delete("Cf-Access-Jwt-Assertion");
  proxyReq.headers.delete("Cookie");
  for (const [k, v] of Object.entries(auth)) proxyReq.headers.set(k, v);
  return proxyReq;
}

export function refusedNoPrincipal(id: unknown = null): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32001, message: "forbidden: no authenticated principal to forward to gateway service" },
    }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}
