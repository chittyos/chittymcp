#!/usr/bin/env python3
import os
import sys
import time
import requests

# Load Cloudflare API Configuration
CF_EMAIL = os.getenv("CLOUDFLARE_EMAIL")
CF_API_KEY = os.getenv("CLOUDFLARE_API_KEY")
CF_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")

if not CF_EMAIL or not CF_API_KEY or not CF_ACCOUNT_ID:
    print("Error: CLOUDFLARE_EMAIL, CLOUDFLARE_API_KEY, and CLOUDFLARE_ACCOUNT_ID environment variables must be set.")
    sys.exit(1)

BASE_URL = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/access/ai-controls/mcp"
HEADERS = {
    "X-Auth-Email": CF_EMAIL,
    "X-Auth-Key": CF_API_KEY,
    "Content-Type": "application/json"
}

# The 37 standardized short-ID servers
SERVERS_TO_ALIGN = [
    "alchemist", "auth", "autoassist", "bluebubbles", "canon", "chatgpt", "cleaner",
    "cloudflare", "comptroller", "contextual", "dispatch", "dispute", "evidence",
    "finance", "gam", "git", "google", "helper", "human-escalator", "imessage", "market",
    "mcp-builder", "neon", "notes", "notion", "orchestrator", "quo", "resolve",
    "sandbox", "schema", "scrape", "ship", "storage", "tasks", "twilio", "viewport", "ai"
]

def get_server_name(server_id):
    name_map = {
        "ai": "AI",
        "chatgpt": "ChatGPT",
        "cloudflare": "Cloudflare",
        "imessage": "iMessage",
        "mcp-builder": "MCP Builder",
        "human-escalator": "Human Escalator",
    }
    if server_id in name_map:
        return name_map[server_id]
    
    # Capitalize parts
    parts = server_id.split("-")
    return " ".join(part.capitalize() for part in parts)

def fetch_existing_servers():
    print("Fetching existing MCP servers from Cloudflare registry...")
    url = f"{BASE_URL}/servers?per_page=100"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        raise Exception(f"Failed to fetch servers: {data.get('errors')}")
    return data.get("result", [])

def delete_server(server_id):
    print(f"Deleting server '{server_id}'...")
    url = f"{BASE_URL}/servers/{server_id}"
    r = requests.delete(url, headers=HEADERS)
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        raise Exception(f"Failed to delete server '{server_id}': {data.get('errors')}")
    print(f"✓ Deleted '{server_id}'")

def create_server(server_id, name, hostname):
    print(f"Registering server '{server_id}' pointing to {hostname}...")
    url = f"{BASE_URL}/servers"
    payload = {
        "id": server_id,
        "name": name,
        "hostname": hostname,
        "auth_type": "unauthenticated"
    }
    r = requests.post(url, headers=HEADERS, json=payload)
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        raise Exception(f"Failed to create server '{server_id}': {data.get('errors')}")
    print(f"✓ Registered '{server_id}'")

def update_primary_portal(server_ids):
    portal_id = "chitty-mcp"
    print(f"Updating MCP server portal '{portal_id}' to link {len(server_ids)} servers...")
    url = f"{BASE_URL}/portals/{portal_id}"
    payload = {
        "name": "ChittyMCP",
        "servers": [{"server_id": sid} for sid in server_ids]
    }
    r = requests.put(url, headers=HEADERS, json=payload)
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        raise Exception(f"Failed to update portal '{portal_id}': {data.get('errors')}")
    print(f"✓ Portal '{portal_id}' successfully updated!")

def sync_server(server_id):
    print(f"Triggering tool discovery sync for '{server_id}'...")
    url = f"{BASE_URL}/servers/{server_id}/sync"
    r = requests.post(url, headers=HEADERS)
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        print(f"⚠ Warning: Sync failed for '{server_id}': {data.get('errors')}")
        return False
    print(f"✓ Synced '{server_id}' (Status: {data.get('result', {}).get('status')})")
    return True

def main():
    print("====================================================")
    print("   Cloudflare Access MCP Registry Portal Cleanup    ")
    print("====================================================")
    
    # 1. Fetch current servers
    existing_servers = fetch_existing_servers()
    existing_map = {s["id"]: s for s in existing_servers}
    print(f"Found {len(existing_servers)} servers currently in the registry.")
    
    # 2. Register/update the 36 short-ID servers
    aligned_ids = []
    for sid in SERVERS_TO_ALIGN:
        desired_name = get_server_name(sid)
        desired_hostname = f"https://agent.chitty.cc/{sid}/mcp"
        aligned_ids.append(sid)
        
        if sid in existing_map:
            current = existing_map[sid]
            # If endpoint is already correct, do nothing
            if current["hostname"] == desired_hostname:
                print(f"Server '{sid}' is already configured correctly.")
                continue
            
            # Hostname is immutable; must delete and recreate
            print(f"Server '{sid}' has outdated hostname '{current['hostname']}'. Re-creating...")
            delete_server(sid)
            create_server(sid, desired_name, desired_hostname)
        else:
            create_server(sid, desired_name, desired_hostname)
            
    # 3. Update the portal to link exactly the 36 servers
    update_primary_portal(aligned_ids)
    
    # 4. Trigger sync for each server
    print("\nTriggering discovery syncs for all aligned servers...")
    for sid in aligned_ids:
        sync_server(sid)
        
    # 5. Purge legacy long-ID servers
    print("\nPurging legacy and duplicate long-ID servers...")
    stale_ids = {"chitty-evidence", "chitty-market", "chittymcp-aggregator", "build", "chode", "foundation-agent", "monitor", "ch1tty"}
    for s in existing_servers:
        sid = s["id"]
        # Match legacy long IDs or specific stale IDs
        if (sid.startswith("chittyagent-") or 
            sid.startswith("chitty-agent-") or 
            sid == "chittyagent-ui" or 
            sid in stale_ids):
            # Guard against deleting aligned short IDs (none of which start with chittyagent- or are in stale_ids)
            if sid not in SERVERS_TO_ALIGN:
                try:
                    delete_server(sid)
                except Exception as e:
                    print(f"⚠ Failed to delete legacy server '{sid}': {e}")
                    
    print("\n====================================================")
    print("✓ Cleanup and route alignment successfully completed!")
    print("====================================================")

if __name__ == "__main__":
    main()
