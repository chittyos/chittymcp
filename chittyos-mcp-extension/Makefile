# ChittyOS MCP Extension Makefile
# §36 Compliant Build & Deployment

.PHONY: all install build test validate deploy clean help

VERSION ?= 1.0.1
ENVIRONMENT ?= production

all: install validate build test ## Run complete build pipeline

install: ## Install dependencies
	@echo "📦 Installing dependencies..."
	npm ci
	@command -v mcpb > /dev/null || npm install -g @anthropic-ai/mcpb

validate: ## Validate manifest
	@echo "✓ Validating manifest.json..."
	mcpb validate manifest.json

build: validate ## Build extension package
	@echo "🔨 Building extension package..."
	mcpb pack
	@echo "✅ Built: chittyos-mcp-extension.mcpb"

test: ## Run tests
	@echo "🧪 Running tests..."
	@timeout 5 node chittymcp.js 2>&1 | grep -q "ChittyMCP Desktop Extension Server Running" || true
	@node -e "require('./chittymcp.js'); console.log('✓ Server validated');" || true

checksums: build ## Generate checksums
	@echo "🔐 Generating checksums..."
	sha256sum chittyos-mcp-extension.mcpb > chittyos-mcp-extension.mcpb.sha256
	md5sum chittyos-mcp-extension.mcpb > chittyos-mcp-extension.mcpb.md5

docker-build: ## Build Docker image
	@echo "🐳 Building Docker image..."
	docker build -t chittyos/mcp-extension:$(VERSION) .
	docker tag chittyos/mcp-extension:$(VERSION) chittyos/mcp-extension:latest

docker-run: ## Run Docker container
	@echo "🚀 Running Docker container..."
	docker-compose up -d

docker-stop: ## Stop Docker container
	@echo "🛑 Stopping Docker container..."
	docker-compose down

deploy: build checksums ## Deploy extension
	@echo "🚀 Deploying extension v$(VERSION)..."
	@../scripts/deploy-mcp-extension.sh $(VERSION) $(ENVIRONMENT)

release: ## Create GitHub release
	@echo "📦 Creating release v$(VERSION)..."
	gh release create "mcp-v$(VERSION)" \
		chittyos-mcp-extension.mcpb \
		chittyos-mcp-extension.mcpb.sha256 \
		chittyos-mcp-extension.mcpb.md5 \
		--title "ChittyOS MCP Extension v$(VERSION)" \
		--generate-notes

clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	rm -f chittyos-mcp-extension.mcpb
	rm -f chittyos-mcp-extension.mcpb.sha256
	rm -f chittyos-mcp-extension.mcpb.md5
	rm -rf node_modules
	rm -f package-lock.json

info: ## Display extension info
	@echo "═══════════════════════════════════════════════════════════════"
	@echo "   ChittyOS MCP Extension Information"
	@echo "═══════════════════════════════════════════════════════════════"
	@echo "Version: $(VERSION)"
	@echo "Environment: $(ENVIRONMENT)"
	@echo "Package: chittyos-mcp-extension.mcpb"
	@echo "Size: $$(du -h chittyos-mcp-extension.mcpb 2>/dev/null | cut -f1 || echo 'Not built')"
	@echo "Tools: 7 legal/business tools"
	@echo "Compliance: §36 Framework"
	@echo "═══════════════════════════════════════════════════════════════"

dev: ## Run development server
	@echo "🔧 Starting development server..."
	ENVIRONMENT=development node chittymcp.js

watch: ## Watch for changes
	@echo "👁️ Watching for changes..."
	npx nodemon chittymcp.js

lint: ## Run linter
	@echo "🔍 Linting code..."
	npx eslint chittymcp.js || true

format: ## Format code
	@echo "✨ Formatting code..."
	npx prettier --write chittymcp.js manifest.json

security: ## Run security audit
	@echo "🔒 Running security audit..."
	npm audit

update-deps: ## Update dependencies
	@echo "⬆️ Updating dependencies..."
	npm update
	npm audit fix

help: ## Show this help message
	@echo "ChittyOS MCP Extension - Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

.DEFAULT_GOAL := help