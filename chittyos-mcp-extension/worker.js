/**
 * ChittyMCP Extension - Cloudflare Workers Version
 * Simplified worker for portal integration with account ***121
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "ChittyMCP Extension",
          version: "1.0.1",
          account: "0bc21e3a5a9de1a4cc843be9c3e98121",
          deployment: "cloudflare-workers",
          tools: {
            core: 7,
            chittyauth: 3,
            cloudflare_mcp: 4,
            total: 14,
          },
          integrations: ["chittyauth", "cloudflare-mcp", "chittyid"],
          endpoints: {
            chittyauth:
              env.CHITTYAUTH_URL ||
              "https://chittyauth-mcp-121.chittycorp-llc.workers.dev",
            chittyid: env.CHITTY_ID_SERVICE || "https://id.chitty.cc",
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Tools list endpoint
    if (url.pathname === "/tools") {
      return new Response(
        JSON.stringify({
          core_tools: [
            "generate_chitty_id",
            "create_legal_case",
            "analyze_document",
            "process_payment",
            "compliance_check",
            "search_cases",
            "execute_workflow",
          ],
          chittyauth_tools: [
            "authenticate_chittyauth",
            "validate_chittyauth_token",
            "check_chittyauth_permission",
          ],
          cloudflare_tools: [
            "cloudflare_mcp_connect",
            "cloudflare_mcp_execute",
            "cloudflare_mcp_list",
            "cloudflare_mcp_config",
          ],
          total_tools: 14,
          mcp_portal_ready: true,
          account_bound: "0bc21e3a5a9de1a4cc843be9c3e98121",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // MCP portal authentication test
    if (url.pathname === "/portal/test") {
      return new Response(
        JSON.stringify({
          portal_integration: "ready",
          account: "0bc21e3a5a9de1a4cc843be9c3e98121",
          chittyauth_endpoint:
            env.CHITTYAUTH_URL ||
            "https://chittyauth-mcp-121.chittycorp-llc.workers.dev",
          cloudflare_zero_trust: "configured",
          mcp_tools_available: 14,
          session_sync: "enabled",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // ChittyAuth proxy for portal integration
    if (url.pathname.startsWith("/chittyauth/")) {
      const chittyauthUrl =
        env.CHITTYAUTH_URL ||
        "https://chittyauth-mcp-121.chittycorp-llc.workers.dev";
      const proxyUrl = chittyauthUrl + url.pathname.replace("/chittyauth", "");

      return fetch(proxyUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }

    // Root endpoint
    return new Response(
      JSON.stringify({
        service: "ChittyMCP Extension",
        version: "1.0.1",
        account: "0bc21e3a5a9de1a4cc843be9c3e98121",
        description:
          "ChittyOS MCP Extension deployed to Cloudflare Workers for portal integration",
        usage:
          "This worker provides health checks and portal integration endpoints. Use the full MCP server via stdio transport for tool execution.",
        endpoints: {
          "/health": "Service health and capabilities",
          "/tools": "Available MCP tools list",
          "/portal/test": "Portal integration test",
          "/chittyauth/*": "ChittyAuth service proxy",
        },
        mcp_portal_compatible: true,
        cross_sync_enabled: true,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  },
};
