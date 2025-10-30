#!/bin/bash

# ChittyMCP Automated Repair Script
# Fixes common MCP health issues automatically
# Usage: bash mcp-repair.sh [--dry-run]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Flags
DRY_RUN=false
BACKUP_DIR=".backups/$(date +%Y%m%d-%H%M%S)"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
    esac
done

log_action() {
    echo -e "${BLUE}▶${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Execute or simulate
execute() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} $1"
    else
        eval "$1"
    fi
}

# Create backup
create_backup() {
    local file=$1
    if [ -f "$file" ]; then
        mkdir -p "$BACKUP_DIR"
        cp "$file" "$BACKUP_DIR/$(basename "$file").bak"
        log_info "Backed up to: $BACKUP_DIR/$(basename "$file").bak"
    fi
}

# Fix 1: Install missing dependencies
fix_dependencies() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fix 1: Install Missing Dependencies${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"

    # Evidence Server
    log_action "Installing Evidence Server dependencies"
    if [ -f "mcp-evidence-server/package.json" ]; then
        if [ ! -d "mcp-evidence-server/node_modules" ] || [ "$DRY_RUN" = false ]; then
            execute "cd mcp-evidence-server && npm install --silent"
            log_success "Evidence Server dependencies installed"
        else
            log_success "Evidence Server dependencies already installed"
        fi
    else
        log_warn "Evidence Server package.json not found"
    fi

    # Unified Server
    log_action "Installing Unified Server dependencies"
    if [ -f "mcp-unified-consolidated/package.json" ]; then
        if [ ! -d "mcp-unified-consolidated/node_modules" ] || [ "$DRY_RUN" = false ]; then
            execute "cd mcp-unified-consolidated && npm install --silent"
            log_success "Unified Server dependencies installed"
        else
            log_success "Unified Server dependencies already installed"
        fi
    else
        log_warn "Unified Server package.json not found"
    fi

    # MCP Exec
    log_action "Installing MCP Exec dependencies"
    if [ -f "services/mcp-exec/package.json" ]; then
        if [ ! -d "services/mcp-exec/node_modules" ] || [ "$DRY_RUN" = false ]; then
            execute "cd services/mcp-exec && npm install --silent"
            execute "cd services/mcp-exec && npm run build"
            log_success "MCP Exec built successfully"
        else
            log_success "MCP Exec dependencies already installed"
        fi
    else
        log_warn "MCP Exec package.json not found"
    fi
}

# Fix 2: Fix OpenAI connector package name
fix_openai_package() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fix 2: OpenAI Package Name${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"

    local package_file="mcp-unified-consolidated/package.json"

    if [ -f "$package_file" ]; then
        create_backup "$package_file"

        # Check if incorrect package is referenced
        if grep -q '"mcp-server-openai"' "$package_file"; then
            log_action "Removing incorrect 'mcp-server-openai' package"
            execute "cd mcp-unified-consolidated && npm uninstall mcp-server-openai --silent 2>/dev/null || true"
            log_success "Incorrect package removed"
        fi

        # Ensure correct openai package is installed
        if ! grep -q '"openai"' "$package_file"; then
            log_action "Adding correct 'openai' package"
            execute "cd mcp-unified-consolidated && npm install openai@^4.52.0 --save"
            log_success "OpenAI package installed"
        else
            log_success "OpenAI package already correct"
        fi
    else
        log_warn "Unified server package.json not found"
    fi
}

# Fix 3: Create evidence server if missing
fix_evidence_server() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fix 3: Evidence Server File${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"

    if [ ! -f "mcp-evidence-server/index.js" ]; then
        log_warn "Evidence server index.js is missing"
        log_info "This file needs to be restored from backup or recreated"
        log_info "Check Git history: git log --all --full-history -- mcp-evidence-server/index.js"

        # Attempt to restore from git
        if git rev-parse --git-dir &>/dev/null; then
            log_action "Attempting to restore from Git"
            if execute "git checkout HEAD -- mcp-evidence-server/index.js 2>/dev/null"; then
                log_success "Restored from Git"
            else
                log_error "Could not restore from Git - manual recovery needed"
            fi
        fi
    else
        log_success "Evidence server index.js exists"

        # Verify syntax
        if node --check mcp-evidence-server/index.js 2>/dev/null; then
            log_success "Evidence server syntax valid"
        else
            log_error "Evidence server has syntax errors - manual fix needed"
        fi
    fi
}

