# ChittyMCP Troubleshooting Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-30

This guide provides systematic diagnosis and repair procedures for ChittyMCP health issues.

---

## Quick Start

### Run Diagnostics

```bash
# Full diagnostic report
bash diagnostics.sh

# Verbose output
bash diagnostics.sh --verbose

# HTML report
bash diagnostics.sh --html
```

### Run Automated Repair

```bash
# Preview changes (dry-run)
bash mcp-repair.sh --dry-run

# Apply fixes
bash mcp-repair.sh

# macOS LaunchD fixes (requires sudo)
sudo bash fix-launchd.sh
```

---

## Common Issues & Solutions

### 1. Evidence Intake Server - Missing index.js

**Symptoms**:
- Error: `Cannot find module .../mcp-evidence-server/index.js`
- Daemon restarts every few seconds
- 404 errors in Claude Desktop logs

**Diagnosis**:
```bash
# Check if file exists
ls -l mcp-evidence-server/index.js

# Check Git history
git log --all --full-history -- mcp-evidence-server/index.js
```

**Solutions**:

A. **Restore from Git**:
```bash
git checkout HEAD -- mcp-evidence-server/index.js
```

B. **Restore from backup**:
```bash
# Check .backups directory
ls -la .backups/

# Restore latest
cp .backups/YYYYMMDD-HHMMSS/index.js mcp-evidence-server/
```

C. **Rebuild dependencies**:
```bash
cd mcp-evidence-server
npm install
node --check index.js  # Verify syntax
```

---

### 2. OpenAI Connector - Package Not Found

**Symptoms**:
- `npm ERR! 404 mcp-server-openai` during installation
- OpenAI tools not available in MCP
- Build failures in unified-consolidated server

**Diagnosis**:
```bash
# Check current package reference
grep -r "mcp-server-openai" mcp-unified-consolidated/package.json
```

**Solution**:
```bash
cd mcp-unified-consolidated

# Remove incorrect package
npm uninstall mcp-server-openai

# Install correct package
npm install openai@^4.52.0 --save

# Verify
npm list openai
```

**Alternative**: Use `@modelcontextprotocol/server-openai` if available from official MCP repos.

---

### 3. Neon Database - Authentication Timeout

**Symptoms**:
- OAuth flow never completes
- Timeouts connecting to Neon
- Missing credentials.json file

**Diagnosis**:
```bash
# Check Neon CLI
which neon

# Check authentication
neon auth whoami

# Check credentials file
ls -l ~/.config/neon/credentials.json
```

**Solution**:

A. **Install Neon CLI** (if missing):
```bash
npm install -g neonctl
```

B. **Re-authenticate**:
```bash
# Clear old auth
rm -f ~/.config/neon/credentials.json

# Login (opens browser)
neon auth login

# Verify
neon auth whoami
neon projects list
```

C. **Set environment variable**:
```bash
# Add to .env
echo "NEON_DATABASE_URL=postgresql://user:pass@host.neon.tech/db" >> .env

# Or add to shell profile
export NEON_DATABASE_URL="postgresql://..."
source ~/.zshrc  # or ~/.bashrc
```

---

### 4. Cloudflare Connector - 404 Errors

**Symptoms**:
- `SseError: Non-200 status code (404)`
- Cloudflare docs MCP not responding
- ChittyMCP worker returning 404

**Diagnosis**:
```bash
# Test endpoints
curl -v https://docs.mcp.cloudflare.com/
curl -v https://chittymcp.chittycorp-llc.workers.dev/health

# Check DNS
nslookup docs.mcp.cloudflare.com
```

**Solutions**:

A. **Update Cloudflare Docs endpoint**:

Edit Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cloudflare-docs": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-cloudflare"]
    }
  }
}
```

B. **Deploy ChittyMCP worker**:
```bash
cd workers/chittymcp-worker
npm install
npm run deploy

