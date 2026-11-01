// Gateway-entrypoint identity forwarding (GATEWAY_BINDING_CONTRACT v0.1).
// Exercises the real worker module. env.SVC_* are in-process binding stand-ins
// (objects with a fetch method) that record what chittymcp sent upstream.
// Access JWTs are real RS256 tokens signed by a locally generated key; the
// worker verifies them through the setAccessJwksForTest seam (gateway.ts).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import worker from '../src/worker/index.ts';
import {
  buildProxyRequest,
  principalFromAccessClaims,
  setAccessJwksForTest,
  upstreamAuthHeaders,
} from '../src/worker/gateway.ts';

const PRINCIPAL = 'did:chitty:03-1-USA-0650-P-2610-1-24';
const OLMEC = { binding: 'SVC_OLMEC' };
// Access mcp_portal "ChittyMCP" (mcp.chitty.cc) — the production allowlist value.
const ALLOWED_AUD = 'c36f8ba835de614d76c58a5f821f00e997ea00406364e40532363e4a096e36d8';
const FOREIGN_AUD = '0000000000000000000000000000000000000000000000000000000000000000';
const ACCESS_SUB = '7335d417-61da-459d-899c-0a01c76a2f94';

let signingKey;
before(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-kid', alg: 'RS256' };
  setAccessJwksForTest(createLocalJWKSet({ keys: [jwk] }));
  signingKey = privateKey;
});
after(() => setAccessJwksForTest(null));

function accessJwt(claims) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer('https://chittycorp.cloudflareaccess.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(signingKey);
}

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
      'cf-access-jwt-assertion': 'client-access-assertion',
      cookie: 'CF_Authorization=client-access-cookie',
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
    GATEWAY_ACCESS_AUDS: `${ALLOWED_AUD},533f180b8e0521413b33f265bf42a40c72dde3074a32300f4d5c84bfa9096332`,
    ...extra,
  };
}

describe('gateway entrypoint (olmec)', () => {
  it('G1: proxy request carries the resolved principal and strips inbound X-Chitty-*', () => {
    const req = buildProxyRequest(inbound('/olmec/mcp'), 'https://mcp.chitty.cc/mcp', OLMEC, 'chittymcp-own-service-token', PRINCIPAL);
    assert.ok(req);
    assert.equal(req.headers.get('x-chitty-caller'), PRINCIPAL);
    assert.equal(req.headers.get('x-chitty-via'), 'chittymcp');
    assert.equal(req.headers.get('x-chitty-anything'), null);
    assert.equal(req.headers.get('authorization'), null, 'neither chittymcp token nor client bearer forwarded');
    assert.equal(req.headers.get('cf-access-jwt-assertion'), null, 'client Access assertion not forwarded');
    assert.equal(req.headers.get('cookie'), null, 'client cookies (CF_Authorization) not forwarded');
    const xChitty = [...req.headers.keys()].filter((k) => k.startsWith('x-chitty-')).sort();
    assert.deepEqual(xChitty, ['x-chitty-caller', 'x-chitty-via']);
  });

  it('G1: aggregated upstream headers for a gateway service carry the principal, not the service token', () => {
    assert.deepEqual(upstreamAuthHeaders(OLMEC, 'chittymcp-own-service-token', PRINCIPAL), {
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
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'olmec/witness', arguments: {} } }),
    });
    const res = await worker.fetch(req, e);
    assert.equal(res.status, 403);
    assert.equal(e.SVC_OLMEC.calls.length, 0);
  });

  it('G2: upstreamAuthHeaders returns null for a gateway service with no principal', () => {
    assert.equal(upstreamAuthHeaders(OLMEC, 'chittymcp-own-service-token', null), null);
    assert.equal(upstreamAuthHeaders(OLMEC, 'chittymcp-own-service-token', ''), null);
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

  it('G4: non-opted agent never receives inbound X-Chitty-* either', async () => {
    const e = env();
    await worker.fetch(inbound('/notes/mcp'), e);
    const xChitty = [...e.SVC_NOTES.calls[0].headers.keys()].filter((k) => k.startsWith('x-chitty-'));
    assert.deepEqual(xChitty, []);
  });
});

// Finding 1: gateway handling must follow the BINDING, not the KV entry's sub.
describe('gateway keyed on binding name (KV registry cannot re-route SVC_OLMEC)', () => {
  const kvEnv = () => env({
    MCP_REGISTRY: {
      get: async () => JSON.stringify([
        { id: 'chittyagent-olmec', sub: 'gauntlet', binding: 'SVC_OLMEC', label: 'Gauntlet', posture: 'trusted' },
      ]),
    },
  });

  it('F1: KV {sub:gauntlet, binding:SVC_OLMEC} + MCP_API_KEY + forged caller → 403, SVC_OLMEC never called', async () => {
    const e = kvEnv();
    const res = await worker.fetch(inbound('/gauntlet/mcp', { 'x-chitty-caller': 'forged-admin' }), e);
    assert.equal(res.status, 403);
    assert.equal(e.SVC_OLMEC.calls.length, 0);
  });

  it('F1: same KV entry, aggregated tools/call gauntlet/witness → 403, SVC_OLMEC never called', async () => {
    const e = kvEnv();
    const req = new Request('https://mcp.chitty.cc/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mcp-api-key-under-test', 'x-chitty-caller': 'forged-admin' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'gauntlet/witness', arguments: {} } }),
    });
    const res = await worker.fetch(req, e);
    assert.equal(res.status, 403);
    assert.equal(e.SVC_OLMEC.calls.length, 0);
  });
});