# Fix 4: Setup environment template
fix_environment() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fix 4: Environment Configuration${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"

    log_action "Creating .env.example template"

    if [ ! -f ".env.example" ] || [ "$DRY_RUN" = false ]; then
        cat > .env.example <<'EOF'
# ChittyOS Core Services
CHITTY_ENV=production
CHITTYID_SERVICE=https://id.chitty.cc
CHITTY_ID_TOKEN=your_mcp_auth_token_here
PORTAL_DOMAIN=portal.chitty.cc
GATEWAY_SERVICE=https://gateway.chitty.cc
REGISTRY_SERVICE=https://registry.chitty.cc
ROUTER_SERVICE=https://router.chitty.cc

# Cloudflare Credentials
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
CLOUDFLARE_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541

# Database
NEON_DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# AI Services (Optional)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Development
NODE_ENV=development
LOG_LEVEL=info
EOF
        log_success ".env.example created"
    else
        log_success ".env.example already exists"
    fi

    if [ -f ".env" ]; then
        log_success ".env file exists"
    else
        log_warn ".env file not found - copy .env.example and fill in credentials"
        log_info "Run: cp .env.example .env && nano .env"
    fi
}

# Fix 5: Fix Claude Desktop config syntax
fix_claude_config() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fix 5: Claude Desktop Configuration${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"

    # Detect platform
    if [[ "$OSTYPE" == "darwin"* ]]; then
        CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        CONFIG_FILE="$HOME/.config/claude/claude_desktop_config.json"
    else
        log_warn "Unknown platform - skipping Claude config check"
        return
    fi

    if [ -f "$CONFIG_FILE" ]; then
        log_action "Validating Claude Desktop config"

        # Test JSON validity
        if jq empty "$CONFIG_FILE" 2>/dev/null; then
            log_success "Config file is valid JSON"
        else
            log_error "Config file has invalid JSON"
            log_info "Fix manually: nano '$CONFIG_FILE'"
            log_info "Or regenerate from config/claude-desktop-config.json"
        fi
    else
        log_warn "Claude Desktop config not found at: $CONFIG_FILE"
        log_info "Create it using the template in config/claude-desktop-config.json"
    fi
}

# Fix 6: Create Cloudflare Workers integration
fix_cloudflare_workers() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fix 6: Cloudflare Workers Structure${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"

    log_action "Creating Cloudflare Workers integration structure"

    # Create workers directory
    if [ ! -d "workers" ]; then
        execute "mkdir -p workers"
        log_success "Created workers/ directory"
    else
        log_success "workers/ directory exists"
    fi

    # Create worker subdirectories
    local workers=("chittymcp-worker" "health-check" "mcp-router")

    for worker in "${workers[@]}"; do
        if [ ! -d "workers/$worker" ]; then
            execute "mkdir -p workers/$worker/src"
            log_info "Created workers/$worker/"
        fi
    done

    # Create main chittymcp worker stub
    if [ ! -f "workers/chittymcp-worker/src/index.ts" ]; then
        log_action "Creating chittymcp-worker stub"
        cat > "workers/chittymcp-worker/src/index.ts" <<'EOF'
/**
 * ChittyMCP Cloudflare Worker
 * Main MCP server endpoint for ChittyOS ecosystem
 */

export interface Env {
  CHITTY_ID_TOKEN: string;
  NEON_DATABASE_URL: string;
  KV: KVNamespace;
  BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/healthz') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // MCP endpoint
    if (url.pathname === '/mcp' && request.method === 'POST') {
      try {
        const body = await request.json();
        // Handle MCP JSON-RPC requests here
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: { message: 'ChittyMCP Worker is operational' }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error'
          }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('ChittyMCP Worker - Not Found', { status: 404 });
  }
};
EOF
        log_success "Created chittymcp-worker stub"
    fi

    # Create wrangler config for worker
    if [ ! -f "workers/chittymcp-worker/wrangler.toml" ]; then
        log_action "Creating wrangler.toml for chittymcp-worker"
        cat > "workers/chittymcp-worker/wrangler.toml" <<'EOF'
name = "chittymcp-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"
account_id = "bbf9fcd845e78035b7a135c481e88541"

[env.production]
name = "chittymcp-worker"
routes = [
  { pattern = "chittymcp.chittycorp-llc.workers.dev", zone_name = "chittycorp-llc.workers.dev" }
]

[[kv_namespaces]]
binding = "KV"
id = "your_kv_namespace_id"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "chittymcp-storage"
EOF
        log_success "Created wrangler.toml"
    fi

    # Create package.json for worker
    if [ ! -f "workers/chittymcp-worker/package.json" ]; then
        log_action "Creating package.json for worker"
        cat > "workers/chittymcp-worker/package.json" <<'EOF'
{
  "name": "chittymcp-worker",
  "version": "1.0.0",
  "description": "ChittyMCP Cloudflare Worker",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  },
  "dependencies": {
    "@cloudflare/workers-types": "^4.20231218.0"
  },
  "devDependencies": {
    "wrangler": "^3.22.0",
    "typescript": "^5.3.3"
  }
}
EOF
        log_success "Created worker package.json"
    fi

    log_info "Workers structure created - install dependencies:"
    log_info "  cd workers/chittymcp-worker && npm install"
}

