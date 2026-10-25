/**
 * Gateway-entrypoint identity forwarding.
 *
 * Contract: dev-ops/proposals/GATEWAY_BINDING_CONTRACT.md (v0.1).
 *
 * A service whose SERVICE_MAP entry sets `gateway: true` is bound to the
 * agent's named entrypoint `Gateway` (wrangler.jsonc `entrypoint`). That
 * entrypoint trusts two headers, so chittymcp must:
 *   - strip every inbound `X-Chitty-*` header from the client request,
 *   - set `X-Chitty-Caller` to the principal it authenticated (never empty),
 *   - set `X-Chitty-Via: chittymcp`,
 *   - NOT forward its own service token (or the client's bearer) on that call,
 *   - refuse the call when it cannot resolve a principal.
 * Services without the flag keep the existing behaviour: chittymcp's own
 * CHITTY_AUTH_SERVICE_TOKEN as the upstream bearer.
 */

export const GATEWAY_VIA = "chittymcp";

export interface UpstreamTarget {
  gateway?: boolean;
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
  if (svc.gateway) {
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
  if (!svc.gateway) {
    if (chittyAuthToken) proxyReq.headers.set("Authorization", `Bearer ${chittyAuthToken}`);
    return proxyReq;
  }
  const auth = upstreamAuthHeaders(svc, chittyAuthToken, principal);
  if (!auth) return null;
  for (const name of [...proxyReq.headers.keys()]) {
    if (name.toLowerCase().startsWith("x-chitty-")) proxyReq.headers.delete(name);
  }
  // The client's credential (MCP_API_KEY / Access JWT) is not the agent's to see.
  proxyReq.headers.delete("Authorization");
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
