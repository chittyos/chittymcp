#!/bin/bash

# ChittyMCP System Diagnostics
# Comprehensive test suite for MCP health issues
# Usage: bash diagnostics.sh [--html] [--verbose]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Flags
VERBOSE=false
HTML_OUTPUT=false
REPORT_FILE="mcp-diagnostics-$(date +%Y%m%d-%H%M%S).txt"
HTML_FILE="mcp-diagnostics-$(date +%Y%m%d-%H%M%S).html"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --verbose) VERBOSE=true ;;
        --html) HTML_OUTPUT=true ;;
    esac
done

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Result arrays
declare -a RESULTS
declare -a ISSUES
declare -a FIXES

# Logging functions
log_section() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
}

log_test() {
    ((TOTAL_TESTS++))
    echo -e "${BLUE}▶${NC} $1"
}

log_pass() {
    ((PASSED_TESTS++))
    echo -e "${GREEN}✓${NC} $1"
    RESULTS+=("PASS: $1")
}

log_fail() {
    ((FAILED_TESTS++))
    echo -e "${RED}✗${NC} $1"
    RESULTS+=("FAIL: $1")
    if [ -n "$2" ]; then
        ISSUES+=("$1: $2")
        if [ -n "$3" ]; then
            FIXES+=("$1 → $3")
        fi
    fi
}

log_warn() {
    ((WARNINGS++))
    echo -e "${YELLOW}⚠${NC} $1"
    RESULTS+=("WARN: $1")
}

log_info() {
    echo -e "${MAGENTA}ℹ${NC} $1"
}

# Detect platform
detect_platform() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        PLATFORM="macOS"
        CONFIG_DIR="$HOME/Library/Application Support/Claude"
        LOG_DIR="$HOME/Library/Logs/Claude"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        PLATFORM="Linux"
        CONFIG_DIR="$HOME/.config/claude"
        LOG_DIR="$HOME/.local/share/claude/logs"
    else
        PLATFORM="Unknown"
    fi
}

# Test 1: Endpoint Verification
test_endpoints() {
    log_section "Endpoint Verification"

    # Cloudflare Docs MCP
    log_test "Testing Cloudflare Docs MCP endpoint"
    if timeout 10 curl -s -o /dev/null -w "%{http_code}" https://docs.mcp.cloudflare.com/ | grep -q "^[23]"; then
        log_pass "Cloudflare Docs MCP endpoint responding"
    else
        log_fail "Cloudflare Docs MCP endpoint failed" \
            "404 or timeout on https://docs.mcp.cloudflare.com/" \
            "Check DNS or update MCP client URL configuration"
    fi

    # ChittyOS Services
    log_test "Testing ChittyID service"
    if timeout 10 curl -s -o /dev/null -w "%{http_code}" https://id.chitty.cc/health | grep -q "^[23]"; then
        log_pass "ChittyID service healthy"
    else
        log_warn "ChittyID service not responding (may be in development)"
    fi

    log_test "Testing ChittyRouter"
    if timeout 10 curl -s -o /dev/null -w "%{http_code}" https://router.chitty.cc/health | grep -q "^[23]"; then
        log_pass "ChittyRouter healthy"
    else
        log_warn "ChittyRouter not responding"
    fi

    log_test "Testing ChittyRegistry"
    if timeout 10 curl -s -o /dev/null -w "%{http_code}" https://registry.chitty.cc/health | grep -q "^[23]"; then
        log_pass "ChittyRegistry healthy"
    else
        log_warn "ChittyRegistry not responding"
    fi

    # OpenAI
    log_test "Testing OpenAI API endpoint"
    if timeout 10 curl -s -o /dev/null -w "%{http_code}" https://api.openai.com/v1/models | grep -q "^[23]"; then
        log_pass "OpenAI API endpoint reachable"
    else
        log_fail "OpenAI API endpoint failed" \
            "Cannot reach https://api.openai.com/v1/models" \
            "Check network connectivity or OpenAI status"
    fi
}