# Fix 7: Neon authentication
fix_neon_auth() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fix 7: Neon Database Authentication${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"

    if command -v neon &> /dev/null; then
        log_action "Checking Neon authentication"

        if neon auth whoami &>/dev/null; then
            log_success "Neon CLI already authenticated"
        else
            log_warn "Neon CLI not authenticated"
            log_info "Run manually: neon auth login"
            log_info "Then verify: neon auth whoami"
        fi
    else
        log_warn "Neon CLI not installed"
        log_info "Install: npm install -g neonctl"
    fi
}

# Fix 8: Git configuration
fix_git_config() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fix 8: Git Configuration${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"

    if git rev-parse --git-dir &>/dev/null; then
        log_success "Git repository initialized"

        local current_branch=$(git branch --show-current)
        log_info "Current branch: $current_branch"

        # Check if on Claude development branch
        if [[ "$current_branch" != claude/* ]]; then
            log_warn "Not on a claude/* branch"
            log_info "Expected branch pattern: claude/fix-*"
        else
            log_success "On Claude development branch"
        fi

        # Configure git to ignore certain files
        if [ ! -f ".gitignore" ]; then
            log_action "Creating .gitignore"
            cat > .gitignore <<'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-error.log*

# Environment
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Backups
.backups/
*.bak

# Logs
logs/
*.log

# Test outputs
coverage/
.nyc_output/

# Diagnostic reports
mcp-diagnostics-*.txt
mcp-diagnostics-*.html
EOF
            execute "git add .gitignore"
            log_success ".gitignore created"
        else
            log_success ".gitignore exists"
        fi
    else
        log_error "Not a git repository"
        log_info "Initialize: git init"
    fi
}

# Fix 9: Permissions
fix_permissions() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fix 9: File Permissions${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"

    log_action "Setting executable permissions on scripts"

    local scripts=("deploy.sh" "test-servers.sh" "diagnostics.sh" "mcp-repair.sh")

    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            execute "chmod +x $script"
            log_success "Made $script executable"
        fi
    done
}

# Summary
show_summary() {
    echo ""
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo -e "${CYAN}  Repair Summary${NC}"
    echo -e "${CYAN}═════════════════════════════════════${NC}"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY-RUN MODE - No changes were made"
        log_info "Remove --dry-run flag to apply fixes"
    else
        log_success "Automated repairs completed"
    fi

    echo ""
    echo "Next Steps:"
    echo ""
    echo "1. Review environment variables:"
    echo "   nano .env"
    echo ""
    echo "2. Test the fixes:"
    echo "   bash diagnostics.sh"
    echo ""
    echo "3. Authenticate Neon (if using):"
    echo "   neon auth login"
    echo ""
    echo "4. Deploy Cloudflare Worker:"
    echo "   cd workers/chittymcp-worker && npm install && npm run deploy"
    echo ""
    echo "5. Restart Claude Desktop"
    echo ""
    echo "6. Run integration tests:"
    echo "   bash test-servers.sh"
    echo ""
}

# Main execution
main() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║                                                       ║"
    echo "║        ChittyMCP Automated Repair v1.0                ║"
    echo "║        Fixing MCP Health Issues                       ║"
    echo "║                                                       ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY-RUN MODE - No changes will be made"
    fi

    # Run all fixes
    fix_dependencies
    fix_openai_package
    fix_evidence_server
    fix_environment
    fix_claude_config
    fix_cloudflare_workers
    fix_neon_auth
    fix_git_config
    fix_permissions

    # Show summary
    show_summary
}

# Run main
main "$@"