# Test deployment
curl https://chittymcp.chittycorp-llc.workers.dev/health
```

C. **Fix worker route** (if 404 on deployed worker):

Edit `workers/chittymcp-worker/wrangler.toml`:
```toml
routes = [
  { pattern = "chittymcp.chittycorp-llc.workers.dev/*", zone_name = "chittycorp-llc.workers.dev" }
]
```

Then redeploy:
```bash
npm run deploy
```

---

### 5. macOS LaunchD Services - Crashes & Restarts

**Symptoms**:
- Services restart every few seconds
- Missing error logs
- Duplicate service labels
- iTerm2 / lsd / mediaanalysisd crashes

**Diagnosis**:
```bash
# Check loaded services
launchctl list | grep chitty

# Check for errors in system log
log show --predicate 'subsystem == "com.apple.launchd"' --last 30m

# Check plist files
ls -l /Library/LaunchDaemons/com.chitty*.plist
```

**Solution**:
```bash
# Run automated fix (requires sudo)
sudo bash fix-launchd.sh

# Manual verification
launchctl list | grep chitty

# Check logs
tail -f /usr/local/var/log/chittyos/*.err.log
```

**Manual fix** (if script fails):

1. **Unload all services**:
```bash
sudo launchctl unload /Library/LaunchDaemons/com.chitty*.plist
```

2. **Fix each plist** (add StandardErrorPath):
```xml
<key>StandardOutPath</key>
<string>/usr/local/var/log/chittyos/SERVICE_NAME.out.log</string>

<key>StandardErrorPath</key>
<string>/usr/local/var/log/chittyos/SERVICE_NAME.err.log</string>
```

3. **Reload**:
```bash
sudo launchctl load /Library/LaunchDaemons/com.chitty*.plist
```

---

### 6. Environment Variables Not Set

**Symptoms**:
- ChittyID service calls fail
- Cloudflare API errors
- Database connection failures

**Diagnosis**:
```bash
# Check current environment
env | grep CHITTY
env | grep CLOUDFLARE
env | grep NEON

# Check .env file
cat .env 2>/dev/null || echo ".env not found"
```

**Solution**:

A. **Create .env file**:
```bash
# Copy template
cp .env.example .env

# Edit with real credentials
nano .env
```

B. **Add to shell profile**:
```bash
# Add to ~/.zshrc or ~/.bashrc
cat >> ~/.zshrc <<'EOF'

# ChittyOS Environment
export CHITTY_ENV=production
export CHITTYID_SERVICE=https://id.chitty.cc
export CHITTY_ID_TOKEN="your_token_here"
export CLOUDFLARE_API_TOKEN="your_token_here"
export CLOUDFLARE_ACCOUNT_ID="bbf9fcd845e78035b7a135c481e88541"
export NEON_DATABASE_URL="postgresql://..."
EOF

# Reload
source ~/.zshrc
```

C. **Add to LaunchDaemon** (for services):

Edit plist files:
```xml
<key>EnvironmentVariables</key>
<dict>
    <key>CHITTY_ID_TOKEN</key>
    <string>your_token_here</string>
    <key>CLOUDFLARE_API_TOKEN</key>
    <string>your_token_here</string>
</dict>
```

---

### 7. Claude Desktop Config - Invalid JSON

**Symptoms**:
- Claude Desktop won't start
- MCP servers not loading
- "Failed to parse config" errors

**Diagnosis**:
```bash
# Validate JSON
jq . "$HOME/Library/Application Support/Claude/claude_desktop_config.json"

# Check for syntax errors
cat "$HOME/Library/Application Support/Claude/claude_desktop_config.json" | python -m json.tool
```

**Solution**:

A. **Fix JSON syntax**:
```bash
# Use jq to pretty-print and fix
jq . config/claude-desktop-config.json > ~/.claude-config-fixed.json

# Backup old config
cp "$HOME/Library/Application Support/Claude/claude_desktop_config.json" \
   "$HOME/Library/Application Support/Claude/claude_desktop_config.json.bak"

# Replace
cp ~/.claude-config-fixed.json "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
```

B. **Start fresh**:
```json
{
  "mcpServers": {
    "evidence-intake": {
      "command": "node",
      "args": ["/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittymcp/mcp-evidence-server/index.js"],
      "env": {
        "NEON_DATABASE_URL": "postgresql://..."
      }
    },
    "chittymcp-unified": {
      "command": "node",
      "args": ["/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittymcp/mcp-unified-consolidated/unified-server.js"],
      "env": {}
    }
  }
}
```

C. **Restart Claude Desktop**:
```bash
killall Claude
open -a Claude
```

---

### 8. Network Timeouts

**Symptoms**:
- `Body Timeout Error` in logs
- Slow MCP responses
- Intermittent connectivity

**Diagnosis**:
```bash
# Test basic connectivity
ping -c 4 8.8.8.8

# Test DNS
nslookup github.com

# Test endpoints
time curl -I https://id.chitty.cc/health
time curl -I https://api.openai.com/v1/models
```

**Solutions**:

A. **Check firewall**:
```bash
# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps

# Allow Claude Desktop
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /Applications/Claude.app/Contents/MacOS/Claude
```

B. **Increase timeout in MCP config**:

Edit your MCP server code:
```javascript
const timeout = 30000; // 30 seconds instead of default 5s

fetch(url, {
  timeout,
  signal: AbortSignal.timeout(timeout)
});
```

C. **Check VPN/Proxy**:
```bash
# Temporarily disable VPN
# Or configure proxy in environment

export HTTP_PROXY=http://proxy:8080
export HTTPS_PROXY=http://proxy:8080
```

---

### 9. Package Dependencies Mismatch

**Symptoms**:
- `Module not found` errors
- Version conflicts
- Build failures

**Diagnosis**:
```bash
# Check for outdated packages
cd mcp-evidence-server && npm outdated
cd ../mcp-unified-consolidated && npm outdated

# Check peer dependency warnings
npm list
```

**Solution**:
```bash
# Clean install for all servers
for dir in mcp-evidence-server mcp-unified-consolidated services/mcp-exec; do
  cd "$dir"
  rm -rf node_modules package-lock.json
  npm install
  cd -
done

# Verify MCP SDK version consistency
grep "@modelcontextprotocol/sdk" */package.json
```

---

### 10. Git Repository Issues

**Symptoms**:
- Push failures with 403 error
- Branch naming conflicts
- Dirty working directory

**Diagnosis**:
```bash
# Check current branch
git branch --show-current