# Test 2: Local Server Files
test_server_files() {
    log_section "MCP Server Files"

    # Evidence Intake Server
    log_test "Checking Evidence Intake Server"
    if [ -f "mcp-evidence-server/index.js" ]; then
        log_pass "Evidence Intake index.js found"

        # Syntax check
        if node --check mcp-evidence-server/index.js 2>/dev/null; then
            log_pass "Evidence Intake syntax valid"
        else
            log_fail "Evidence Intake syntax check failed" \
                "JavaScript syntax errors in index.js" \
                "Review mcp-evidence-server/index.js for syntax errors"
        fi

        # Check dependencies
        if [ -f "mcp-evidence-server/package.json" ]; then
            if [ -d "mcp-evidence-server/node_modules" ]; then
                log_pass "Evidence Intake dependencies installed"
            else
                log_fail "Evidence Intake dependencies missing" \
                    "node_modules directory not found" \
                    "Run: cd mcp-evidence-server && npm install"
            fi
        fi
    else
        log_fail "Evidence Intake index.js not found" \
            "Missing mcp-evidence-server/index.js" \
            "Restore or rebuild the file from backup"
    fi

    # Unified Consolidated Server
    log_test "Checking Unified Consolidated Server"
    if [ -f "mcp-unified-consolidated/unified-server.js" ]; then
        log_pass "Unified Server file found"

        if node --check mcp-unified-consolidated/unified-server.js 2>/dev/null; then
            log_pass "Unified Server syntax valid"
        else
            log_fail "Unified Server syntax check failed" \
                "JavaScript syntax errors" \
                "Review mcp-unified-consolidated/unified-server.js"
        fi

        if [ -d "mcp-unified-consolidated/node_modules" ]; then
            log_pass "Unified Server dependencies installed"
        else
            log_fail "Unified Server dependencies missing" \
                "node_modules directory not found" \
                "Run: cd mcp-unified-consolidated && npm install"
        fi
    else
        log_fail "Unified Server file not found" \
            "Missing mcp-unified-consolidated/unified-server.js" \
            "Check repository integrity"
    fi

    # MCP Exec Service
    log_test "Checking MCP Exec Service"
    if [ -f "services/mcp-exec/src/index.ts" ]; then
        log_pass "MCP Exec source found"

        if [ -f "services/mcp-exec/dist/index.js" ]; then
            log_pass "MCP Exec compiled"
        else
            log_warn "MCP Exec not compiled (run: cd services/mcp-exec && npm run build)"
        fi
    else
        log_fail "MCP Exec source not found" \
            "Missing services/mcp-exec/src/index.ts" \
            "Check repository integrity"
    fi
}

# Test 3: Package Dependencies
test_package_dependencies() {
    log_section "Package Dependencies"

    # Check for OpenAI connector issue
    log_test "Checking OpenAI connector package"
    if grep -q '"mcp-server-openai"' mcp-unified-consolidated/package.json 2>/dev/null; then
        log_fail "Incorrect OpenAI package name" \
            "package.json references 'mcp-server-openai' which doesn't exist" \
            "Change to '@modelcontextprotocol/server-openai' or 'openai' directly"
    elif grep -q '"openai"' mcp-unified-consolidated/package.json 2>/dev/null; then
        log_pass "OpenAI package correctly referenced"
    else
        log_warn "OpenAI package not found in dependencies"
    fi

    # Check MCP SDK version
    log_test "Checking MCP SDK versions"
    local evidence_sdk=$(grep -o '"@modelcontextprotocol/sdk": "[^"]*"' mcp-evidence-server/package.json 2>/dev/null || echo "not found")
    local unified_sdk=$(grep -o '"@modelcontextprotocol/sdk": "[^"]*"' mcp-unified-consolidated/package.json 2>/dev/null || echo "not found")

    if [[ "$evidence_sdk" == *"0.5.0"* ]] && [[ "$unified_sdk" == *"0.5.0"* ]]; then
        log_pass "MCP SDK versions consistent (0.5.0)"
    else
        log_warn "MCP SDK versions may be inconsistent"
        log_info "Evidence: $evidence_sdk"
        log_info "Unified: $unified_sdk"
    fi
}

