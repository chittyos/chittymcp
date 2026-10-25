// Gateway-entrypoint identity forwarding (GATEWAY_BINDING_CONTRACT v0.1).
// Exercises the real worker module. env.SVC_* are in-process binding stand-ins
// (objects with a fetch method) that record what chittymcp sent upstream.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker/index.ts';
import { buildProxyRequest, upstreamAuthHeaders } from '../src/worker/gateway.ts';

const PRINCIPAL = 'did:chitty:03-1-USA-0650-P-2610-1-24';

function recordingBinding() {
  const calls = [];
  return {
    calls,
    async fetch(req) {
      calls.push(req);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }), {
        headers: { 'content-type': 'application/json' },
      });
    },
  };
}

function inbound(path, extra = {}) {
  return new Request(`https://mcp.chitty.cc${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer mcp-api-key-under-test',
      'x-chitty-caller': 'spoofed-admin',
      'X-Chitty-Via': 'spoofed-gateway',
      'x-chitty-anything': 'spoofed',
      ...extra,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list' }),
  });
}

function env(extra = {}) {
  return {
    MCP_API_KEY: 'mcp-api-key-under-test',
    CHITTY_AUTH_SERVICE_TOKEN: { get: async () => 'chittymcp-own-service-token' },
    SVC_OLMEC: recordingBinding(),
    SVC_NOTES: recordingBinding(),
    ...extra,
  };
}

describe('gateway entrypoint (olmec)', () => {
  it('G1: proxy request carries the resolved principal and strips inbound X-Chitty-*', () => {
    const req = buildProxyRequest(inbound('/olmec/mcp'), 'https://mcp.chitty.cc/mcp', { gateway: true }, 'chittymcp-own-service-token', PRINCIPAL);
    assert.ok(req);
    assert.equal(req.headers.get('x-chitty-caller'), PRINCIPAL);
    assert.equal(req.headers.get('x-chitty-via'), 'chittymcp');
    assert.equal(req.headers.get('x-chitty-anything'), null);
    assert.equal(req.headers.get('authorization'), null, 'neither chittymcp token nor client bearer forwarded');
    const xChitty = [...req.headers.keys()].filter((k) => k.startsWith('x-chitty-')).sort();
    assert.deepEqual(xChitty, ['x-chitty-caller', 'x-chitty-via']);
  });

  it('G1: aggregated upstream headers for a gateway service carry the principal, not the service token', () => {
    assert.deepEqual(upstreamAuthHeaders({ gateway: true }, 'chittymcp-own-service-token', PRINCIPAL), {
      'X-Chitty-Caller': PRINCIPAL,
      'X-Chitty-Via': 'chittymcp',
    });
  });

  it('G2: /olmec/mcp authenticated without a principal (MCP_API_KEY) is refused and the binding is not invoked', async () => {
    const e = env();
    const res = await worker.fetch(inbound('/olmec/mcp'), e);
    assert.equal(res.status, 403);
    assert.equal(e.SVC_OLMEC.calls.length, 0);
  });

  it('G2: aggregated tools/call to an olmec tool without a principal is refused, binding not invoked', async () => {
    const e = env();
    const req = new Request('https://mcp.chitty.cc/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mcp-api-key-under-test' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'olmec/gauntlet_run', arguments: {} } }),
    });
    const res = await worker.fetch(req, e);
    assert.equal(res.status, 403);
    assert.equal(e.SVC_OLMEC.calls.length, 0);
  });

  it('G2: upstreamAuthHeaders returns null for a gateway service with no principal', () => {
    assert.equal(upstreamAuthHeaders({ gateway: true }, 'chittymcp-own-service-token', null), null);
    assert.equal(upstreamAuthHeaders({ gateway: true }, 'chittymcp-own-service-token', ''), null);
  });

  it('G4: non-opted agent (notes) still receives chittymcp\'s own bearer, inbound headers untouched', async () => {
    const e = env();
    const res = await worker.fetch(inbound('/notes/mcp'), e);
    assert.equal(res.status, 200);
    assert.equal(e.SVC_NOTES.calls.length, 1);
    const sent = e.SVC_NOTES.calls[0];
    assert.equal(sent.headers.get('authorization'), 'Bearer chittymcp-own-service-token');
    assert.equal(new URL(sent.url).pathname, '/mcp');
    assert.equal(e.SVC_OLMEC.calls.length, 0);
  });
});
