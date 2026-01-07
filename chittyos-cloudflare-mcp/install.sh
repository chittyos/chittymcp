#!/bin/bash

# ChittyOS Cloudflare MCP Installation Script
# Automated setup for Claude Desktop integration

set -e

COLORS=(
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m' # No Color
)

# Print colored messages
print_message() {
    local color=$1
    local message=$2
    echo -e "${!color}${message}${NC}"
}

print_header() {
    print_message "BOLD" "\n========================================"
    print_message "BOLD" "🚀 ChittyOS Cloudflare MCP Installer"
    print_message "BOLD" "🏛️ AI-Driven Legal Tech Infrastructure"
    print_message "BOLD" "========================================\n"
}

print_header

# 1. Check Python installation
print_message "BLUE" "[1/6] Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d" " -f2)
    print_message "GREEN" "✅ Python $PYTHON_VERSION found"
else
    print_message "RED" "❌ Python3 not found. Please install Python 3.9 or later."
    exit 1
fi

# 2. Create virtual environment
print_message "BLUE" "\n[2/6] Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_message "GREEN" "✅ Virtual environment created"
else
    print_message "YELLOW" "⚠️  Virtual environment already exists"
fi

# 3. Install dependencies
print_message "BLUE" "\n[3/6] Installing Python dependencies..."
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
print_message "GREEN" "✅ Dependencies installed"

# 4. Configure Cloudflare credentials
print_message "BLUE" "\n[4/6] Configuring Cloudflare credentials..."

if [ -f ".env" ]; then
    print_message "YELLOW" "⚠️  .env file already exists. Skipping credential setup."
else
    print_message "YELLOW" "Please enter your Cloudflare credentials:"
    
    read -p "Cloudflare API Token: " CF_TOKEN
    read -p "Cloudflare Account ID: " CF_ACCOUNT
    read -p "Cloudflare Zone ID (optional): " CF_ZONE
    
    cat > .env << EOF
# Cloudflare Configuration
CLOUDFLARE_API_TOKEN=$CF_TOKEN
CLOUDFLARE_ACCOUNT_ID=$CF_ACCOUNT
CLOUDFLARE_ZONE_ID=$CF_ZONE

# ChittyOS Ecosystem Integration (optional)
CHITTY_CASE_DB_URL=https://cases.chitty.cc/api
CHITTY_CHAIN_RPC=https://chain.chitty.cc/rpc
CHITTY_VERIFY_ENDPOINT=https://verify.chitty.cc/api
CHITTY_TRUST_API=https://trust.chitty.cc/api
EOF
    
    print_message "GREEN" "✅ Configuration saved to .env"
fi

# 5. Setup Claude Desktop configuration
print_message "BLUE" "\n[5/6] Setting up Claude Desktop configuration..."

CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    print_message "YELLOW" "⚠️  Claude Desktop config directory not found."
    print_message "YELLOW" "   Please ensure Claude Desktop is installed."
    CLAUDE_CONFIG_DIR="./claude-config"
    mkdir -p "$CLAUDE_CONFIG_DIR"
    print_message "YELLOW" "   Created local config at: $CLAUDE_CONFIG_DIR"
fi

# Create claude_desktop_config.json
CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

if [ -f "$CONFIG_FILE" ]; then
    print_message "YELLOW" "⚠️  Claude Desktop config already exists."
    print_message "YELLOW" "   Please manually add the ChittyOS MCP server to:"
    print_message "YELLOW" "   $CONFIG_FILE"
else
    cat > "$CONFIG_FILE" << 'EOF'
{
  "mcpServers": {
    "chittyos-cloudflare": {
      "command": "bash",
      "args": [
        "-c",
        "source /Users/nb/.claude/tools/chittyos-cloudflare-mcp/venv/bin/activate && python /Users/nb/.claude/tools/chittyos-cloudflare-mcp/server.py"
      ],
      "env": {
        "CLOUDFLARE_API_TOKEN": "${CLOUDFLARE_API_TOKEN}",
        "CLOUDFLARE_ACCOUNT_ID": "${CLOUDFLARE_ACCOUNT_ID}",
        "CLOUDFLARE_ZONE_ID": "${CLOUDFLARE_ZONE_ID}",
        "CHITTY_CASE_DB_URL": "https://cases.chitty.cc/api",
        "CHITTY_CHAIN_RPC": "https://chain.chitty.cc/rpc",
        "CHITTY_VERIFY_ENDPOINT": "https://verify.chitty.cc/api",
        "CHITTY_TRUST_API": "https://trust.chitty.cc/api"
      }
    }
  }
}
EOF
    print_message "GREEN" "✅ Claude Desktop configuration created"
fi

# 6. Test the installation
print_message "BLUE" "\n[6/6] Testing installation..."
source venv/bin/activate
export $(cat .env | xargs) 2>/dev/null || true
python3 test-connection.py

# Final instructions
print_message "BOLD" "\n========================================"
print_message "GREEN" "🎉 Installation Complete!"
print_message "BOLD" "========================================\n"

print_message "YELLOW" "Next Steps:"
print_message "WHITE" "1. Restart Claude Desktop to load the MCP server"
print_message "WHITE" "2. Test with: 'Deploy a test worker for CASE-2024-TEST-001'"
print_message "WHITE" "3. View logs: tail -f ~/.claude/logs/mcp.log"

print_message "BLUE" "\n📚 Documentation: https://docs.chitty.cc/cloudflare-mcp"
print_message "BLUE" "🐛 Issues: https://github.com/chittyos/cloudflare-mcp/issues"

print_message "GREEN" "\n✨ ChittyOS: Empowering Legal Professionals with AI Infrastructure"
print_message "YELLOW" "💡 'We're not replacing lawyers - we're creating informed clients'\n"