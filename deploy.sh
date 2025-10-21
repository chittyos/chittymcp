#!/bin/bash

# ChittyMCP Deployment Script
# Deploys MCP servers to various targets

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 ChittyMCP Deployment Script${NC}"
echo "=============================="
echo ""

# Parse arguments
TARGET=${1:-"local"}

case $TARGET in
    "local")
        echo -e "${YELLOW}📦 Deploying to local environment${NC}"
        echo ""

        # Evidence server
        echo "1. Evidence Intake Server"
        cd mcp-evidence-server
        if [ ! -d "node_modules" ]; then
            echo "   Installing dependencies..."
            npm install
        fi
        echo -e "   ${GREEN}✓ Ready${NC}"
        echo ""

        # Unified server
        echo "2. Unified Consolidated Server"
        cd ../mcp-unified-consolidated
        if [ ! -d "node_modules" ]; then
            echo "   Installing dependencies..."
            npm install
        fi
        echo -e "   ${GREEN}✓ Ready${NC}"
        echo ""

        # Execution service
        echo "3. MCP Execution Service"
        cd ../services/mcp-exec
        if [ ! -d "node_modules" ]; then
            echo "   Installing dependencies..."
            npm install
        fi
        if [ ! -d "dist" ]; then
            echo "   Building TypeScript..."
            npm run build
        fi
        echo -e "   ${GREEN}✓ Ready${NC}"
        echo ""

        echo -e "${GREEN}✓ Local deployment complete!${NC}"
        echo ""
        echo "To configure Claude Desktop, add this to:"
        echo "~/Library/Application Support/Claude/claude_desktop_config.json"
        echo ""
        cat << 'EOF'
{
  "mcpServers": {
    "evidence-intake": {
      "command": "node",
      "args": ["$(pwd)/mcp-evidence-server/index.js"],
      "env": {}
    },
    "chittymcp-unified": {
      "command": "node",
      "args": ["$(pwd)/mcp-unified-consolidated/unified-server.js"],
      "env": {
        "CHITTY_ENV": "production",
        "CHITTYID_SERVICE": "https://id.chitty.cc"
      }
    },
    "mcp-exec": {
      "command": "node",
      "args": ["$(pwd)/services/mcp-exec/dist/index.js"],
      "env": {
        "CHITTYID_SERVICE": "https://id.chitty.cc"
      }
    }
  }
}
EOF
        ;;

    "cloudflare"|"cf")
        echo -e "${YELLOW}☁️  Deploying to Cloudflare Workers${NC}"
        echo ""

        # Check if wrangler is installed
        if ! command -v wrangler &> /dev/null; then
            echo -e "${RED}✗ Wrangler CLI not found${NC}"
            echo "Install with: npm install -g wrangler"
            exit 1
        fi

        # Check if logged in
        if ! wrangler whoami &> /dev/null; then
            echo "Logging in to Cloudflare..."
            wrangler login
        fi

        echo "Deploying unified server to Cloudflare Workers..."
        cd mcp-unified-consolidated

        # Install dependencies
        if [ ! -d "node_modules" ]; then
            npm install
        fi

        # Deploy
        cd ..
        wrangler deploy

        echo -e "${GREEN}✓ Cloudflare deployment complete!${NC}"
        echo ""
        echo "Access your MCP server at:"
        echo "https://chittymcp.chittycorp-llc.workers.dev"
        echo "https://mcp.chitty.cc (once DNS configured)"
        ;;

    "test")
        echo -e "${YELLOW}🧪 Running test suite${NC}"
        echo ""
        ./test-servers.sh
        ;;

    *)
        echo -e "${RED}Unknown deployment target: $TARGET${NC}"
        echo ""
        echo "Usage: ./deploy.sh [target]"
        echo ""
        echo "Targets:"
        echo "  local      - Deploy to local environment (default)"
        echo "  cloudflare - Deploy to Cloudflare Workers"
        echo "  test       - Run test suite"
        echo ""
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
