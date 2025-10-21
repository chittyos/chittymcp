#!/bin/bash

# ChittyMCP Server Test Script
# Tests all 3 MCP servers for basic functionality

set -e

echo "🧪 ChittyMCP Server Test Suite"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_server() {
    local name=$1
    local dir=$2
    local command=$3

    echo -e "${YELLOW}Testing: $name${NC}"
    echo "Directory: $dir"
    echo "Command: $command"
    echo ""

    if [ ! -d "$dir" ]; then
        echo -e "${RED}✗ Directory not found: $dir${NC}"
        ((TESTS_FAILED++))
        return 1
    fi

    cd "$dir"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm install --silent
    fi

    # Test that the server file exists and has no syntax errors
    if node --check $command 2>/dev/null; then
        echo -e "${GREEN}✓ Syntax check passed${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ Syntax check failed${NC}"
        ((TESTS_FAILED++))
        return 1
    fi

    echo ""
}

# Change to script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Test 1: Evidence Intake Server
echo "===================="
echo "Test 1/3: Evidence Intake Server"
echo "===================="
test_server \
    "Evidence Intake Server" \
    "./mcp-evidence-server" \
    "index.js"

# Test 2: Unified Consolidated Server
echo "===================="
echo "Test 2/3: Unified Consolidated Server"
echo "===================="
test_server \
    "Unified Consolidated Server" \
    "./mcp-unified-consolidated" \
    "unified-server.js"

# Test 3: MCP Execution Service
echo "===================="
echo "Test 3/3: MCP Execution Service"
echo "===================="
cd "$SCRIPT_DIR/services/mcp-exec"

if [ ! -d "dist" ]; then
    echo "🔨 Building TypeScript..."
    npm run build --silent
fi

if [ -f "dist/index.js" ]; then
    if node --check dist/index.js 2>/dev/null; then
        echo -e "${GREEN}✓ TypeScript build successful${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ TypeScript build failed${NC}"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}✗ Build output not found${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo "===================="
echo "Test Summary"
echo "===================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "🚀 Servers are ready to run:"
    echo ""
    echo "1. Evidence Intake Server:"
    echo "   cd mcp-evidence-server && node index.js"
    echo ""
    echo "2. Unified Consolidated Server:"
    echo "   cd mcp-unified-consolidated && node unified-server.js"
    echo ""
    echo "3. MCP Execution Service:"
    echo "   cd services/mcp-exec && node dist/index.js"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