# Check remote
git remote -v

# Check status
git status
```

**Solution**:

A. **Fix branch name** (must match pattern):
```bash
# Current branch must start with 'claude/' and end with session ID
git branch -m claude/fix-mcp-health-issues-011CUcs6jtj2gsaduPhXPB1L

# Verify
git branch --show-current
```

B. **Push with retry on network error**:
```bash
# Push with retry logic
for i in {1..4}; do
  if git push -u origin $(git branch --show-current); then
    break
  fi
  echo "Retry $i after $(( 2 ** i )) seconds..."
  sleep $(( 2 ** i ))
done
```

C. **Clean working directory**:
```bash
# Stash changes
git stash

# Or commit
git add .
git commit -m "Fix: MCP health issues

- Added comprehensive diagnostics
- Automated repair scripts
- Fixed dependencies
- Updated documentation"
```

---

## Verification Checklist

After running repairs, verify all systems:

### ✅ Local MCP Servers

- [ ] Evidence Intake server starts: `node mcp-evidence-server/index.js`
- [ ] Unified server starts: `node mcp-unified-consolidated/unified-server.js`
- [ ] No syntax errors: `node --check <file>`
- [ ] Dependencies installed: `ls */node_modules/@modelcontextprotocol/sdk`

### ✅ External Services

- [ ] ChittyID reachable: `curl https://id.chitty.cc/health`
- [ ] ChittyRouter reachable: `curl https://router.chitty.cc/health`
- [ ] OpenAI API reachable: `curl https://api.openai.com/v1/models`
- [ ] Cloudflare Worker deployed: `curl https://chittymcp.chittycorp-llc.workers.dev/health`

### ✅ Authentication

- [ ] Neon authenticated: `neon auth whoami`
- [ ] Cloudflare token set: `echo $CLOUDFLARE_API_TOKEN`
- [ ] ChittyID token set: `echo $CHITTY_ID_TOKEN`

### ✅ Configuration

- [ ] .env file exists with real credentials
- [ ] Claude Desktop config valid JSON
- [ ] MCP servers listed in config
- [ ] LaunchD plists have error logging (macOS)

