#!/bin/bash

# ChittyOS Executive MCP Setup Script
# Installs and configures the executive server

set -e

echo "🎯 ChittyOS Executive MCP Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo -e "${BLUE}Checking Node.js version...${NC}"
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required (found v$NODE_VERSION)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js version check passed${NC}"

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install

# Build TypeScript
echo -e "${BLUE}Building TypeScript files...${NC}"
npm run build

# Create Claude Desktop config if needed
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
    "chittyos-executive": {
      "command": "node",
      "args": ["$PWD/dist/executive-server.js"]
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
  "chittyos-executive": {
    "command": "node",
    "args": ["$PWD/dist/executive-server.js"]
  }
}
EOF

echo ""
echo -e "${BLUE}Testing server...${NC}"
timeout 2 node dist/executive-server.js 2>&1 | head -1 || true

echo ""
echo -e "${GREEN}✅ ChittyOS Executive MCP is ready!${NC}"
echo ""
echo "Next steps:"
echo "1. Restart Claude Desktop to load the MCP server"
echo "2. Use executive tools in your conversations"
echo "3. Monitor decisions across your ChittyOS ecosystem"
echo ""
echo "Available tools:"
echo "  • make_executive_decision"
echo "  • delegate_task"
echo "  • analyze_performance"
echo "  • strategic_planning"
echo "  • risk_assessment"