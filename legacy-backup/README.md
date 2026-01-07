# Legacy Code Archive

This directory contains the original v2.x server implementations that have been superseded by the modular v3.0.0 architecture.

## Contents

- **mcp-evidence-server/** - Original evidence intake server (512 lines)
- **mcp-unified-consolidated/** - Original unified server (1,045 lines)

## Status

These servers are:
- ✅ **Functional** - Still work if needed
- ✅ **Superseded** - v3.0 versions are better
- ⚠️ **Deprecated** - Use `src/servers/` instead
- 📦 **Archived** - Kept for reference only

## Migration

The v3.0 modular equivalents are:
- `mcp-evidence-server/index.js` → `src/servers/evidence-server.js`
- `mcp-unified-consolidated/unified-server.js` → `src/servers/unified-server.js`

See `MIGRATION.md` in the root directory for complete migration guide.

## Why Archived?

1. **Code duplication** - 50%+ duplicated logic
2. **Static architecture** - Can't add tools dynamically
3. **Monolithic** - Hard to test and maintain
4. **Placeholder implementations** - Most tools were mocks

## Can I Delete This?

Yes, after verifying the v3.0 servers work correctly:

1. Test new servers for 1 week
2. Ensure all tools work as expected
3. Update all Claude Desktop configs
4. Delete this `legacy-backup/` directory

---

**Archived**: 2025-12-10
**Reason**: Superseded by modular v3.0.0 architecture
