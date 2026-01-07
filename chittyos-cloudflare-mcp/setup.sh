#!/bin/bash

# ChittyOS Cloudflare MCP Setup Script
# Installs and configures the Cloudflare infrastructure connector

set -e

echo "🚀 ChittyOS Cloudflare MCP Setup"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python version
echo -e "${BLUE}Checking Python version...${NC}"
PYTHON_VERSION=$(python3 --version | cut -d ' ' -f 2 | cut -d '.' -f 1,2)
REQUIRED_VERSION="3.9"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}Error: Python 3.9+ required (found $PYTHON_VERSION)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python version check passed${NC}"

# Create virtual environment
echo -e "${BLUE}Creating Python virtual environment...${NC}"
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    cp .env.template .env
    echo -e "${YELLOW}Please edit .env file with your Cloudflare credentials${NC}"
fi

# Make server executable
chmod +x server.py

# Create Claude Desktop config
CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

if [ -f "$CLAUDE_CONFIG" ]; then
    echo -e "${YELLOW}Found existing Claude Desktop config${NC}"
    echo "Add this to your mcpServers section:"
else
    echo -e "${BLUE}Creating Claude Desktop config...${NC}"
    mkdir -p "$(dirname "$CLAUDE_CONFIG")"
    cat > "$CLAUDE_CONFIG" <<EOF
{
  "mcpServers": {
    "cloudflare-chitty": {
      "command": "python3",
      "args": ["$PWD/server.py"],
      "env": {
        "PYTHONPATH": "$PWD"
      }
    }
  }
}
EOF
    echo -e "${GREEN}✓ Created Claude Desktop config${NC}"
fi

# Display configuration
echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "MCP Server Configuration:"
echo "------------------------"
cat <<EOF
{
  "cloudflare-chitty": {
    "command": "python3",
    "args": ["$PWD/server.py"],
    "env": {
      "PYTHONPATH": "$PWD"
    }
  }
}
EOF

echo ""
echo -e "${BLUE}Testing server connection...${NC}"

# Test import
python3 -c "from server import CloudflareChittyMCP; print('✅ Server module loaded successfully')" || echo -e "${RED}Failed to load server module${NC}"

echo ""
echo -e "${GREEN}✅ ChittyOS Cloudflare MCP is ready!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Cloudflare credentials:"
echo "   ${YELLOW}nano .env${NC}"
echo ""
echo "2. Get your Cloudflare API Token:"
echo "   - Go to: https://dash.cloudflare.com/profile/api-tokens"
echo "   - Create Token with Workers, R2, D1, and KV permissions"
echo ""
echo "3. Get your Account ID:"
echo "   - Go to: https://dash.cloudflare.com/"
echo "   - Copy from right sidebar"
echo ""
echo "4. Restart Claude Desktop to load the MCP server"
echo ""
echo "Available tools:"
echo "  • chitty_deploy_worker"
echo "  • chitty_list_workers"
echo "  • chitty_create_r2_bucket"
echo "  • chitty_create_d1_database"
echo "  • chitty_query_d1_database"
echo "  • chitty_create_kv_namespace"
echo ""
echo "ChittyOS Integration:"
echo "  • All resources linked to legal cases"
echo "  • Full audit trail and compliance tracking"
echo "  • Automatic metadata injection"