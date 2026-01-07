# ChittyMCP Deployment Guide

Complete guide for deploying ChittyMCP servers across multiple platforms.

---

## Quick Deploy

```bash
# Local deployment with Claude Desktop
./deploy.sh local

# Cloudflare Workers (production)
./deploy.sh cloudflare production

# Cloudflare Workers (staging)
./deploy.sh cloudflare staging

# Set up secrets only
./deploy.sh secrets

# Claude Desktop integration only
./deploy.sh claude

# Test without deploying
./deploy.sh test
```

---

## Prerequisites

### Required

- **Node.js** 18.0.0 or higher
- **npm** (comes with Node.js)
- **Environment variables** configured (copy `.env.example` to `.env`)

### Optional (for Cloudflare)

- **Wrangler CLI**: `npm install -g wrangler`
- **Cloudflare account** with Workers enabled

---

## Deployment Options

### 1. Claude Desktop Integration (Recommended)

Best for: Local development and personal use

```bash
./deploy.sh claude
```

**What this does**:
1. Creates/updates `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Configures both unified and evidence servers
3. Provides restart instructions

**Manual setup**:

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chittymcp-unified": {
      "command": "node",
      "args": ["/absolute/path/to/chittymcp/src/servers/unified-server.js"],
      "env": {
        "CHITTY_ID_TOKEN": "${CHITTY_ID_TOKEN}",
        "CLOUDFLARE_API_TOKEN": "${CLOUDFLARE_API_TOKEN}",
        "LOG_LEVEL": "INFO"
      }
    },
    "evidence-intake": {
      "command": "node",
      "args": ["/absolute/path/to/chittymcp/src/servers/evidence-server.js"],
      "env": {}
    }
  }
}
```

**After setup**:
1. Restart Claude Desktop
2. Tools should appear automatically
3. Check logs: `~/Library/Logs/Claude/mcp*.log`

---

### 2. Cloudflare Workers

Best for: Production deployment, HTTP access

#### Setup

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy to staging
./deploy.sh cloudflare staging

# Deploy to production
./deploy.sh cloudflare production
```

#### Configure Secrets

```bash
# Set all secrets from .env
./deploy.sh secrets

# Or set individually
echo "your_token" | wrangler secret put CHITTY_ID_TOKEN
echo "your_api_token" | wrangler secret put CLOUDFLARE_API_TOKEN
```

#### Custom Domain (Optional)

Edit `wrangler.toml`:

```toml
[[routes]]
pattern = "mcp.chitty.cc/*"
zone_name = "chitty.cc"
```

Then deploy:

```bash
wrangler deploy
```

#### Monitoring

```bash
# View logs
wrangler tail chittymcp-unified

# View deployment info
wrangler deployments list

# Check status
curl https://chittymcp-unified.your-subdomain.workers.dev/health
```

---

### 3. Local Service (macOS LaunchAgent)

Best for: Always-on local service

```bash
./deploy.sh local
```

**What this does**:
1. Creates LaunchAgent plist
2. Starts service automatically on login
3. Keeps service running (restarts on crash)

**Service management**:

```bash
# Start service
launchctl start com.chittyos.chittymcp

# Stop service
launchctl stop com.chittyos.chittymcp

# View logs
tail -f ~/Library/Logs/chittymcp-stdout.log
tail -f ~/Library/Logs/chittymcp-stderr.log

# Uninstall service
launchctl unload ~/Library/LaunchAgents/com.chittyos.chittymcp.plist
rm ~/Library/LaunchAgents/com.chittyos.chittymcp.plist
```

---

### 4. Docker (Future)

Coming in v3.1.0

```bash
# Build image
docker build -t chittymcp:latest .

# Run container
docker run -d \
  --name chittymcp \
  -p 3000:3000 \
  -e CHITTY_ID_TOKEN=your_token \
  chittymcp:latest
```

---

## Environment Configuration

### Required Variables

```bash
# ChittyID Service (REQUIRED for legal tools)
CHITTY_ID_TOKEN=mcp_auth_your_token_here
CHITTYID_SERVICE=https://id.chitty.cc

# Environment
CHITTY_ENV=production  # development|staging|production
LOG_LEVEL=INFO         # DEBUG|INFO|WARN|ERROR
```

### Optional Variables

```bash
# Cloudflare (for infrastructure tools)
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541

# Notion (for evidence syncing)
NOTION_TOKEN=secret_your_token
NOTION_DATABASE_ID=your_database_id

# Database (for ChittyLedger integration)
NEON_DATABASE_URL=postgresql://user:pass@host/db

# Evidence processing
EVIDENCE_BASE_PATH=/custom/evidence/path
GOOGLE_DRIVE_PATH=/path/to/google/drive
```

---

## Health Checks

### Local Testing

```bash
# Test unified server startup
timeout 5 node src/servers/unified-server.js

# Test evidence server startup
timeout 5 node src/servers/evidence-server.js

# Run full test suite
npm test
```

### Production Monitoring

```bash
# Cloudflare Workers health
curl https://chittymcp-unified.your-subdomain.workers.dev/health

# Check service status (macOS)
launchctl list | grep chittymcp

# View recent logs
tail -n 100 ~/Library/Logs/chittymcp-stdout.log
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Copy `.env.example` to `.env` and configure
- [ ] Test servers locally: `./deploy.sh test`
- [ ] Verify environment variables are set
- [ ] Check ChittyID service is accessible
- [ ] Review `wrangler.toml` configuration (for Cloudflare)

### During Deployment

- [ ] Run deployment script: `./deploy.sh <type>`
- [ ] Verify no errors in output
- [ ] Check secrets are configured (Cloudflare)
- [ ] Test health endpoint

### Post-Deployment

