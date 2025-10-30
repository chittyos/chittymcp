#!/bin/bash

# Create Cloudflare MCP Portal via API
# Automates MCP portal creation, service token generation, and access policies

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check required variables
if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo -e "${RED}Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID required${NC}"
    echo "Set them in .env file"
    exit 1
fi

API_TOKEN="$CLOUDFLARE_API_TOKEN"
ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID"
BASE_URL="https://api.cloudflare.com/client/v4"

# Configuration
PORTAL_NAME="ChittyMCP Unified Portal"
PORTAL_DOMAIN="mcp.chitty.cc"  # Change if needed
USER_EMAIL="${USER_EMAIL:-<USER_EMAIL>}"

echo -e "${GREEN}Creating Cloudflare MCP Portal...${NC}"
echo "Account: $ACCOUNT_ID"
echo "Domain: $PORTAL_DOMAIN"
echo ""

# Step 1: Create Service Token
echo -e "${YELLOW}Step 1: Creating service token...${NC}"

SERVICE_TOKEN_RESPONSE=$(curl -s -X POST \
  "${BASE_URL}/accounts/${ACCOUNT_ID}/access/service_tokens" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "chittymcp-service-token",
    "duration": "8760h"
  }')

SERVICE_TOKEN_ID=$(echo "$SERVICE_TOKEN_RESPONSE" | jq -r '.result.id')
SERVICE_CLIENT_ID=$(echo "$SERVICE_TOKEN_RESPONSE" | jq -r '.result.client_id')
SERVICE_CLIENT_SECRET=$(echo "$SERVICE_TOKEN_RESPONSE" | jq -r '.result.client_secret')

if [ "$SERVICE_TOKEN_ID" = "null" ]; then
    echo -e "${RED}Failed to create service token${NC}"
    echo "$SERVICE_TOKEN_RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}✓ Service token created${NC}"
echo "  Client ID: $SERVICE_CLIENT_ID"
echo "  Client Secret: $SERVICE_CLIENT_SECRET"
echo ""
echo -e "${YELLOW}SAVE THESE CREDENTIALS - They won't be shown again!${NC}"
echo ""

# Save to .env file
if ! grep -q "CF_ACCESS_CLIENT_ID" .env 2>/dev/null; then
    cat >> .env <<EOF

# Cloudflare Access Service Token (generated $(date +%Y-%m-%d))
CF_ACCESS_CLIENT_ID=$SERVICE_CLIENT_ID
CF_ACCESS_CLIENT_SECRET=$SERVICE_CLIENT_SECRET
EOF
    echo -e "${GREEN}✓ Credentials saved to .env${NC}"
fi

# Step 2: Create Access Application (MCP Portal)
echo -e "${YELLOW}Step 2: Creating Access application...${NC}"

ACCESS_APP_RESPONSE=$(curl -s -X POST \
  "${BASE_URL}/accounts/${ACCOUNT_ID}/access/apps" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${PORTAL_NAME}\",
    \"domain\": \"${PORTAL_DOMAIN}\",
    \"type\": \"self_hosted\",
    \"session_duration\": \"24h\",
    \"auto_redirect_to_identity\": false,
    \"enable_binding_cookie\": false,
    \"custom_deny_url\": \"\",
    \"custom_deny_message\": \"Access denied to ChittyMCP portal\",
    \"logo_url\": \"\",
    \"skip_interstitial\": false,
    \"app_launcher_visible\": true,
    \"service_auth_401_redirect\": true,
    \"cors_headers\": {
      \"enabled\": true,
      \"allowed_origins\": [\"*\"],
      \"allowed_methods\": [\"GET\", \"POST\", \"PUT\", \"DELETE\", \"OPTIONS\"],
      \"allow_credentials\": true,
      \"max_age\": 3600
    }
  }")

APP_ID=$(echo "$ACCESS_APP_RESPONSE" | jq -r '.result.id')

if [ "$APP_ID" = "null" ]; then
    echo -e "${RED}Failed to create Access application${NC}"
    echo "$ACCESS_APP_RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}✓ Access application created${NC}"
echo "  Application ID: $APP_ID"
echo ""

# Step 3: Create Access Policy for Service Token
echo -e "${YELLOW}Step 3: Creating service token policy...${NC}"

SERVICE_POLICY_RESPONSE=$(curl -s -X POST \
  "${BASE_URL}/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ChittyMCP Service Token\",
    \"decision\": \"non_identity\",
    \"include\": [
      {
        \"service_token\": {
          \"token_id\": \"${SERVICE_TOKEN_ID}\"
        }
      }
    ],
    \"precedence\": 1
  }")

SERVICE_POLICY_ID=$(echo "$SERVICE_POLICY_RESPONSE" | jq -r '.result.id')

if [ "$SERVICE_POLICY_ID" = "null" ]; then
    echo -e "${RED}Failed to create service token policy${NC}"
    echo "$SERVICE_POLICY_RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}✓ Service token policy created${NC}"
echo "  Policy ID: $SERVICE_POLICY_ID"
echo ""

# Step 4: Create Access Policy for User Email
echo -e "${YELLOW}Step 4: Creating user email policy...${NC}"

USER_POLICY_RESPONSE=$(curl -s -X POST \
  "${BASE_URL}/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ChittyMCP User Access\",
    \"decision\": \"allow\",
    \"include\": [
      {
        \"email\": {
          \"email\": \"${USER_EMAIL}\"
        }
      }
    ],
    \"precedence\": 2
  }")

USER_POLICY_ID=$(echo "$USER_POLICY_RESPONSE" | jq -r '.result.id')

if [ "$USER_POLICY_ID" = "null" ]; then
    echo -e "${RED}Failed to create user policy${NC}"
    echo "$USER_POLICY_RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}✓ User email policy created${NC}"
echo "  Policy ID: $USER_POLICY_ID"
echo ""

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  MCP Portal Created Successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "Portal URL: https://${PORTAL_DOMAIN}"
echo "Application ID: $APP_ID"
echo ""
echo "Service Token (for MCP servers):"
echo "  Client ID: $SERVICE_CLIENT_ID"
echo "  Client Secret: $SERVICE_CLIENT_SECRET"
echo ""
echo "User Access:"
echo "  Email: $USER_EMAIL"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Add DNS record for ${PORTAL_DOMAIN}:"
echo "   Type: CNAME"
echo "   Name: mcp"
echo "   Target: ${ACCOUNT_ID}.cloudflareaccess.com"
echo ""
echo "2. Update your MCP servers to use the portal:"
echo "   MCP_PORTAL_URL=https://${PORTAL_DOMAIN}"
echo "   CF_ACCESS_CLIENT_ID=${SERVICE_CLIENT_ID}"
echo "   CF_ACCESS_CLIENT_SECRET=${SERVICE_CLIENT_SECRET}"
echo ""
echo "3. Test the portal:"
echo "   curl -H \"CF-Access-Client-Id: ${SERVICE_CLIENT_ID}\" \\"
echo "        -H \"CF-Access-Client-Secret: ${SERVICE_CLIENT_SECRET}\" \\"
echo "        https://${PORTAL_DOMAIN}/health"
echo ""
echo "4. View in dashboard:"
echo "   https://one.dash.cloudflare.com/${ACCOUNT_ID}/access/apps/${APP_ID}"
echo ""
