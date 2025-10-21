#!/usr/bin/env node

/**
 * MCP Execution Service
 * TypeScript-based MCP server for executing remote tools and workflows
 *
 * Features:
 * - Remote tool execution
 * - Workflow orchestration
 * - Service discovery
 * - Error handling and retry logic
 *
 * Version: 1.0.0
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

interface ExecutionConfig {
  timeout?: number;
  retries?: number;
  fallback?: boolean;
}

interface ServiceEndpoint {
  url: string;
  auth?: string;
  healthCheck?: string;
}

class MCPExecutionServer {
  private server: Server;
  private serviceRegistry: Map<string, ServiceEndpoint>;

  constructor() {
    this.server = new Server(
      {
        name: "mcp-exec",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.serviceRegistry = new Map();
    this.initializeServiceRegistry();
    this.setupHandlers();
  }

  private initializeServiceRegistry(): void {
    // ChittyOS core services
    this.serviceRegistry.set("chittyid", {
      url: process.env.CHITTYID_SERVICE || "https://id.chitty.cc",
      auth: process.env.CHITTY_ID_TOKEN,
      healthCheck: "/health",
    });

    this.serviceRegistry.set("chittyregistry", {
      url: process.env.REGISTRY_SERVICE || "https://registry.chitty.cc",
      healthCheck: "/health",
    });

    this.serviceRegistry.set("chittygateway", {
      url: process.env.GATEWAY_SERVICE || "https://gateway.chitty.cc",
      healthCheck: "/health",
    });

    console.error(`Initialized ${this.serviceRegistry.size} service endpoints`);
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "execute_remote_tool",
          description: "Execute a tool on a remote MCP server",
          inputSchema: {
            type: "object",
            properties: {
              service: {
                type: "string",
                description: "Service name (e.g., 'chittyid', 'chittyregistry')",
              },
              tool: {
                type: "string",
                description: "Tool name to execute",
              },
              arguments: {
                type: "object",
                description: "Tool arguments",
              },
              config: {
                type: "object",
                description: "Execution configuration (timeout, retries)",
              },
            },
            required: ["service", "tool", "arguments"],
          },
        },
        {
          name: "discover_services",
          description: "Discover available MCP services",
          inputSchema: {
            type: "object",
            properties: {
              filter: {
                type: "string",
                description: "Filter services by name pattern",
              },
            },
          },
        },
        {
          name: "health_check",
          description: "Check health of registered services",
          inputSchema: {
            type: "object",
            properties: {
              service: {
                type: "string",
                description: "Service name to check (optional, checks all if omitted)",
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "execute_remote_tool":
          return this.handleExecuteRemoteTool(args as any);
        case "discover_services":
          return this.handleDiscoverServices(args as any);
        case "health_check":
          return this.handleHealthCheck(args as any);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  private async handleExecuteRemoteTool(args: {
    service: string;
    tool: string;
    arguments: Record<string, any>;
    config?: ExecutionConfig;
  }) {
    const { service, tool, arguments: toolArgs, config = {} } = args;

    const endpoint = this.serviceRegistry.get(service);
    if (!endpoint) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown service: ${service}. Available services: ${Array.from(
          this.serviceRegistry.keys()
        ).join(", ")}`
      );
    }

    try {
      const result = await this.executeWithRetry(
        endpoint,
        tool,
        toolArgs,
        config
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                service,
                tool,
                result,
                executed_at: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to execute ${tool} on ${service}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async executeWithRetry(
    endpoint: ServiceEndpoint,
    tool: string,
    args: Record<string, any>,
    config: ExecutionConfig
  ): Promise<any> {
    const maxRetries = config.retries || 3;
    const timeout = config.timeout || 30000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (endpoint.auth) {
          headers["Authorization"] = `Bearer ${endpoint.auth}`;
        }

        const response = await fetch(`${endpoint.url}/tools/execute`, {
          method: "POST",
          headers,
          body: JSON.stringify({ tool, arguments: args }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`
        );

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError || new Error("Execution failed after all retries");
  }

  private async handleDiscoverServices(args: { filter?: string }) {
    const { filter } = args;

    let services = Array.from(this.serviceRegistry.entries()).map(
      ([name, endpoint]) => ({
        name,
        url: endpoint.url,
        has_auth: !!endpoint.auth,
        health_check: endpoint.healthCheck,
      })
    );

    if (filter) {
      const pattern = new RegExp(filter, "i");
      services = services.filter((s) => pattern.test(s.name));
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total: services.length,
              services,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleHealthCheck(args: { service?: string }) {
    const { service } = args;

    const servicesToCheck = service
      ? [service]
      : Array.from(this.serviceRegistry.keys());

    const healthChecks = await Promise.all(
      servicesToCheck.map(async (serviceName) => {
        const endpoint = this.serviceRegistry.get(serviceName);
        if (!endpoint) {
          return {
            service: serviceName,
            status: "unknown",
            error: "Service not found",
          };
        }

        try {
          const healthUrl = endpoint.healthCheck
            ? `${endpoint.url}${endpoint.healthCheck}`
            : endpoint.url;

          const response = await fetch(healthUrl, {
            method: "GET",
            signal: AbortSignal.timeout(5000),
          });

          return {
            service: serviceName,
            status: response.ok ? "healthy" : "unhealthy",
            http_status: response.status,
            url: healthUrl,
          };
        } catch (error) {
          return {
            service: serviceName,
            status: "unreachable",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              checked_at: new Date().toISOString(),
              health_checks: healthChecks,
              summary: {
                total: healthChecks.length,
                healthy: healthChecks.filter((h) => h.status === "healthy")
                  .length,
                unhealthy: healthChecks.filter(
                  (h) => h.status !== "healthy"
                ).length,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MCP Execution Service v1.0.0 running on stdio");
  }
}

const server = new MCPExecutionServer();
server.run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
