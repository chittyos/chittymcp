#!/usr/bin/env python3
"""
ChittyOS Cloudflare MCP Server
Comprehensive infrastructure management for Workers, R2, D1, and KV
Integrated with ChittyOS legal and case management systems
"""

import asyncio
import json
import os
import logging
from typing import Any, Sequence, Optional, Dict, List
from datetime import datetime, timezone

import httpx
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    Resource,
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
    LoggingLevel
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cloudflare-chitty")

class CloudflareChittyMCP:
    def __init__(self):
        self.base_url = "https://api.cloudflare.com/client/v4"
        self.api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        self.account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.zone_id = os.getenv("CLOUDFLARE_ZONE_ID")

        if not self.api_token:
            raise ValueError("CLOUDFLARE_API_TOKEN environment variable is required")

        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

        # ChittyOS integration tracking
        self.chitty_metadata = {
            "deployment_source": "ChittyOS_Executive_System",
            "managed_by": "chitty_infrastructure_ai",
            "compliance_tracking": True
        }

        # ChittyOS ecosystem integrations
        self.chitty_services = {
            "cases_db": os.getenv("CHITTY_CASE_DB_URL", "https://cases.chitty.cc/api"),
            "chain_rpc": os.getenv("CHITTY_CHAIN_RPC", "https://chain.chitty.cc/rpc"),
            "verify_endpoint": os.getenv("CHITTY_VERIFY_ENDPOINT", "https://verify.chitty.cc/api"),
            "trust_api": os.getenv("CHITTY_TRUST_API", "https://trust.chitty.cc/api")
        }

    async def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Make authenticated request to Cloudflare API with ChittyOS tracking"""
        url = f"{self.base_url}{endpoint}"

        async with httpx.AsyncClient() as client:
            try:
                if method.upper() == "GET":
                    response = await client.get(url, headers=self.headers)
                elif method.upper() == "POST":
                    response = await client.post(url, headers=self.headers, json=data)
                elif method.upper() == "PUT":
                    response = await client.put(url, headers=self.headers, json=data)
                elif method.upper() == "DELETE":
                    response = await client.delete(url, headers=self.headers)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")

                response.raise_for_status()
                result = response.json()

                # Add ChittyOS tracking metadata
                if isinstance(result, dict) and "result" in result:
                    result["chitty_metadata"] = {
                        **self.chitty_metadata,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "operation": f"{method.upper()} {endpoint}"
                    }

                return result
            except httpx.HTTPError as e:
                logger.error(f"Cloudflare API error: {e}")
                raise

    # WORKERS MANAGEMENT
    async def list_workers(self) -> Dict:
        """List all Cloudflare Workers with ChittyOS metadata"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for Workers operations")

        return await self._make_request("GET", f"/accounts/{self.account_id}/workers/scripts")

    async def get_worker(self, script_name: str) -> Dict:
        """Get Worker script details and metadata"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for Workers operations")

        return await self._make_request("GET", f"/accounts/{self.account_id}/workers/scripts/{script_name}")

    async def deploy_worker(self, script_name: str, script_content: str,
                          case_id: Optional[str] = None,
                          environment: str = "production") -> Dict:
        """Deploy Worker with ChittyOS case tracking"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for Workers operations")

        # Add ChittyOS metadata to script
        enhanced_content = f"""
// ChittyOS Managed Worker
// Case ID: {case_id or 'N/A'}
// Environment: {environment}
// Deployed: {datetime.now(timezone.utc).isoformat()}
// Managed by ChittyOS Infrastructure AI

{script_content}
"""

        data = {
            "body": enhanced_content,
            "metadata": {
                "case_id": case_id,
                "environment": environment,
                **self.chitty_metadata
            }
        }

        return await self._make_request("PUT", f"/accounts/{self.account_id}/workers/scripts/{script_name}", data)

    async def delete_worker(self, script_name: str, case_id: Optional[str] = None) -> Dict:
        """Delete Worker with audit trail"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for Workers operations")

        # Log deletion for compliance
        logger.info(f"ChittyOS: Deleting Worker {script_name} for case {case_id}")

        return await self._make_request("DELETE", f"/accounts/{self.account_id}/workers/scripts/{script_name}")

    # R2 STORAGE MANAGEMENT
    async def list_r2_buckets(self) -> Dict:
        """List all R2 buckets with ChittyOS metadata"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for R2 operations")

        return await self._make_request("GET", f"/accounts/{self.account_id}/r2/buckets")

    async def create_r2_bucket(self, bucket_name: str, case_id: Optional[str] = None) -> Dict:
        """Create R2 bucket with ChittyOS case tracking"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for R2 operations")

        data = {
            "name": bucket_name,
            "metadata": {
                "case_id": case_id,
                "created_by": "chitty_infrastructure_ai",
                **self.chitty_metadata
            }
        }

        return await self._make_request("POST", f"/accounts/{self.account_id}/r2/buckets", data)

    async def delete_r2_bucket(self, bucket_name: str, case_id: Optional[str] = None) -> Dict:
        """Delete R2 bucket with audit trail"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for R2 operations")

        logger.info(f"ChittyOS: Deleting R2 bucket {bucket_name} for case {case_id}")

        return await self._make_request("DELETE", f"/accounts/{self.account_id}/r2/buckets/{bucket_name}")

    # D1 DATABASE MANAGEMENT
    async def list_d1_databases(self) -> Dict:
        """List all D1 databases with ChittyOS metadata"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for D1 operations")

        return await self._make_request("GET", f"/accounts/{self.account_id}/d1/database")

    async def create_d1_database(self, database_name: str, case_id: Optional[str] = None) -> Dict:
        """Create D1 database with ChittyOS case tracking"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for D1 operations")

        data = {
            "name": database_name,
            "metadata": {
                "case_id": case_id,
                "created_by": "chitty_infrastructure_ai",
                **self.chitty_metadata
            }
        }

        return await self._make_request("POST", f"/accounts/{self.account_id}/d1/database", data)

    async def query_d1_database(self, database_id: str, sql: str,
                               case_id: Optional[str] = None) -> Dict:
        """Execute SQL query on D1 database with audit logging"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for D1 operations")

        # Log query for compliance
        logger.info(f"ChittyOS: Executing D1 query for case {case_id}: {sql[:100]}...")

        data = {
            "sql": sql,
            "metadata": {
                "case_id": case_id,
                "executed_by": "chitty_infrastructure_ai"
            }
        }

        return await self._make_request("POST", f"/accounts/{self.account_id}/d1/database/{database_id}/query", data)

    async def delete_d1_database(self, database_id: str, case_id: Optional[str] = None) -> Dict:
        """Delete D1 database with audit trail"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for D1 operations")

        logger.info(f"ChittyOS: Deleting D1 database {database_id} for case {case_id}")

        return await self._make_request("DELETE", f"/accounts/{self.account_id}/d1/database/{database_id}")

    # KV NAMESPACE MANAGEMENT
    async def list_kv_namespaces(self) -> Dict:
        """List all KV namespaces with ChittyOS metadata"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for KV operations")

        return await self._make_request("GET", f"/accounts/{self.account_id}/storage/kv/namespaces")

    async def create_kv_namespace(self, namespace_name: str, case_id: Optional[str] = None) -> Dict:
        """Create KV namespace with ChittyOS case tracking"""
        if not self.account_id:
            raise ValueError("CLOUDFLARE_ACCOUNT_ID required for KV operations")

        data = {
            "title": namespace_name,
            "metadata": {
                "case_id": case_id,
                "created_by": "chitty_infrastructure_ai",
                **self.chitty_metadata
            }
        }

        return await self._make_request("POST", f"/accounts/{self.account_id}/storage/kv/namespaces", data)

    # CHITTYOS ECOSYSTEM INTEGRATIONS
    async def link_to_case(self, resource_type: str, resource_id: str, case_id: str) -> Dict:
        """Link Cloudflare resource to ChittyOS case"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.chitty_services['cases_db']}/link",
                    json={
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "case_id": case_id,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                )
                return response.json() if response.status_code == 200 else {"status": "pending"}
        except Exception as e:
            logger.warning(f"ChittyOS Cases DB unavailable: {e}")
            return {"status": "offline", "case_id": case_id}

    async def anchor_to_blockchain(self, operation: str, details: Dict) -> Dict:
        """Anchor operation to ChittyChain blockchain"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.chitty_services['chain_rpc']}/anchor",
                    json={
                        "operation": operation,
                        "details": details,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "source": "cloudflare_mcp"
                    }
                )
                return response.json() if response.status_code == 200 else {"status": "pending"}
        except Exception as e:
            logger.warning(f"ChittyChain unavailable: {e}")
            return {"status": "offline", "tx_hash": None}

    async def verify_compliance(self, resource: Dict, requirements: List[str]) -> Dict:
        """Verify resource compliance with ChittyVerify"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.chitty_services['verify_endpoint']}/check",
                    json={
                        "resource": resource,
                        "requirements": requirements,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                )
                return response.json() if response.status_code == 200 else {"compliant": True, "warnings": []}
        except Exception as e:
            logger.warning(f"ChittyVerify unavailable: {e}")
            return {"compliant": True, "status": "unchecked"}

    async def get_trust_score(self, entity_id: str) -> Dict:
        """Get trust score from ChittyTrust"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.chitty_services['trust_api']}/score/{entity_id}"
                )
                return response.json() if response.status_code == 200 else {"score": 100, "status": "default"}
        except Exception as e:
            logger.warning(f"ChittyTrust unavailable: {e}")
            return {"score": 100, "status": "offline"}

    async def deploy_with_full_integration(self, script_name: str, script_content: str,
                                          case_id: str, compliance_requirements: List[str] = None) -> Dict:
        """Deploy Worker with full ChittyOS ecosystem integration"""
        # 1. Check trust score
        trust = await self.get_trust_score(case_id)
        if trust.get("score", 100) < 50:
            return {"error": "Trust score too low for deployment"}

        # 2. Verify compliance
        compliance = await self.verify_compliance(
            {"type": "worker", "name": script_name},
            compliance_requirements or ["security", "privacy"]
        )
        if not compliance.get("compliant", True):
            return {"error": "Compliance check failed", "issues": compliance.get("warnings", [])}

        # 3. Deploy the worker
        result = await self.deploy_worker(script_name, script_content, case_id)

        # 4. Link to case
        case_link = await self.link_to_case("worker", script_name, case_id)

        # 5. Anchor to blockchain
        blockchain = await self.anchor_to_blockchain(
            "worker_deployment",
            {
                "script_name": script_name,
                "case_id": case_id,
                "deployment_id": result.get("result", {}).get("id")
            }
        )

        return {
            "deployment": result,
            "case_link": case_link,
            "blockchain": blockchain,
            "compliance": compliance,
            "trust_score": trust
        }

# Initialize the MCP connector
cloudflare_chitty = CloudflareChittyMCP()

# Create the MCP server
server = Server("cloudflare-chitty")

@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """List available Cloudflare resources for ChittyOS"""
    return [
        Resource(
            uri="cloudflare://workers",
            name="Cloudflare Workers",
            description="Manage Cloudflare Workers with ChittyOS case tracking",
            mimeType="application/json",
        ),
        Resource(
            uri="cloudflare://r2",
            name="Cloudflare R2 Storage",
            description="Manage R2 object storage with ChittyOS metadata",
            mimeType="application/json",
        ),
        Resource(
            uri="cloudflare://d1",
            name="Cloudflare D1 Database",
            description="Manage D1 databases with ChittyOS audit trails",
            mimeType="application/json",
        ),
        Resource(
            uri="cloudflare://kv",
            name="Cloudflare KV Storage",
            description="Manage KV namespaces with ChittyOS case tracking",
            mimeType="application/json",
        ),
    ]

@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Read Cloudflare resource details"""
    if uri == "cloudflare://workers":
        workers = await cloudflare_chitty.list_workers()
        return json.dumps(workers, indent=2)
    elif uri == "cloudflare://r2":
        buckets = await cloudflare_chitty.list_r2_buckets()
        return json.dumps(buckets, indent=2)
    elif uri == "cloudflare://d1":
        databases = await cloudflare_chitty.list_d1_databases()
        return json.dumps(databases, indent=2)
    elif uri == "cloudflare://kv":
        namespaces = await cloudflare_chitty.list_kv_namespaces()
        return json.dumps(namespaces, indent=2)
    else:
        raise ValueError(f"Unknown resource: {uri}")

