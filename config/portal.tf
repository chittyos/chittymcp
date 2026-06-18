resource "cloudflare_zero_trust_access_mcp_server_portal" "chittymcp_portal" {
  account_id = var.cloudflare_account_id
  name       = "ChittyOS MCP Portal"
  hostname   = "mcp.chitty.cc"
}

resource "cloudflare_dns_record" "mcp_portal_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "mcp"
  content = "gateway.agents.cloudflare.com"
  type    = "CNAME"
  proxied = true
}
