# ChittyMCP Connection & Credential Management Strategy

**Document Version**: 1.0.0
**Created**: 2025-12-09
**ChittyOS Framework**: v1.0.1
**Author**: ChittyConnect Concierge

---

## Executive Summary

This document outlines the comprehensive connection architecture, credential management strategy, and security implementation for the ChittyMCP unified MCP server. It provides a zero-trust security model integrating with ChittyConnect, 1Password, and Cloudflare Workers secrets management.

**Key Components**:
- Service-to-service authentication via ChittyConnect patterns
- 1Password-based credential provisioning
- ContextConsciousness session management for MCP workflows
- Environment-specific configuration (dev, staging, production)
- Automated secret rotation strategy

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Service Connection Matrix](#service-connection-matrix)
3. [Credential Management](#credential-management)
4. [ChittyConnect Integration](#chittyconnect-integration)
5. [Session Management](#session-management)
6. [Environment Configuration](#environment-configuration)
7. [Secret Rotation Strategy](#secret-rotation-strategy)
8. [Implementation Roadmap](#implementation-roadmap)

---

## Architecture Overview

### Service Trust Zones

ChittyMCP operates across multiple trust boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL TRUST ZONE                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Claude   │  │  ChatGPT   │  │   Human    │            │
│  │  Desktop   │  │   Actions  │  │   Client   │            │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘            │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │ (stdio/HTTP)
┌──────────────────────────┼───────────────────────────────────┐
│              DMZ - CHITTY MCP SERVER                         │
│         ┌────────────────▼──────────────────┐                │
│         │   UnifiedMCPServer (Node.js)      │                │
│         │   - Tool routing                  │                │
│         │   - Chain orchestration           │                │
│         │   - Session management            │                │
│         │   - Authentication gateway        │                │
│         └─────────────┬─────────────────────┘                │
│                       │                                       │
└───────────────────────┼───────────────────────────────────────┘
                        │ (Service tokens)
┌───────────────────────┼───────────────────────────────────────┐
│           INTERNAL CHITTYOS TRUST ZONE                        │
│  ┌────────┴──────┬─────────┬─────────┬──────────┬─────────┐ │
│  │               │         │         │          │         │ │
│  ▼               ▼         ▼         ▼          ▼         ▼ │
│ ChittyID    ChittyAuth  ChittyRouter  ChittyLedger  Context │
│ (id.chitty  (auth.chitty (router.chitty (Neon DB)  Cloude │
│  .cc)       .cc)         .cc)                       (KV)   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────┼───────────────────────────────────────┐
│         EXTERNAL INTEGRATION ZONE                             │
│  ┌────────┴──────┬─────────┬──────────┬───────────┐          │
│  │               │         │          │           │          │
│  ▼               ▼         ▼          ▼           ▼          │
│ Cloudflare    Google    Notion    OpenAI    Anthropic        │
│ (Workers,     Drive     (Docs)    (GPT-4)   (Claude)         │
│  KV, R2,                                                      │
│  D1)                                                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Security Posture by Zone

| Zone | Authentication | Authorization | Encryption |
|------|----------------|---------------|------------|
| **External Trust Zone** | OAuth 2.0 (future), API keys | Read-only by default | TLS 1.3 |
| **DMZ** | Service tokens | Scope-based RBAC | TLS 1.3 + JWT |
| **Internal ChittyOS** | Service tokens (SHA-256 validated) | Service-to-service scopes | mTLS (future) |
| **External Integration** | API keys (1Password managed) | Vendor-specific | TLS 1.3 |

---

## Service Connection Matrix

### ChittyOS Core Services

| Service | URL | Authentication Method | Required Scopes | Priority | Health Check |
|---------|-----|----------------------|-----------------|----------|--------------|
| **ChittyID** | https://id.chitty.cc | `Bearer CHITTY_ID_TOKEN` | `chittyid:mint`, `chittyid:validate` | CRITICAL | `/health` |
| **ChittyAuth** | https://auth.chitty.cc | `Bearer CHITTY_AUTH_TOKEN` | `chittyauth:oauth`, `chittyauth:validate` | HIGH | `/api/v1/status` |
| **ChittyRouter** | https://router.chitty.cc | `Bearer CHITTY_ROUTER_TOKEN` | `chittyrouter:route`, `chittyrouter:analyze` | HIGH | `/health` |
| **ChittyRegistry** | https://registry.chitty.cc | `Bearer CHITTY_REGISTRY_TOKEN` | `chittyregistry:register`, `chittyregistry:query` | MEDIUM | `/api/v1/services` |
| **ChittyLedger** | PostgreSQL (Neon) | `NEON_DATABASE_URL` | Full DB access | CRITICAL | SQL: `SELECT 1` |
| **ContextConsciousness** | KV binding | `env.PLATFORM_KV` | KV read/write | HIGH | KV: `get("health")` |

### External Integration Services

| Service | Authentication | Credential Source | Rotation Period | Purpose |
|---------|----------------|-------------------|-----------------|---------|
| **Cloudflare API** | `Bearer CLOUDFLARE_API_TOKEN` | 1Password: `ChittyOS-Secrets/CLOUDFLARE_API_TOKEN` | 90 days | Worker deployment, KV/R2/D1 management |
| **Google Drive** | File system path | Local mount | N/A | Evidence source monitoring |
| **Notion** | `Bearer NOTION_TOKEN` | 1Password: `ChittyOS-Secrets/NOTION_TOKEN` | 180 days | Evidence database sync (optional) |
| **OpenAI** | `Bearer OPENAI_API_KEY` | 1Password: `ChittyOS-Secrets/OPENAI_API_KEY` | Manual | AI-powered document analysis |
| **Anthropic** | `x-api-key: ANTHROPIC_API_KEY` | 1Password: `ChittyOS-Secrets/ANTHROPIC_API_KEY` | Manual | AI-powered reasoning |

### Connection Validation Flow

```typescript
/**
 * Connection establishment pattern for ChittyMCP
 */
async function establishConnection(
  serviceName: string,
  token: string,
  endpoint: string
): Promise<ConnectionStatus> {

  // Step 1: Verify token availability
  if (!token) {
    throw new ConnectionError(
      `Missing token for ${serviceName}`,
      'MISSING_CREDENTIAL'
    );
  }

  // Step 2: Generate request ID for audit trail
  const requestId = crypto.randomUUID();

  // Step 3: Perform health check
  const healthResponse = await fetch(`${endpoint}/health`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Request-ID': requestId,
      'X-Source-Service': 'chittymcp',
      'X-ChittyMCP-Version': '3.0.0'
    },
    signal: AbortSignal.timeout(5000) // 5 second timeout
  });

  if (!healthResponse.ok) {
    throw new ConnectionError(
      `Health check failed for ${serviceName}: ${healthResponse.status}`,
      'HEALTH_CHECK_FAILED'
    );
  }

  // Step 4: Log connection to ContextConsciousness
  await logConnection(serviceName, requestId, 'established');

  return {
    service: serviceName,
    status: 'connected',
    requestId,
    timestamp: new Date().toISOString()
  };
}
```

---

## Credential Management

### 1Password Integration Architecture

ChittyMCP uses 1Password as the single source of truth for all credentials:

```
┌─────────────────────────────────────────────────────────────┐
│                   1PASSWORD VAULT STRUCTURE                  │
│                                                               │
│  Vault: ChittyOS-Secrets                                     │
│  ├─ CHITTY_ID_TOKEN (Password)                              │
│  │  ├─ password: mcp_auth_[hash]                            │
│  │  ├─ created: 2025-10-01                                  │
│  │  ├─ expires: 2026-10-01 (365 days)                       │
│  │  └─ scopes: chittyid:mint,chittyid:validate              │
│  │                                                            │
│  ├─ CHITTY_AUTH_TOKEN (Password)                            │
│  ├─ CHITTY_ROUTER_TOKEN (Password)                          │
│  ├─ CHITTY_REGISTRY_TOKEN (Password)                        │
│  │                                                            │
│  ├─ NEON_DATABASE_URL (Password)                            │
│  │  ├─ password: postgresql://...                           │
│  │  └─ expires: Never (rotate on compromise)                │
│  │                                                            │
│  ├─ CLOUDFLARE_API_TOKEN (API Credential)                   │
│  │  ├─ token: cf_[hash]                                     │
│  │  └─ expires: 2026-01-01 (90 days)                        │
│  │                                                            │
│  ├─ OPENAI_API_KEY (API Credential)                         │
│  └─ ANTHROPIC_API_KEY (API Credential)                      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Credential Provisioning Workflow

#### Development Environment

```bash
#!/bin/bash
# scripts/provision-dev-credentials.sh

# Load credentials from 1Password into local .env
op run --env-file=<(cat <<'EOF'
export CHITTY_ID_TOKEN=op://ChittyOS-Secrets/CHITTY_ID_TOKEN/password
export CHITTY_AUTH_TOKEN=op://ChittyOS-Secrets/CHITTY_AUTH_TOKEN/password
export CHITTY_ROUTER_TOKEN=op://ChittyOS-Secrets/CHITTY_ROUTER_TOKEN/password
export NEON_DATABASE_URL=op://ChittyOS-Secrets/NEON_DATABASE_URL/password
export CLOUDFLARE_API_TOKEN=op://ChittyOS-Secrets/CLOUDFLARE_API_TOKEN/password
export OPENAI_API_KEY=op://ChittyOS-Secrets/OPENAI_API_KEY/password
export ANTHROPIC_API_KEY=op://ChittyOS-Secrets/ANTHROPIC_API_KEY/password
EOF
) -- npm run dev
```

#### Staging Environment

```bash
# Set Cloudflare Workers secrets for staging
wrangler secret put CHITTY_ID_TOKEN --env staging
# Paste value from: op read "op://ChittyOS-Secrets/CHITTY_ID_TOKEN/password"

wrangler secret put NEON_DATABASE_URL --env staging
# Paste value from: op read "op://ChittyOS-Secrets/NEON_DATABASE_URL_STAGING/password"

# Verify secrets are set
wrangler secret list --env staging
```

#### Production Environment

```bash
# CRITICAL: Use production-specific credentials
wrangler secret put CHITTY_ID_TOKEN --env production
wrangler secret put CHITTY_AUTH_TOKEN --env production
wrangler secret put CHITTY_ROUTER_TOKEN --env production
wrangler secret put NEON_DATABASE_URL --env production
wrangler secret put CLOUDFLARE_API_TOKEN --env production

# Verify ALL required secrets are present
wrangler secret list --env production | grep -E "CHITTY_ID_TOKEN|NEON_DATABASE_URL|CLOUDFLARE_API_TOKEN"
```

### Credential Security Requirements

| Credential Type | Storage | Access Control | Rotation | Audit |
|----------------|---------|----------------|----------|-------|
| **Service Tokens** | 1Password + Cloudflare Secrets | ChittyMCP only | 90 days | All access logged |
| **Database URLs** | 1Password + Cloudflare Secrets | ChittyMCP + DB admins | On compromise | Connection logs |
| **API Keys** | 1Password + Cloudflare Secrets | ChittyMCP only | Per vendor policy | Usage tracked |
| **Session Keys** | Generated runtime | ChittyMCP process | Per session | ContextConsciousness |

### Secrets Never to Commit

```bash
# .gitignore entries for ChittyMCP
.env
.env.local
.env.*.local
.wrangler/
wrangler.toml.local
*.pem
*.key
credentials.json
service-account.json
```

---

## ChittyConnect Integration

### Service-to-Service Authentication Pattern

ChittyConnect provides the standard service authentication mechanism for ChittyOS. ChittyMCP implements this pattern for all internal service calls:

```typescript
/**
 * ChittyConnect Service Call Pattern
 * Used for all ChittyOS service interactions
 */
class ChittyConnectClient {
  constructor(
    private serviceToken: string,
    private serviceName: string = 'chittymcp'
  ) {}

  async call<T>(
    targetService: string,
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const {
      method = 'POST',
      body,
      timeout = 30000 // 30 second timeout for AI operations
    } = options;

    const url = this.getServiceUrl(targetService, endpoint);
    const requestId = crypto.randomUUID();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`,
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Source-Service': this.serviceName,
          'X-ChittyMCP-Version': '3.0.0',
          'X-Session-Context': this.getSessionContext()
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeout)
      });

      // Log to ContextConsciousness
      await this.logServiceCall(targetService, endpoint, requestId, response.status);

      if (!response.ok) {
        throw new ChittyConnectError(
          `Service call failed: ${response.status} ${response.statusText}`,
          {
            service: targetService,
            endpoint,
            requestId,
            status: response.status
          }
        );
      }

      return await response.json();
    } catch (error) {
      // Log failure to ContextConsciousness
      await this.logServiceError(targetService, endpoint, requestId, error);
      throw error;
    }
  }

  private getServiceUrl(service: string, endpoint: string): string {
    const serviceUrls: Record<string, string> = {
      'chittyid': process.env.CHITTYID_SERVICE || 'https://id.chitty.cc',
      'chittyauth': process.env.CHITTYAUTH_SERVICE || 'https://auth.chitty.cc',
      'chittyrouter': process.env.CHITTYROUTER_SERVICE || 'https://router.chitty.cc',
      'chittyregistry': process.env.CHITTYREGISTRY_SERVICE || 'https://registry.chitty.cc'
    };

    const baseUrl = serviceUrls[service.toLowerCase()];
    if (!baseUrl) {
      throw new Error(`Unknown ChittyOS service: ${service}`);
    }

    return `${baseUrl}${endpoint}`;
  }

  private getSessionContext(): string | null {
    // Retrieve from ContextConsciousness KV if available
    return global.currentSessionId || null;
  }

  private async logServiceCall(
    service: string,
    endpoint: string,
    requestId: string,
    status: number
  ): Promise<void> {
    // Log to ContextConsciousness for audit trail
    if (global.contextConsciousness) {
      await global.contextConsciousness.log({
        type: 'service_call',
        service,
        endpoint,
        requestId,
        status,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async logServiceError(
    service: string,
    endpoint: string,
    requestId: string,
    error: Error
  ): Promise<void> {
    if (global.contextConsciousness) {
      await global.contextConsciousness.log({
        type: 'service_error',
        service,
        endpoint,
        requestId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

### ChittyID Generation Integration

**CRITICAL**: ChittyIDs must NEVER be generated locally. Always call the ChittyID service:

```typescript
/**
 * ChittyID Generation via ChittyConnect
 * This is the ONLY acceptable pattern for ChittyID generation
 */
async function mintChittyID(
  entityType: 'PEO' | 'PLACE' | 'PROP' | 'EVNT' | 'AUTH' | 'INFO' | 'FACT' | 'CONTEXT' | 'ACTOR',
  metadata: Record<string, any> = {}
): Promise<ChittyIDResponse> {

  const client = new ChittyConnectClient(
    process.env.CHITTY_ID_TOKEN!,
    'chittymcp'
  );

  try {
    const result = await client.call<ChittyIDResponse>(
      'chittyid',
      '/api/v2/chittyid/mint',
      {
        method: 'POST',
        body: {
          entity: entityType,
          metadata: {
            ...metadata,
            source: 'chittymcp',
            chain: 'legal-workflow' // if applicable
          }
        },
        timeout: 10000 // 10 second timeout for ID minting
      }
    );

    return result;
  } catch (error) {
    throw new ChittyIDError(
      `Failed to mint ChittyID for ${entityType}: ${error.message}`,
      { entityType, metadata, error }
    );
  }
}

// Example usage in legal workflow
const caseId = await mintChittyID('PEO', {
  case_type: 'civil',
  jurisdiction: 'Illinois',
  case_number: '2024D007847'
});
```

### Service Registration with ChittyRegistry

ChittyMCP must register itself on startup:

```typescript
/**
 * Register ChittyMCP with ChittyRegistry
 * Enables service discovery and health monitoring
 */
async function registerWithRegistry(): Promise<void> {
  const client = new ChittyConnectClient(
    process.env.CHITTY_REGISTRY_TOKEN!,
    'chittymcp'
  );

  const registration = {
    service_name: 'chittymcp',
    version: '3.0.0',
    health_endpoint: '/health',
    status_endpoint: '/api/v1/status',
    capabilities: [
      'mcp-tools',
      'chain-orchestration',
      'evidence-intake',
      'executive-decision',
      'legal-workflow',
      'infrastructure-deploy',
      'cross-sync'
    ],
    tools: 19,
    chains: 5,
    deployment_url: process.env.CHITTYMCP_WORKER_URL || 'http://localhost:8787',
    metadata: {
      mcp_sdk_version: '0.5.0',
      node_version: process.version,
      cloudflare_account: process.env.CLOUDFLARE_ACCOUNT_ID
    }
  };

  try {
    await client.call('chittyregistry', '/api/v1/register', {
      method: 'POST',
      body: registration
    });

    console.log('✅ Successfully registered with ChittyRegistry');
  } catch (error) {
    console.error('❌ Failed to register with ChittyRegistry:', error);
    // Continue operation but log warning
  }
}
```

---

## Session Management

### ContextConsciousness Integration

ChittyMCP implements ContextConsciousness for session persistence across MCP tool calls:

```typescript
/**
 * ContextConsciousness Session Manager
 * Maintains state across tool invocations and chain executions
 */
class ContextConsciousnessManager {
  constructor(private kv: KVNamespace) {}

  /**
   * Initialize session for MCP client
   */
  async initializeSession(clientId: string, metadata: SessionMetadata): Promise<string> {
    const sessionId = `session:${clientId}:${Date.now()}`;

    const session: MCPSession = {
      sessionId,
      clientId,
      metadata,
      conversationHistory: [],
      toolInvocations: [],
      chainExecutions: [],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };

    await this.kv.put(sessionId, JSON.stringify(session), {
      expirationTtl: 86400 // 24 hours
    });

    return sessionId;
  }

  /**
   * Retrieve session context
   */
  async getSession(sessionId: string): Promise<MCPSession | null> {
    const data = await this.kv.get(sessionId);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update session with tool invocation
   */
  async logToolInvocation(
    sessionId: string,
    toolName: string,
    args: any,
    result: any
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.toolInvocations.push({
      tool: toolName,
      args,
      result: result.content?.[0]?.text || JSON.stringify(result),
      timestamp: new Date().toISOString()
    });

    session.lastActivity = new Date().toISOString();

    await this.kv.put(sessionId, JSON.stringify(session), {
      expirationTtl: 86400
    });
  }

  /**
   * Update session with chain execution
   */
  async logChainExecution(
    sessionId: string,
    chainName: string,
    results: ChainExecutionResult
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.chainExecutions.push({
      chain: chainName,
      orchestrationId: results.orchestration_id,
      results: results.results,
      summary: results.summary,
      timestamp: new Date().toISOString()
    });

    session.lastActivity = new Date().toISOString();

    await this.kv.put(sessionId, JSON.stringify(session), {
      expirationTtl: 86400
    });
  }

  /**
   * Sync session to GitHub for ContextConsciousness persistence
   */
  async syncToGitHub(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    // GitHub sync via ChittyConnect GitHub App
    const client = new ChittyConnectClient(
      process.env.CHITTY_GITHUB_TOKEN!,
      'chittymcp'
    );

    await client.call('chittyconnect', '/api/v2/github/sync-session', {
      method: 'POST',
      body: {
        sessionId: session.sessionId,
        repository: 'chittyos/context-consciousness',
        path: `sessions/${session.clientId}/${sessionId}.json`,
        content: JSON.stringify(session, null, 2),
        message: `Update ContextConsciousness session: ${sessionId}`
      }
    });
  }
}

// Global session manager instance
let sessionManager: ContextConsciousnessManager;

export function initializeContextConsciousness(kv: KVNamespace): void {
  sessionManager = new ContextConsciousnessManager(kv);
  global.contextConsciousness = sessionManager;
}

export function getSessionManager(): ContextConsciousnessManager {
  if (!sessionManager) {
    throw new Error('ContextConsciousness not initialized');
  }
  return sessionManager;
}
```

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP SESSION LIFECYCLE                     │
│                                                               │
│  1. Client Connection                                        │
│     ├─ Claude Desktop connects via stdio                     │
│     ├─ Generate clientId from request metadata               │
│     └─ Initialize session in ContextConsciousness KV         │
│                                                               │
│  2. Tool Invocation                                          │
│     ├─ Retrieve session context                              │
│     ├─ Execute tool with session-aware logic                 │
│     ├─ Log invocation to session history                     │
│     └─ Update lastActivity timestamp                         │
│                                                               │
│  3. Chain Execution                                          │
│     ├─ Load chain definition from config                     │
│     ├─ Execute tools in sequence with session context        │
│     ├─ Aggregate results and maintain state                  │
│     ├─ Log chain execution to session history                │
│     └─ Sync to GitHub for ContextConsciousness persistence   │
│                                                               │
│  4. Session Expiration                                       │
│     ├─ 24-hour TTL on KV storage                             │
│     ├─ Final sync to GitHub before expiration                │
│     └─ Archive session data for audit                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Environment Configuration

### Environment-Specific Strategy

ChittyMCP supports three environments with distinct configuration:

#### Development Environment

**Purpose**: Local development and testing
**Credential Source**: 1Password (via `op run`)
**Database**: Shared staging database or local PostgreSQL
**Service URLs**: Staging ChittyOS services

```bash
# .env.development
CHITTY_ENV=development
NODE_ENV=development
LOG_LEVEL=debug
MCP_DEBUG=true

# Use staging ChittyOS services
CHITTYID_SERVICE=https://id-staging.chitty.cc
CHITTYAUTH_SERVICE=https://auth-staging.chitty.cc
CHITTYROUTER_SERVICE=https://router-staging.chitty.cc

# Local overrides
CHITTYMCP_WORKER_URL=http://localhost:8787

# Feature flags (all enabled for testing)
FEATURE_EVIDENCE_MONITORING=true
FEATURE_AUTO_CATEGORIZATION=true
FEATURE_CHAIN_EXECUTION=true
FEATURE_CLOUDFLARE_INTEGRATION=true
```

#### Staging Environment

**Purpose**: Pre-production testing and validation
**Credential Source**: Cloudflare Workers secrets
**Database**: Staging Neon database (separate from production)
**Service URLs**: Staging ChittyOS services

```toml
# wrangler.toml
[env.staging]
name = "chittymcp-staging"
workers_dev = true

[env.staging.vars]
CHITTY_ENV = "staging"
CHITTYID_SERVICE = "https://id-staging.chitty.cc"
CHITTYAUTH_SERVICE = "https://auth-staging.chitty.cc"
CHITTYROUTER_SERVICE = "https://router-staging.chitty.cc"
PORTAL_DOMAIN = "portal-staging.chitty.cc"
LOG_LEVEL = "info"

[[env.staging.kv_namespaces]]
binding = "PLATFORM_KV"
id = "staging-kv-namespace-id"
```

```bash
# Set staging secrets
wrangler secret put CHITTY_ID_TOKEN --env staging
wrangler secret put NEON_DATABASE_URL --env staging
wrangler secret put CLOUDFLARE_API_TOKEN --env staging
```

#### Production Environment

**Purpose**: Live production deployment
**Credential Source**: Cloudflare Workers secrets (from 1Password)
**Database**: Production Neon database (`chittyos-core`)
**Service URLs**: Production ChittyOS services

```toml
# wrangler.toml
[env.production]
name = "chittymcp"
workers_dev = false
route = "mcp.chitty.cc/*"
zone_name = "chitty.cc"

[env.production.vars]
CHITTY_ENV = "production"
CHITTYID_SERVICE = "https://id.chitty.cc"
CHITTYAUTH_SERVICE = "https://auth.chitty.cc"
CHITTYROUTER_SERVICE = "https://router.chitty.cc"
CHITTYREGISTRY_SERVICE = "https://registry.chitty.cc"
PORTAL_DOMAIN = "portal.chitty.cc"
CLOUDFLARE_ACCOUNT_ID = "bbf9fcd845e78035b7a135c481e88541"
LOG_LEVEL = "warn"

[[env.production.kv_namespaces]]
binding = "PLATFORM_KV"
id = "d52d89c1eebd402b95719161d311e7df"

[[env.production.kv_namespaces]]
binding = "PLATFORM_CACHE"
id = "d66c1e709c72456fa21aaa0d02f2db5e"

[env.production.observability]
enabled = true
```

```bash
# Set production secrets (CRITICAL: Use production credentials only)
wrangler secret put CHITTY_ID_TOKEN --env production
wrangler secret put CHITTY_AUTH_TOKEN --env production
wrangler secret put CHITTY_ROUTER_TOKEN --env production
wrangler secret put CHITTY_REGISTRY_TOKEN --env production
wrangler secret put NEON_DATABASE_URL --env production
wrangler secret put CLOUDFLARE_API_TOKEN --env production
wrangler secret put OPENAI_API_KEY --env production
wrangler secret put ANTHROPIC_API_KEY --env production

# Verify ALL required secrets
wrangler secret list --env production
```

### Configuration Validation

```typescript
/**
 * Validate environment configuration on startup
 */
function validateEnvironmentConfiguration(): void {
  const requiredVars = [
    'CHITTY_ID_TOKEN',
    'NEON_DATABASE_URL',
    'CLOUDFLARE_API_TOKEN'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      `Please set these secrets using: wrangler secret put <VAR_NAME> --env ${process.env.CHITTY_ENV || 'development'}`
    );
  }

  // Validate service URLs are reachable
  const serviceUrls = [
    process.env.CHITTYID_SERVICE,
    process.env.CHITTYAUTH_SERVICE,
    process.env.CHITTYROUTER_SERVICE
  ].filter(Boolean);

  console.log(`✅ Environment configuration valid for ${process.env.CHITTY_ENV}`);
  console.log(`📊 Service URLs configured: ${serviceUrls.length}`);
}
```

---

## Secret Rotation Strategy

### Rotation Schedule

| Credential Type | Rotation Period | Trigger | Process |
|----------------|-----------------|---------|---------|
| **Service Tokens** | 90 days | Automated reminder | 1. Generate new token via ChittyAuth<br>2. Update 1Password vault<br>3. Update Cloudflare secrets<br>4. Verify all services operational<br>5. Revoke old token |
| **Database Passwords** | On compromise | Security incident | 1. Generate new password via Neon<br>2. Update 1Password vault<br>3. Update Cloudflare secrets<br>4. Verify connection<br>5. Revoke old password |
| **Cloudflare API Token** | 90 days | Automated reminder | 1. Generate new token via Cloudflare Dashboard<br>2. Update 1Password vault<br>3. Update Cloudflare secrets<br>4. Verify deployments work<br>5. Revoke old token |
| **AI API Keys** | As per vendor policy | Manual | 1. Generate new key via vendor<br>2. Update 1Password vault<br>3. Update Cloudflare secrets<br>4. Verify AI tools work<br>5. Revoke old key |

### Automated Rotation Script

```bash
#!/bin/bash
# scripts/rotate-service-token.sh
# Automates service token rotation with zero downtime

set -e

SERVICE_NAME=$1
TOKEN_NAME="CHITTY_${SERVICE_NAME^^}_TOKEN"

if [ -z "$SERVICE_NAME" ]; then
  echo "Usage: ./rotate-service-token.sh <service_name>"
  echo "Example: ./rotate-service-token.sh chittyid"
  exit 1
fi

echo "🔄 Rotating service token for: $SERVICE_NAME"

# Step 1: Generate new token via ChittyAuth
echo "📝 Step 1: Generating new service token..."
NEW_TOKEN=$(curl -s -X POST https://auth.chitty.cc/api/v2/tokens/mint \
  -H "Authorization: Bearer $(op read "op://ChittyOS-Secrets/CHITTY_AUTH_ADMIN_TOKEN/password")" \
  -H "Content-Type: application/json" \
  -d "{
    \"service\": \"chittymcp\",
    \"scopes\": [\"${SERVICE_NAME}:read\", \"${SERVICE_NAME}:write\"],
    \"expires_in\": 7776000
  }" | jq -r '.token')

if [ -z "$NEW_TOKEN" ]; then
  echo "❌ Failed to generate new token"
  exit 1
fi

echo "✅ New token generated"

# Step 2: Update 1Password vault
echo "📝 Step 2: Updating 1Password vault..."
op item edit "$TOKEN_NAME" \
  --vault "ChittyOS-Secrets" \
  password="$NEW_TOKEN" \
  "expires=$(date -v+90d +%Y-%m-%d)"

echo "✅ 1Password vault updated"

# Step 3: Update Cloudflare Workers secrets (staging)
echo "📝 Step 3: Updating staging secrets..."
echo "$NEW_TOKEN" | wrangler secret put "$TOKEN_NAME" --env staging

# Test staging deployment
echo "🧪 Testing staging deployment..."
curl -f https://chittymcp-staging.chittycorp-llc.workers.dev/health || {
  echo "❌ Staging health check failed - rolling back"
  # Rollback logic here
  exit 1
}

echo "✅ Staging deployment verified"

# Step 4: Update production secrets
echo "📝 Step 4: Updating production secrets..."
read -p "Proceed with production update? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Production update cancelled"
  exit 0
fi

echo "$NEW_TOKEN" | wrangler secret put "$TOKEN_NAME" --env production

# Test production deployment
echo "🧪 Testing production deployment..."
curl -f https://mcp.chitty.cc/health || {
  echo "❌ Production health check failed - investigate immediately"
  exit 1
}

echo "✅ Production deployment verified"

# Step 5: Schedule old token revocation (7-day grace period)
echo "📝 Step 5: Scheduling old token revocation..."
# This would integrate with ChittyAuth's scheduled revocation
# For now, log the action
echo "⚠️  Old token should be manually revoked in 7 days: $(date -v+7d +%Y-%m-%d)"

echo "🎉 Token rotation complete for $SERVICE_NAME"
```

### Rotation Monitoring

```typescript
/**
 * Monitor credential expiration and alert
 */
async function monitorCredentialExpiration(): Promise<void> {
  const credentials = [
    { name: 'CHITTY_ID_TOKEN', source: '1Password' },
    { name: 'CHITTY_AUTH_TOKEN', source: '1Password' },
    { name: 'CLOUDFLARE_API_TOKEN', source: '1Password' }
  ];

  for (const cred of credentials) {
    const expiryDate = await get1PasswordItemExpiry(cred.name);
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 14) {
      await sendRotationAlert(cred.name, daysUntilExpiry);
    }
  }
}

async function sendRotationAlert(credentialName: string, daysLeft: number): Promise<void> {
  // Send alert via Slack, email, or PagerDuty
  console.warn(
    `⚠️  Credential ${credentialName} expires in ${daysLeft} days - rotation required`
  );

  // Log to ContextConsciousness for tracking
  if (global.contextConsciousness) {
    await global.contextConsciousness.log({
      type: 'credential_expiration_warning',
      credential: credentialName,
      days_until_expiry: daysLeft,
      timestamp: new Date().toISOString()
    });
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goal**: Establish secure credential management and basic service connections

- [ ] **1.1** Create 1Password vault structure for ChittyOS-Secrets
- [ ] **1.2** Generate service tokens for ChittyID, ChittyAuth, ChittyRouter, ChittyRegistry
- [ ] **1.3** Store all credentials in 1Password with metadata (scopes, expiration)
- [ ] **1.4** Set up Cloudflare Workers secrets for staging environment
- [ ] **1.5** Implement ChittyConnectClient class with standard service call pattern
- [ ] **1.6** Add connection validation and health check logic
- [ ] **1.7** Test service-to-service authentication with ChittyID

**Deliverables**:
- 1Password vault with all required credentials
- `lib/chitty-connect-client.ts` implementation
- Staging environment fully configured
- Service connection tests passing

### Phase 2: ContextConsciousness Integration (Week 2)

**Goal**: Implement session management and state persistence

- [ ] **2.1** Implement ContextConsciousnessManager class
- [ ] **2.2** Configure PLATFORM_KV binding in wrangler.toml
- [ ] **2.3** Add session initialization on MCP client connection
- [ ] **2.4** Log tool invocations to session history
- [ ] **2.5** Implement chain execution logging
- [ ] **2.6** Add GitHub sync for ContextConsciousness persistence
- [ ] **2.7** Test session lifecycle and persistence

**Deliverables**:
- `lib/context-consciousness-manager.ts` implementation
- KV namespace configured and operational
- Session data persisting across tool invocations
- GitHub sync integration tested

### Phase 3: Tool Implementation (Week 3-4)

**Goal**: Implement all 19 MCP tools with proper service integration

- [ ] **3.1** Implement Executive tools (5 tools)
  - [ ] analyze_performance
  - [ ] risk_assessment
  - [ ] make_executive_decision
  - [ ] strategic_planning
  - [ ] delegate_task
- [ ] **3.2** Implement Legal tools (7 tools)
  - [ ] generate_chitty_id (via ChittyConnect)
  - [ ] create_legal_case
  - [ ] analyze_document
  - [ ] process_payment
  - [ ] compliance_check
  - [ ] search_cases
  - [ ] execute_workflow
- [ ] **3.3** Implement Infrastructure tools (4 tools)
  - [ ] deploy_worker
  - [ ] manage_kv_namespace
  - [ ] manage_r2_bucket
  - [ ] execute_d1_query
- [ ] **3.4** Implement Sync tools (3 tools)
  - [ ] register_mcp_server
  - [ ] sync_mcp_state
  - [ ] get_synced_servers

**Deliverables**:
- All 19 tools implemented and tested
- Service integration verified for each tool
- Tool invocation logs in ContextConsciousness

### Phase 4: Chain Orchestration (Week 5)

**Goal**: Implement chain execution engine and workflow management

- [ ] **4.1** Load chain definitions from config/chains.json
- [ ] **4.2** Implement chain execution engine with step-by-step orchestration
- [ ] **4.3** Add dependency resolution between tools
- [ ] **4.4** Implement rollback logic for failed chains
- [ ] **4.5** Add chain execution logging to ContextConsciousness
- [ ] **4.6** Test all 5 chains (executive-decision, legal-workflow, infrastructure-deploy, cross-sync, full-orchestration)

**Deliverables**:
- Chain execution engine operational
- All 5 chains tested and validated
- Rollback logic verified

### Phase 5: Production Deployment (Week 6)

**Goal**: Deploy to production with full observability

- [ ] **5.1** Set production Cloudflare Workers secrets
- [ ] **5.2** Deploy to production environment (mcp.chitty.cc)
- [ ] **5.3** Register with ChittyRegistry
- [ ] **5.4** Configure Claude Desktop to use production MCP server
- [ ] **5.5** Implement monitoring and alerting
- [ ] **5.6** Set up credential rotation reminders
- [ ] **5.7** Document operational procedures

**Deliverables**:
- Production deployment operational
- Monitoring dashboards configured
- Credential rotation schedule established
- Operational runbook completed

### Phase 6: Secret Rotation & Maintenance (Ongoing)

**Goal**: Establish automated secret rotation and maintenance procedures

- [ ] **6.1** Create rotation scripts for all credential types
- [ ] **6.2** Set up automated expiration monitoring
- [ ] **6.3** Configure rotation alerts (Slack, email)
- [ ] **6.4** Document rotation procedures
- [ ] **6.5** Test rotation scripts in staging
- [ ] **6.6** Schedule first production rotation

**Deliverables**:
- Rotation scripts tested and documented
- Monitoring alerts operational
- Rotation runbook complete

---

## Success Criteria

### Security Metrics

- [ ] 100% of credentials stored in 1Password (zero hard-coded secrets)
- [ ] All service-to-service calls authenticated with service tokens
- [ ] Zero-trust principles enforced (verify explicitly, least privilege, assume breach)
- [ ] All connections logged to ContextConsciousness for audit
- [ ] Secrets rotated on schedule (90-day maximum for tokens)

### Reliability Metrics

- [ ] 99.9% uptime for MCP server health endpoint
- [ ] < 5 second response time for tool invocations
- [ ] < 30 second response time for chain executions
- [ ] Zero credential-related deployment failures
- [ ] Graceful degradation when services unavailable

### Operational Metrics

- [ ] < 5 minutes to provision credentials for new environment
- [ ] < 10 minutes to rotate a service token with zero downtime
- [ ] < 1 hour to diagnose connection failures using ContextConsciousness logs
- [ ] 100% of credential expirations detected 14+ days in advance

---

## Appendix A: Credential Reference

### Service Token Format

ChittyOS service tokens follow this format:

```
{service}_{type}_{hash}

Examples:
- mcp_auth_9b69455f5f799a73f16484eb268aea50
- chittymcp_service_a1b2c3d4e5f6789012345678
```

### Token Validation

All service tokens are validated using this flow:

1. Extract token from `Authorization: Bearer {token}` header
2. Hash token with SHA-256
3. Lookup hash in `api_tokens` table (shared ChittyOS database)
4. Verify token status is `active`
5. Verify token has not expired
6. Verify token scopes match requested operation
7. Log successful/failed validation to `audit_logs` table

### Scope Naming Convention

```
{service}:{action}

Examples:
- chittyid:mint
- chittyid:validate
- chittyauth:oauth
- chittyrouter:route
- chittyregistry:register
- chittyregistry:query
```

---

## Appendix B: Service Endpoint Reference

### ChittyID Endpoints

```
POST   /api/v2/chittyid/mint          Generate new ChittyID
GET    /api/v2/chittyid/validate/{id} Validate ChittyID format
GET    /health                        Service health check
GET    /api/v1/status                 Detailed service status
```

### ChittyAuth Endpoints

```
POST   /api/v2/tokens/mint            Generate service token
POST   /api/v2/oauth/authorize        OAuth authorization
POST   /api/v2/oauth/token            OAuth token exchange
POST   /api/v2/oauth/revoke           Revoke token
GET    /health                        Service health check
```

### ChittyRouter Endpoints

```
POST   /api/v2/route                  Route MCP request to service
POST   /api/v2/analyze                Analyze request routing
GET    /health                        Service health check
```

### ChittyRegistry Endpoints

```
POST   /api/v1/register               Register service
GET    /api/v1/services               List all services
GET    /api/v1/services/{name}        Get service details
PUT    /api/v1/services/{name}/health Update health status
```

---

## Appendix C: Error Handling

### Connection Error Codes

| Code | Description | Mitigation |
|------|-------------|------------|
| `MISSING_CREDENTIAL` | Required token not found | Check 1Password vault and Cloudflare secrets |
| `HEALTH_CHECK_FAILED` | Service health check returned non-200 | Verify service is running, check service logs |
| `AUTHENTICATION_FAILED` | Service token rejected | Verify token is active and not expired, check scopes |
| `TIMEOUT` | Service did not respond within timeout | Check service performance, increase timeout if needed |
| `NETWORK_ERROR` | Network connectivity issue | Verify network connectivity, check DNS resolution |

### Error Response Format

```typescript
interface ChittyConnectError {
  code: string;
  message: string;
  service: string;
  endpoint: string;
  requestId: string;
  timestamp: string;
  details?: Record<string, any>;
}
```

---

**Document End**

For questions or updates to this strategy, contact the ChittyConnect Concierge or ChittyOS architecture team.