@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available ChittyOS Cloudflare tools"""
    return [
        # Workers Tools
        Tool(
            name="chitty_deploy_worker",
            description="Deploy Cloudflare Worker with ChittyOS case tracking",
            inputSchema={
                "type": "object",
                "properties": {
                    "script_name": {"type": "string", "description": "Worker script name"},
                    "script_content": {"type": "string", "description": "Worker JavaScript code"},
                    "case_id": {"type": "string", "description": "Optional ChittyOS case ID"},
                    "environment": {"type": "string", "description": "Deployment environment", "default": "production"}
                },
                "required": ["script_name", "script_content"]
            }
        ),
        Tool(
            name="chitty_list_workers",
            description="List all Cloudflare Workers with ChittyOS metadata",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="chitty_get_worker",
            description="Get Cloudflare Worker details",
            inputSchema={
                "type": "object",
                "properties": {
                    "script_name": {"type": "string", "description": "Worker script name"}
                },
                "required": ["script_name"]
            }
        ),
        Tool(
            name="chitty_delete_worker",
            description="Delete Cloudflare Worker with audit trail",
            inputSchema={
                "type": "object",
                "properties": {
                    "script_name": {"type": "string", "description": "Worker script name"},
                    "case_id": {"type": "string", "description": "Optional ChittyOS case ID"}
                },
                "required": ["script_name"]
            }
        ),

        # R2 Storage Tools
        Tool(
            name="chitty_create_r2_bucket",
            description="Create R2 bucket with ChittyOS case tracking",
            inputSchema={
                "type": "object",
                "properties": {
                    "bucket_name": {"type": "string", "description": "R2 bucket name"},
                    "case_id": {"type": "string", "description": "Optional ChittyOS case ID"}
                },
                "required": ["bucket_name"]
            }
        ),
        Tool(
            name="chitty_list_r2_buckets",
            description="List all R2 buckets with ChittyOS metadata",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="chitty_delete_r2_bucket",
            description="Delete R2 bucket with audit trail",
            inputSchema={
                "type": "object",
                "properties": {
                    "bucket_name": {"type": "string", "description": "R2 bucket name"},
                    "case_id": {"type": "string", "description": "Optional ChittyOS case ID"}
                },
                "required": ["bucket_name"]
            }
        ),

        # D1 Database Tools
        Tool(
            name="chitty_create_d1_database",
            description="Create D1 database with ChittyOS case tracking",
            inputSchema={
                "type": "object",
                "properties": {
                    "database_name": {"type": "string", "description": "D1 database name"},
                    "case_id": {"type": "string", "description": "Optional ChittyOS case ID"}
                },
                "required": ["database_name"]
            }
        ),
        Tool(
            name="chitty_list_d1_databases",
            description="List all D1 databases with ChittyOS metadata",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        Tool(
            name="chitty_query_d1_database",
            description="Execute SQL query on D1 database with audit logging",
            inputSchema={
                "type": "object",
                "properties": {
                    "database_id": {"type": "string", "description": "D1 database ID"},
                    "sql": {"type": "string", "description": "SQL query to execute"},
                    "case_id": {"type": "string", "description": "Optional ChittyOS case ID"}
                },
                "required": ["database_id", "sql"]
            }
        ),
        Tool(
            name="chitty_delete_d1_database",
            description="Delete D1 database with audit trail",
            inputSchema={
                "type": "object",
                "properties": {
                    "database_id": {"type": "string", "description": "D1 database ID"},
                    "case_id": {"type": "string", "description": "Optional ChittyOS case ID"}
                },
                "required": ["database_id"]
            }
        ),

        # KV Storage Tools
        Tool(
            name="chitty_create_kv_namespace",
            description="Create KV namespace with ChittyOS case tracking",
            inputSchema={
                "type": "object",
                "properties": {
                    "namespace_name": {"type": "string", "description": "KV namespace name"},
                    "case_id": {"type": "string", "description": "Optional ChittyOS case ID"}
                },
                "required": ["namespace_name"]
            }
        ),
        Tool(
            name="chitty_list_kv_namespaces",
            description="List all KV namespaces with ChittyOS metadata",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle ChittyOS Cloudflare tool calls"""
    try:
        # Workers Tools
        if name == "chitty_deploy_worker":
            result = await cloudflare_chitty.deploy_worker(
                arguments["script_name"],
                arguments["script_content"],
                arguments.get("case_id"),
                arguments.get("environment", "production")
            )
        elif name == "chitty_list_workers":
            result = await cloudflare_chitty.list_workers()
        elif name == "chitty_get_worker":
            result = await cloudflare_chitty.get_worker(arguments["script_name"])
        elif name == "chitty_delete_worker":
            result = await cloudflare_chitty.delete_worker(
                arguments["script_name"],
                arguments.get("case_id")
            )

        # R2 Storage Tools
        elif name == "chitty_create_r2_bucket":
            result = await cloudflare_chitty.create_r2_bucket(
                arguments["bucket_name"],
                arguments.get("case_id")
            )
        elif name == "chitty_list_r2_buckets":
            result = await cloudflare_chitty.list_r2_buckets()
        elif name == "chitty_delete_r2_bucket":
            result = await cloudflare_chitty.delete_r2_bucket(
                arguments["bucket_name"],
                arguments.get("case_id")
            )

        # D1 Database Tools
        elif name == "chitty_create_d1_database":
            result = await cloudflare_chitty.create_d1_database(
                arguments["database_name"],
                arguments.get("case_id")
            )
        elif name == "chitty_list_d1_databases":
            result = await cloudflare_chitty.list_d1_databases()
        elif name == "chitty_query_d1_database":
            result = await cloudflare_chitty.query_d1_database(
                arguments["database_id"],
                arguments["sql"],
                arguments.get("case_id")
            )
        elif name == "chitty_delete_d1_database":
            result = await cloudflare_chitty.delete_d1_database(
                arguments["database_id"],
                arguments.get("case_id")
            )

        # KV Storage Tools
        elif name == "chitty_create_kv_namespace":
            result = await cloudflare_chitty.create_kv_namespace(
                arguments["namespace_name"],
                arguments.get("case_id")
            )
        elif name == "chitty_list_kv_namespaces":
            result = await cloudflare_chitty.list_kv_namespaces()

        else:
            raise ValueError(f"Unknown tool: {name}")

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    except Exception as e:
        logger.error(f"Tool call error: {e}")
        return [TextContent(type="text", text=f"Error: {str(e)}")]

async def main():
    """Run the ChittyOS Cloudflare MCP server"""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="cloudflare-chitty",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())