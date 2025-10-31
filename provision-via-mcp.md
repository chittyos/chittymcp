# Provision ChittyMCP Portal via Cloudflare MCP

Instead of API scripts, use the Cloudflare MCP server to provision everything through MCP tools.

## Setup Cloudflare MCP Server

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-cloudflare"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "${CLOUDFLARE_API_TOKEN}",
        "CLOUDFLARE_ACCOUNT_ID": "bbf9fcd845e78035b7a135c481e88541"
      }
    }
  }
}
```

## Provision Using MCP Tools

### 1. Create Service Token

Use Cloudflare MCP tool:
```
Tool: cloudflare_create_service_token
Arguments:
{
  "name": "chittymcp-service-token",
  "duration": "8760h"
}
```

Save the returned `client_id` and `client_secret`.

### 2. Create Access Application

Use Cloudflare MCP tool:
```
Tool: cloudflare_create_access_application
Arguments:
{
  "name": "ChittyMCP Unified Portal",
  "domain": "mcp.chitty.cc",
  "type": "self_hosted",
  "session_duration": "24h",
  "cors_headers": {
    "enabled": true,
    "allowed_origins": ["*"],
    "allowed_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_credentials": true
  }
}
```

Save the returned `app_id`.

### 3. Add Service Token Policy

Use Cloudflare MCP tool:
```
Tool: cloudflare_add_access_policy
Arguments:
{
  "app_id": "<app_id_from_step_2>",
  "name": "ChittyMCP Service Token",
  "decision": "non_identity",
  "include": [{
    "service_token": {
      "token_id": "<token_id_from_step_1>"
    }
  }],
  "precedence": 1
}
```

### 4. Add User Email Policy

Use Cloudflare MCP tool:
```
Tool: cloudflare_add_access_policy
Arguments:
{
  "app_id": "<app_id_from_step_2>",
  "name": "ChittyMCP User Access",
  "decision": "allow",
  "include": [{
    "email": {
      "email": "<USER_EMAIL>"
    }
  }],
  "precedence": 2
}
```

### 5. Create DNS Record

Use Cloudflare MCP tool:
```
Tool: cloudflare_create_dns_record
Arguments:
{
  "zone_name": "chitty.cc",
  "type": "CNAME",
  "name": "mcp",
  "content": "bbf9fcd845e78035b7a135c481e88541.cloudflareaccess.com",
  "proxied": true
}
```

### 6. Deploy Worker

Use Cloudflare MCP tool:
```
Tool: cloudflare_deploy_worker
Arguments:
{
  "name": "chittymcp-worker",
  "script": "<worker_code>",
  "bindings": {
    "KV": "<kv_namespace_id>",
    "CHITTY_ID_TOKEN": "<token>"
  }
}
```

## Why This Is Better

✅ **No custom scripts** - Use standard MCP tools
✅ **Composable** - Chain tools together
✅ **Auditable** - All actions via MCP protocol
✅ **Reusable** - Works across all MCP clients
✅ **Documented** - Tool schemas are self-describing

## Alternative: ChittyConnect as MCP Orchestrator

ChittyConnect could be an MCP server that orchestrates other MCP servers:

```javascript
// ChittyConnect MCP Server
{
  name: "provision_mcp_portal",
  async handler(args) {
    // 1. Call Cloudflare MCP to create service token
    const token = await callMCP("cloudflare", "create_service_token", {...});

    // 2. Call Cloudflare MCP to create access app
    const app = await callMCP("cloudflare", "create_access_application", {...});

    // 3. Call Cloudflare MCP to add policies
    await callMCP("cloudflare", "add_access_policy", {...});

    // 4. Call Cloudflare MCP to create DNS
    await callMCP("cloudflare", "create_dns_record", {...});

    return { portal_url, credentials };
  }
}
```

This way ChittyConnect is just an orchestration layer over existing MCP servers.

## Usage in Claude Desktop

```
User: "Provision the ChittyMCP portal on Cloudflare"

Claude: *Uses Cloudflare MCP tools to:*
  1. Create service token
  2. Create Access application
  3. Add policies
  4. Create DNS record
  5. Deploy worker

  ✅ Done! Portal at https://mcp.chitty.cc
```

No bash scripts needed!