describe('principalFromAccessClaims', () => {
  it('uses sub', () => assert.equal(principalFromAccessClaims({ sub: ACCESS_SUB, email: 'nick@chitty.cc' }), ACCESS_SUB));
  it('falls back to email when sub is absent', () => assert.equal(principalFromAccessClaims({ email: 'nick@chitty.cc' }), 'nick@chitty.cc'));
  it('falls back to email when sub is empty or blank', () => {
    assert.equal(principalFromAccessClaims({ sub: '', email: 'nick@chitty.cc' }), 'nick@chitty.cc');
    assert.equal(principalFromAccessClaims({ sub: '   ', email: 'nick@chitty.cc' }), 'nick@chitty.cc');
  });
  it('returns null when neither is a non-empty string', () => {
    assert.equal(principalFromAccessClaims({ sub: '', email: '' }), null);
    assert.equal(principalFromAccessClaims({ sub: 42 }), null);
    assert.equal(principalFromAccessClaims({}), null);
    assert.equal(principalFromAccessClaims(null), null);
  });
});

// Findings 2 + 3: verified Access principal reaches SVC_OLMEC only when the
// JWT aud is on GATEWAY_ACCESS_AUDS.
describe('verified Access principal through worker.fetch', () => {
  const olmecReq = (jwt, path = '/olmec/mcp', body) => new Request(`https://mcp.chitty.cc${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}`, 'x-chitty-caller': 'spoofed-admin' },
    body: JSON.stringify(body ?? { jsonrpc: '2.0', id: 7, method: 'tools/list' }),
  });

  it('S1: allowed aud → SVC_OLMEC receives X-Chitty-Caller=<sub>, X-Chitty-Via=chittymcp, no Authorization', async () => {
    const e = env();
    const jwt = await accessJwt({ sub: ACCESS_SUB, email: 'nick@chitty.cc', aud: [ALLOWED_AUD] });
    const res = await worker.fetch(olmecReq(jwt), e);
    assert.equal(res.status, 200);
    assert.equal(e.SVC_OLMEC.calls.length, 1);
    const sent = e.SVC_OLMEC.calls[0];
    assert.equal(sent.headers.get('x-chitty-caller'), ACCESS_SUB);
    assert.equal(sent.headers.get('x-chitty-via'), 'chittymcp');
    assert.equal(sent.headers.get('authorization'), null);
  });

  it('S1: aggregated tools/call olmec/witness with allowed aud carries the principal upstream', async () => {
    const e = env();
    const jwt = await accessJwt({ sub: ACCESS_SUB, aud: ALLOWED_AUD });
    const res = await worker.fetch(olmecReq(jwt, '/mcp', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'olmec/witness', arguments: {} } }), e);
    assert.equal(res.status, 200);
    assert.ok(e.SVC_OLMEC.calls.length >= 1);
    for (const sent of e.SVC_OLMEC.calls) {
      assert.equal(sent.headers.get('x-chitty-caller'), ACCESS_SUB);
      assert.equal(sent.headers.get('x-chitty-via'), 'chittymcp');
      assert.equal(sent.headers.get('authorization'), null);
    }
  });

  it('A1: foreign aud → 403, SVC_OLMEC never called', async () => {
    const e = env();
    const jwt = await accessJwt({ sub: ACCESS_SUB, aud: [FOREIGN_AUD] });
    const res = await worker.fetch(olmecReq(jwt), e);
    assert.equal(res.status, 403);
    assert.equal(e.SVC_OLMEC.calls.length, 0);
  });

  it('A1: unset GATEWAY_ACCESS_AUDS → 403 (fail closed), SVC_OLMEC never called', async () => {
    const e = env({ GATEWAY_ACCESS_AUDS: undefined });
    const jwt = await accessJwt({ sub: ACCESS_SUB, aud: [ALLOWED_AUD] });
    const res = await worker.fetch(olmecReq(jwt), e);
    assert.equal(res.status, 403);
    assert.equal(e.SVC_OLMEC.calls.length, 0);
  });

  it('A1: foreign aud does not affect non-gateway agents (notes still proxied)', async () => {
    const e = env();
    const jwt = await accessJwt({ sub: ACCESS_SUB, aud: [FOREIGN_AUD] });
    const res = await worker.fetch(olmecReq(jwt, '/notes/mcp'), e);
    assert.equal(res.status, 200);
    assert.equal(e.SVC_NOTES.calls.length, 1);
  });
});