- [ ] Verify tools load in Claude Desktop (if applicable)
- [ ] Test each tool category (evidence, legal, infrastructure, sync)
- [ ] Check logs for errors
- [ ] Monitor performance for 24 hours
- [ ] Update documentation if custom configuration used

---

## Troubleshooting

### Claude Desktop: Tools Not Appearing

1. **Check config file exists**: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. **Verify paths are absolute** (not relative)
3. **Check JSON syntax** (use `jsonlint` or online validator)
4. **Restart Claude Desktop** completely
5. **Check logs**: `~/Library/Logs/Claude/mcp*.log`

### Cloudflare: Deployment Failed

```bash
# Check you're logged in
wrangler whoami

# Re-login if needed
wrangler login

# Verify account ID in wrangler.toml
grep account_id wrangler.toml

# Check for errors
wrangler deploy --dry-run
```

### Cloudflare: Secrets Not Working

```bash
# List current secrets
wrangler secret list

# Re-set individual secret
echo "new_value" | wrangler secret put SECRET_NAME

# Verify secret was set
wrangler secret list
```

### Service Not Starting (macOS)

```bash
# Check LaunchAgent status
launchctl list | grep chittymcp

# View errors
tail -50 ~/Library/Logs/chittymcp-stderr.log

# Reload LaunchAgent
launchctl unload ~/Library/LaunchAgents/com.chittyos.chittymcp.plist
launchctl load ~/Library/LaunchAgents/com.chittyos.chittymcp.plist

# Test manually first
node src/servers/unified-server.js
```

### Environment Variables Not Loading

```bash
# Source .env manually
export $(cat .env | grep -v '^#' | xargs)

# Verify variables are set
env | grep CHITTY

# For Claude Desktop, use ${VAR} syntax in config
"env": {
  "CHITTY_ID_TOKEN": "${CHITTY_ID_TOKEN}"
}
```

---

## Performance Optimization

### Memory Usage

**Development** (LOG_LEVEL=DEBUG):
- Unified: ~80MB
- Evidence: ~50MB

**Production** (LOG_LEVEL=WARN):
- Unified: ~70MB
- Evidence: ~45MB

**Optimize**:
```bash
# Set production log level
export LOG_LEVEL=WARN

# Disable debug features
export CHITTY_ENV=production
```

### Startup Time

- **Cold start**: ~600ms (unified), ~400ms (evidence)
- **Warm start**: ~200ms

**Cloudflare Workers**:
- First request: ~1000ms (cold start)
- Subsequent: ~50ms (warm)

---

## Scaling

### Horizontal (Multiple Instances)

Cloudflare Workers automatically scale to handle load. No configuration needed.

### Vertical (More Resources)

**Local deployment**:
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 node server.js`
- Use `pm2` for process management: `pm2 start src/servers/unified-server.js`

**Cloudflare Workers**:
- Limits: 50ms CPU time per request
- For longer operations, use Durable Objects

---

## Security

### Secrets Management

**Never commit**:
- `.env` file
- API tokens
- Service credentials

**Use**:
- Cloudflare secrets (wrangler secret put)
- Environment variables
- 1Password CLI integration

### Network Security

**Cloudflare Workers**:
- Automatic DDoS protection
- Global CDN
- Rate limiting (configure in dashboard)

**Local deployment**:
- Use firewall rules
- Restrict to localhost only
- Use reverse proxy (nginx) for HTTP access

---

## Rollback

### Cloudflare Workers

```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback

# Or specific deployment
wrangler rollback --deployment-id <ID>
```

### Local Service

```bash
# Stop current version
launchctl stop com.chittyos.chittymcp

# Restore from backup
cd /path/to/chittymcp
git checkout previous-tag

# Restart service
launchctl start com.chittyos.chittymcp
```

### Claude Desktop

Edit config to use legacy servers:

```json
{
  "mcpServers": {
    "evidence-intake": {
      "command": "node",
      "args": ["/path/to/chittymcp/legacy-backup/mcp-evidence-server/index.js"]
    }
  }
}
```

---

## Monitoring & Alerting

### Cloudflare Analytics

View in Cloudflare dashboard:
- Request volume
- Error rates
- Latency percentiles
- CPU usage

### Custom Monitoring

```bash
# Create health check endpoint (add to server)
app.get('/health', () => ({
  status: 'healthy',
  version: '3.0.0',
  tools: server.tools.size,
  uptime: process.uptime()
}));

# Monitor with cron
*/5 * * * * curl -f https://mcp.chitty.cc/health || echo "Health check failed"
```

### Log Aggregation

**Local**:
```bash
# Tail all logs
tail -f ~/Library/Logs/chittymcp-*.log

# Search for errors
grep ERROR ~/Library/Logs/chittymcp-*.log
```

**Cloudflare**:
```bash
# Stream logs
wrangler tail chittymcp-unified

# Filter for errors
wrangler tail chittymcp-unified | grep ERROR
```

---

## Cost Estimation

### Cloudflare Workers (Free Tier)

- **Requests**: 100,000/day free
- **CPU time**: 10ms/request
- **Memory**: 128MB
- **KV reads**: 100,000/day free
- **R2 storage**: 10GB free

**Estimated cost for typical usage**: $0-5/month

### Local Deployment

- **Infrastructure**: $0 (runs on your machine)
- **Electricity**: ~$1/month (always-on Mac Mini)

---

## Support

### Documentation
- `README.md` - Project overview
- `MIGRATION.md` - Migration from v2.x
- `CONSOLIDATION_SUMMARY.md` - Technical details

### Issues
- GitHub: https://github.com/chittyos/chittymcp/issues
- Discord: https://discord.gg/chittyos (coming soon)

### Professional Support
- Contact: support@chittycorp.com
- SLA options available

---

**Last Updated**: 2025-12-10
**Version**: 3.0.0
