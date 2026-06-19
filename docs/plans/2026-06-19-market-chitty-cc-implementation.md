# ChittyMarket Remote Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploys a new `chittymarket` Cloudflare Worker at `market.chitty.cc` that serves the plugin catalog manifests and installation profiles directly from a Workers KV namespace at the edge.

**Architecture:** A Hono-based Cloudflare Worker exposing REST API endpoints (`/health`, `/api/manifest`, `/api/plugins`, `/api/profiles`). It queries the `MARKET_CATALOG` KV namespace to resolve requests, caching payloads on the Cloudflare CDN edge to reduce KV reads.

**Tech Stack:** Cloudflare Workers, TypeScript, Hono, Workers KV, Vitest (tests)

---

### Task 1: Project Scaffolding
Create the directory structure, package configuration, and TypeScript configuration for the `chittymarket` worker.

**Files:**
* Create: `workers/chittymarket/package.json`
* Create: `workers/chittymarket/tsconfig.json`

**Step 1: Write the package and tsconfig configurations**

`package.json`:
```json
{
  "name": "chittymarket-server",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.12.24"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260608.1",
    "typescript": "^5.6.0",
    "vitest": "^4.1.8",
    "wrangler": "^4.0.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types", "vitest"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

**Step 2: Install dependencies**
Run: `pnpm install` in the `workers/chittymarket` folder.
Expected: `node_modules` is populated and TypeScript packages are ready.

**Step 3: Commit**
```bash
git add package.json tsconfig.json
git commit -m "feat(market): scaffold chittymarket project structure"
```

---

### Task 2: Wrangler Configuration
Create the Wrangler configuration declaring routes, custom domains, and the Workers KV namespace binding.

**Files:**
* Create: `workers/chittymarket/wrangler.jsonc`

**Step 1: Write the wrangler config**

`wrangler.jsonc`:
```json
{
  "name": "chittymarket",
  "main": "src/index.ts",
  "compatibility_date": "2026-03-24",
  "compatibility_flags": ["nodejs_compat"],
  "account_id": "0bc21e3a5a9de1a4cc843be9c3e98121",
  "kv_namespaces": [
    { "binding": "MARKET_CATALOG", "id": "placeholder-id" }
  ],
  "env": {
    "production": {
      "routes": [
        { "pattern": "market.chitty.cc", "custom_domain": true }
      ],
      "vars": {
        "ENVIRONMENT": "production",
        "SERVICE_NAME": "chittymarket",
        "SERVICE_VERSION": "2.0.0"
      }
    }
  }
}
```

**Step 2: Commit**
```bash
git add wrangler.jsonc
git commit -m "feat(market): add wrangler configuration"
```

---

### Task 3: Environmental Types Setup
Define type declarations for bindings and context properties.

**Files:**
* Create: `workers/chittymarket/src/types.ts`

**Step 1: Write environmental types**

`types.ts`:
```typescript
export interface Env {
  ENVIRONMENT: string;
  SERVICE_NAME: string;
  SERVICE_VERSION: string;
  MARKET_CATALOG: KVNamespace;
}

export interface DynamicPlugin {
  name: string;
  description: string;
  version: string;
  category: string;
  keywords: string[];
  requires: string[];
  source_type: string;
  install_url: string;
}
```

**Step 2: Commit**
```bash
git add src/types.ts
git commit -m "feat(market): declare typescript types for worker context"
```

---

### Task 4: Test Suite Scaffolding (TDD)
Write unit tests asserting health, manifest rendering, and profile lookups against a mock environment.

**Files:**
* Create: `workers/chittymarket/tests/index.test.ts`

**Step 1: Write tests**

`tests/index.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import app from "../src/index";

const mockKV = {
  get: vi.fn(),
};

const mockEnv = {
  ENVIRONMENT: "test",
  SERVICE_NAME: "chittymarket",
  SERVICE_VERSION: "2.0.0",
  MARKET_CATALOG: mockKV,
};

describe("ChittyMarket API", () => {
  it("GET /health returns health metadata", async () => {
    mockKV.get.mockResolvedValueOnce(JSON.stringify({ artifacts: [] }));
    const res = await app.fetch(new Request("http://localhost/health"), mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("chittymarket");
  });

  it("GET /api/manifest returns manifest data", async () => {
    const fakeManifest = { version: "1.0.0", plugins: { "chittyos-core": {} } };
    mockKV.get.mockResolvedValueOnce(JSON.stringify(fakeManifest));
    
    const res = await app.fetch(new Request("http://localhost/api/manifest"), mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe("1.0.0");
    expect(body.plugins).toHaveProperty("chittyos-core");
  });
});
```

**Step 2: Run tests to verify they fail (Red phase)**
Run: `pnpm test`
Expected: Failure because `src/index.ts` is not created yet.

**Step 3: Commit**
```bash
git add tests/index.test.ts
git commit -m "test(market): create baseline failing test suite"
```

---

### Task 5: Core Hono Application Implementation (TDD Green Phase)
Implement route mapping and Hono application logic.

**Files:**
* Create: `workers/chittymarket/src/index.ts`

**Step 1: Write core router code**

`src/index.ts`:
```typescript
import { Hono } from "hono";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", async (c) => {
  const manifest = await c.env.MARKET_CATALOG.get("manifest");
  let pluginsCount = 0;
  try {
    const parsed = JSON.parse(manifest || "{}");
    pluginsCount = Object.keys(parsed.plugins || {}).length;
  } catch {}

  return c.json({
    status: "ok",
    service: c.env.SERVICE_NAME,
    version: c.env.SERVICE_VERSION,
    plugins_count: pluginsCount,
  });
});

app.get("/api/manifest", async (c) => {
  const manifest = await c.env.MARKET_CATALOG.get("manifest");
  if (!manifest) return c.json({ error: "manifest_not_found" }, 404);
  c.header("Cache-Control", "public, max-age=3600");
  return c.json(JSON.parse(manifest));
});

app.get("/api/profiles", async (c) => {
  const profiles = await c.env.MARKET_CATALOG.get("profiles");
  if (!profiles) return c.json({ error: "profiles_not_found" }, 404);
  c.header("Cache-Control", "public, max-age=3600");
  return c.json(JSON.parse(profiles));
});

export default app;
```

**Step 2: Run tests to verify they pass (Green phase)**
Run: `pnpm test`
Expected: PASS

**Step 3: Commit**
```bash
git add src/index.ts
git commit -m "feat(market): implement core hono routes and handlers"
```