# Test 4: Database Connections
test_database_connections() {
    log_section "Database Connections"

    # Neon authentication
    log_test "Checking Neon CLI authentication"
    if command -v neon &> /dev/null; then
        if neon auth whoami &>/dev/null; then
            log_pass "Neon CLI authenticated"
        else
            log_fail "Neon CLI not authenticated" \
                "OAuth never completed or token expired" \
                "Run: neon auth login"
        fi
    else
        log_warn "Neon CLI not installed (optional)"
    fi

    # Check database connection string
    log_test "Checking Neon database URL"
    if [ -n "$NEON_DATABASE_URL" ]; then
        log_pass "NEON_DATABASE_URL environment variable set"
    else
        log_fail "NEON_DATABASE_URL not set" \
            "Missing database connection string" \
            "Set in environment: export NEON_DATABASE_URL=<your-connection-string>"
    fi
}

# Test 5: Environment Configuration
test_environment() {
    log_section "Environment Configuration"

    # ChittyOS variables
    log_test "Checking ChittyOS environment variables"
    local missing_vars=()

    [ -z "$CHITTY_ENV" ] && missing_vars+=("CHITTY_ENV")
    [ -z "$CHITTYID_SERVICE" ] && missing_vars+=("CHITTYID_SERVICE")
    [ -z "$CHITTY_ID_TOKEN" ] && missing_vars+=("CHITTY_ID_TOKEN")
    [ -z "$PORTAL_DOMAIN" ] && missing_vars+=("PORTAL_DOMAIN")

    if [ ${#missing_vars[@]} -eq 0 ]; then
        log_pass "All ChittyOS environment variables set"
    else
        log_fail "Missing ChittyOS environment variables" \
            "Missing: ${missing_vars[*]}" \
            "Source .env file or add to shell profile"
    fi

    # Cloudflare credentials
    log_test "Checking Cloudflare credentials"
    if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
        log_pass "Cloudflare credentials set"
    else
        log_fail "Cloudflare credentials missing" \
            "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID" \
            "Add to environment or .env file"
    fi
}

# Test 6: macOS LaunchD (macOS only)
test_launchd_services() {
    if [ "$PLATFORM" != "macOS" ]; then
        log_info "Skipping LaunchD tests (not on macOS)"
        return
    fi

    log_section "macOS LaunchD Services"

    # Check for plist files
    local plist_files=(
        "/Library/LaunchDaemons/com.chitty.external.monitor.plist"
        "/Library/LaunchDaemons/com.chittycorp.session-orchestrator.plist"
        "/Library/LaunchDaemons/com.chittyos.sync.plist"
        "/Library/LaunchDaemons/com.user.storage-daemon.plist"
    )

    for plist in "${plist_files[@]}"; do
        log_test "Checking $(basename "$plist")"

        if [ -f "$plist" ]; then
            # Check if loaded
            if launchctl list | grep -q "$(basename "$plist" .plist)"; then
                log_pass "$(basename "$plist") loaded"
            else
                log_warn "$(basename "$plist") not loaded"
            fi

            # Check for StandardErrorPath
            if grep -q "StandardErrorPath" "$plist"; then
                log_pass "$(basename "$plist") has error logging"
            else
                log_fail "$(basename "$plist") missing error logs" \
                    "No StandardErrorPath defined" \
                    "Add StandardErrorPath and StandardOutPath keys"
            fi
        else
            log_info "$(basename "$plist") not found (may not be installed)"
        fi
    done
}

# Test 7: Claude Desktop Configuration
test_claude_config() {
    log_section "Claude Desktop Configuration"

    log_test "Checking Claude Desktop config file"
    local config_file="${CONFIG_DIR}/claude_desktop_config.json"

    if [ -f "$config_file" ]; then
        log_pass "Config file found at $config_file"

        # Validate JSON
        if jq empty "$config_file" 2>/dev/null; then
            log_pass "Config file is valid JSON"

            # Check for MCP servers
            local server_count=$(jq '.mcpServers | length' "$config_file" 2>/dev/null || echo "0")
            if [ "$server_count" -gt 0 ]; then
                log_pass "Found $server_count MCP server(s) configured"

                # List servers
                if [ "$VERBOSE" = true ]; then
                    log_info "Configured servers:"
                    jq -r '.mcpServers | keys[]' "$config_file" 2>/dev/null | while read -r server; do
                        echo "    - $server"
                    done
                fi
            else
                log_warn "No MCP servers configured"
            fi
        else
            log_fail "Config file has invalid JSON" \
                "JSON syntax error in claude_desktop_config.json" \
                "Validate with: jq . $config_file"
        fi
    else
        log_warn "Claude Desktop config not found at $config_file"
    fi
}

# Test 8: Log File Analysis
test_log_files() {
    log_section "Log File Analysis"

    if [ ! -d "$LOG_DIR" ]; then
        log_warn "Log directory not found at $LOG_DIR"
        return
    fi

    log_test "Checking for recent errors in logs"

    # Find recent log files
    local log_files=$(find "$LOG_DIR" -name "mcp*.log" -mtime -1 2>/dev/null || echo "")

    if [ -n "$log_files" ]; then
        log_pass "Found recent MCP log files"

        # Check for common error patterns
        local error_count=$(grep -i "error\|failed\|timeout" $log_files 2>/dev/null | wc -l || echo "0")
        local sse_errors=$(grep -i "SseError.*404" $log_files 2>/dev/null | wc -l || echo "0")
        local timeout_errors=$(grep -i "Body Timeout Error" $log_files 2>/dev/null | wc -l || echo "0")

        if [ "$error_count" -gt 10 ]; then
            log_fail "High error count in logs" \
                "Found $error_count errors in recent logs" \
                "Review logs at: $LOG_DIR"
        else
            log_pass "Error count acceptable ($error_count errors)"
        fi

        if [ "$sse_errors" -gt 0 ]; then
            log_fail "SSE 404 errors detected" \
                "Found $sse_errors SSE 404 errors (broken endpoints)" \
                "Update MCP server URLs in configuration"
        fi

        if [ "$timeout_errors" -gt 0 ]; then
            log_warn "Timeout errors detected ($timeout_errors occurrences)"
        fi

        if [ "$VERBOSE" = true ]; then
            log_info "Recent log files:"
            echo "$log_files" | while read -r log; do
                echo "    - $(basename "$log")"
            done
        fi
    else
        log_warn "No recent log files found"
    fi
}

# Test 9: Git Repository Health
test_git_health() {
    log_section "Git Repository Health"

    log_test "Checking git repository"
    if git rev-parse --git-dir &>/dev/null; then
        log_pass "Git repository initialized"

        local branch=$(git branch --show-current)
        log_info "Current branch: $branch"

        if [[ "$branch" == claude/* ]]; then
            log_pass "On Claude development branch"
        else
            log_warn "Not on a claude/* branch"
        fi

        # Check for uncommitted changes
        if git diff-index --quiet HEAD -- 2>/dev/null; then
            log_pass "Working directory clean"
        else
            log_info "Uncommitted changes present"
        fi
    else
        log_fail "Not a git repository" \
            "Current directory is not a git repository" \
            "Run: git init"
    fi
}

# Test 10: Network Connectivity
test_network() {
    log_section "Network Connectivity"

    log_test "Testing general network connectivity"
    if ping -c 1 8.8.8.8 &>/dev/null; then
        log_pass "Network connectivity OK"
    else
        log_fail "No network connectivity" \
            "Cannot reach external networks" \
            "Check network connection and firewall"
    fi

    log_test "Testing DNS resolution"
    if nslookup github.com &>/dev/null; then
        log_pass "DNS resolution working"
    else
        log_fail "DNS resolution failed" \
            "Cannot resolve domain names" \
            "Check DNS settings"
    fi
}

# Generate summary report
generate_summary() {
    log_section "Test Summary"

    echo ""
    echo -e "${CYAN}Total Tests:${NC}    $TOTAL_TESTS"
    echo -e "${GREEN}Passed:${NC}         $PASSED_TESTS"
    echo -e "${RED}Failed:${NC}         $FAILED_TESTS"
    echo -e "${YELLOW}Warnings:${NC}       $WARNINGS"
    echo ""

    local pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ All critical tests passed!${NC}"
    elif [ $pass_rate -ge 70 ]; then
        echo -e "${YELLOW}⚠ System partially operational ($pass_rate% pass rate)${NC}"
    else
        echo -e "${RED}✗ System has critical issues ($pass_rate% pass rate)${NC}"
    fi

    # Print critical issues
    if [ ${#ISSUES[@]} -gt 0 ]; then
        echo ""
        log_section "Critical Issues Found"
        echo ""
        for issue in "${ISSUES[@]}"; do
            echo -e "${RED}✗${NC} $issue"
        done
    fi

    # Print recommended fixes
    if [ ${#FIXES[@]} -gt 0 ]; then
        echo ""
        log_section "Recommended Fixes"
        echo ""
        for fix in "${FIXES[@]}"; do
            echo -e "${GREEN}→${NC} $fix"
        done
    fi

    echo ""
    echo -e "${CYAN}Report saved to: $REPORT_FILE${NC}"

    if [ "$HTML_OUTPUT" = true ]; then
        generate_html_report
        echo -e "${CYAN}HTML report saved to: $HTML_FILE${NC}"
    fi
}

# Generate HTML report
generate_html_report() {
    cat > "$HTML_FILE" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>ChittyMCP Diagnostics Report - $(date)</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 1200px; margin: 40px auto; padding: 20px; background: #f5f5f5; }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
        .summary { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 20px 0; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; font-size: 18px; }
        .pass { color: #4CAF50; font-weight: bold; }
        .fail { color: #f44336; font-weight: bold; }
        .warn { color: #ff9800; font-weight: bold; }
        .result-item { padding: 10px; margin: 5px 0; border-radius: 4px; background: white; }
        .result-pass { border-left: 4px solid #4CAF50; }
        .result-fail { border-left: 4px solid #f44336; }
        .result-warn { border-left: 4px solid #ff9800; }
        .issue-list { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 15px; margin: 15px 0; }
        .fix-list { background: #d4edda; border: 1px solid #28a745; border-radius: 4px; padding: 15px; margin: 15px 0; }
        pre { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .timestamp { color: #888; font-size: 14px; }
    </style>
</head>
<body>
    <h1>🔍 ChittyMCP System Diagnostics</h1>
    <p class="timestamp">Generated: $(date '+%Y-%m-%d %H:%M:%S')</p>
    <p>Platform: <strong>$PLATFORM</strong></p>

    <div class="summary">
        <h2>Summary</h2>
        <div class="metric">Total Tests: <strong>$TOTAL_TESTS</strong></div>
        <div class="metric pass">Passed: $PASSED_TESTS</div>
        <div class="metric fail">Failed: $FAILED_TESTS</div>
        <div class="metric warn">Warnings: $WARNINGS</div>
    </div>

    <h2>Test Results</h2>
EOF

    for result in "${RESULTS[@]}"; do
        local status="${result%%:*}"
        local message="${result#*: }"
        local class="result-item"

        case "$status" in
            PASS) class="result-item result-pass" ;;
            FAIL) class="result-item result-fail" ;;
            WARN) class="result-item result-warn" ;;
        esac

        echo "    <div class=\"$class\">$message</div>" >> "$HTML_FILE"
    done

    if [ ${#ISSUES[@]} -gt 0 ]; then
        cat >> "$HTML_FILE" <<EOF

    <div class="issue-list">
        <h2>⚠️ Critical Issues</h2>
        <ul>
EOF
        for issue in "${ISSUES[@]}"; do
            echo "            <li>$issue</li>" >> "$HTML_FILE"
        done
        echo "        </ul>" >> "$HTML_FILE"
        echo "    </div>" >> "$HTML_FILE"
    fi

    if [ ${#FIXES[@]} -gt 0 ]; then
        cat >> "$HTML_FILE" <<EOF

    <div class="fix-list">
        <h2>🔧 Recommended Fixes</h2>
        <ul>
EOF
        for fix in "${FIXES[@]}"; do
            echo "            <li>$fix</li>" >> "$HTML_FILE"
        done
        echo "        </ul>" >> "$HTML_FILE"
        echo "    </div>" >> "$HTML_FILE"
    fi

    echo "</body></html>" >> "$HTML_FILE"
}

# Main execution
main() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║                                                       ║"
    echo "║        ChittyMCP System Diagnostics v1.0              ║"
    echo "║        Comprehensive MCP Health Check                 ║"
    echo "║                                                       ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    detect_platform
    log_info "Detected platform: $PLATFORM"
    log_info "Saving report to: $REPORT_FILE"

    # Redirect output to both console and file
    exec > >(tee -a "$REPORT_FILE")
    exec 2>&1

    # Run all tests
    test_endpoints
    test_server_files
    test_package_dependencies
    test_database_connections
    test_environment
    test_launchd_services
    test_claude_config
    test_log_files
    test_git_health
    test_network

    # Generate summary
    generate_summary

    # Exit with appropriate code
    if [ $FAILED_TESTS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main
main "$@"