### ✅ Integration

- [ ] Run diagnostics: `bash diagnostics.sh` (0 failures)
- [ ] Test servers: `bash test-servers.sh` (all pass)
- [ ] Claude Desktop loads MCP tools
- [ ] Can execute MCP tool calls

---

## Advanced Diagnostics

### Check MCP Capabilities

```bash
# Install mcpctl if not present
npm install -g @modelcontextprotocol/cli

# List all capabilities
mcpctl capabilities all > capabilities-before.json

# After making changes
mcpctl capabilities all > capabilities-after.json

# Compare
diff capabilities-before.json capabilities-after.json
```

### Monitor Real-Time Logs

```bash
# macOS LaunchD services
tail -f /usr/local/var/log/chittyos/*.err.log

# Claude Desktop
tail -f ~/Library/Logs/Claude/mcp*.log

# System logs
log stream --predicate 'subsystem == "com.apple.launchd"' --level debug
```

### Test Individual Tools

```bash
# Test evidence intake tool
echo '{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "intake_evidence",
    "arguments": {
      "file_path": "/path/to/test.pdf",
      "category": "00_KEY_EXHIBITS"
    }
  },
  "id": 1
}' | node mcp-evidence-server/index.js
```

### Analyze Crash Reports

```bash
# Find recent crash reports
ls -lt ~/Library/Logs/DiagnosticReports/*.ips | head

# Analyze crashes
grep -A 10 "Exception Type" ~/Library/Logs/DiagnosticReports/*.ips
```

---

## Emergency Recovery

### Complete Reset

If all else fails:

```bash
# 1. Stop all services
launchctl list | grep chitty | awk '{print $3}' | xargs -I {} launchctl unload {}

# 2. Backup current state
mkdir -p ~/chitty-backup-$(date +%Y%m%d)
cp -r ~/Evidence-Intake ~/chitty-backup-$(date +%Y%m%d)/
cp -r ~/.claude ~/chitty-backup-$(date +%Y%m%d)/

# 3. Clean install
cd /path/to/chittymcp
rm -rf */node_modules */package-lock.json
npm install --prefix mcp-evidence-server
npm install --prefix mcp-unified-consolidated
npm install --prefix services/mcp-exec

# 4. Rebuild configs
cp .env.example .env
# Edit .env with real credentials

# 5. Test
bash diagnostics.sh

# 6. Reload services
sudo launchctl load /Library/LaunchDaemons/com.chitty*.plist
```

---

## Getting Help

### Logs to Collect

When reporting issues, include:

1. **Diagnostic report**: `bash diagnostics.sh --html`
2. **System info**:
   ```bash
   uname -a
   node --version
   npm --version
   ```
3. **Claude Desktop logs**:
   ```bash
   tail -100 ~/Library/Logs/Claude/mcp*.log
   ```
4. **Service status**:
   ```bash
   launchctl list | grep chitty
   ```

### Report Issue

```bash
# Open GitHub issue
open https://github.com/chittyos/chittymcp/issues/new
```

Include:
- Diagnostic HTML report
- Error messages
- Steps to reproduce
- Expected vs actual behavior

---

## Maintenance

### Regular Health Checks

```bash
# Weekly
bash diagnostics.sh > weekly-health-$(date +%Y%m%d).txt

# Monthly full audit
bash diagnostics.sh --html --verbose
```

### Keep Dependencies Updated

```bash
# Check for updates
npm outdated --prefix mcp-evidence-server
npm outdated --prefix mcp-unified-consolidated

# Update safely
npm update --prefix mcp-evidence-server
npm test --prefix mcp-evidence-server  # Verify after update
```

### Rotate Logs

```bash
# Archive old logs
tar -czf mcp-logs-$(date +%Y%m).tar.gz ~/Library/Logs/Claude/mcp*.log
mv mcp-logs-*.tar.gz ~/chitty-backups/logs/

# Clear old logs
find ~/Library/Logs/Claude -name "mcp*.log" -mtime +30 -delete
```

---

**Last Updated**: 2025-10-30
**ChittyOS Framework**: v1.0.1
**MCP SDK**: 0.5.0
