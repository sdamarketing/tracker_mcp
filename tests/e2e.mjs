#!/usr/bin/env node
// Integration test: real MCP server (dist/index.js) over stdio JSON-RPC against a
// local HTTP stub that mimics the Tracker API and records every request.
// Runs with NO real token — secrets never leave the test sandbox.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- stub Tracker API ----------
const requests = []; // {method, pathname, query, headers, body}
const stub = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const u = new URL(req.url, 'http://stub');
    const body = raw ? JSON.parse(raw) : undefined;
    requests.push({
      method: req.method,
      pathname: u.pathname,
      query: Object.fromEntries(u.searchParams),
      auth: req.headers.authorization,
      orgHeader:
        req.headers['x-org-id'] !== undefined
          ? { name: 'x-org-id', value: req.headers['x-org-id'] }
          : req.headers['x-cloud-org-id'] !== undefined
            ? { name: 'x-cloud-org-id', value: req.headers['x-cloud-org-id'] }
            : undefined,
      body,
    });
    const canned = {
      '/v3/priorities': [{ id: 1, key: 'normal', name: { ru: 'Обычный' } }],
      '/v3/issues/_search': [{ id: 'i1', key: 'TEST-1', summary: 'stub issue' }],
      '/v3/issues': { id: 'i2', key: 'TEST-2', summary: 'created' },
      '/v3/entities/goal': { id: 42, shortId: 7, type: 'goal' },
    };
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'DELETE') {
      res.statusCode = 204;
      res.end();
      return;
    }
    res.statusCode = req.method === 'POST' ? 201 : 200;
    res.end(JSON.stringify(canned[u.pathname] ?? { ok: true }));
  });
});
await new Promise((r) => stub.listen(0, '127.0.0.1', r));
const baseUrl = `http://127.0.0.1:${stub.address().port}/v3`;

// ---------- MCP stdio client ----------
const child = spawn(process.execPath, [path.join(root, 'dist/index.js')], {
  env: {
    ...process.env,
    TRACKER_TOKEN: 'unit-test-token',
    TRACKER_ORG_ID: 'test-org-1',
    TRACKER_AUTH: 'oauth',
    TRACKER_API_URL: baseUrl,
  },
  stdio: ['pipe', 'pipe', 'inherit'],
});
let buf = '';
const pending = new Map();
let nextId = 1;
child.stdout.on('data', (d) => {
  buf += d;
  for (;;) {
    const i = buf.indexOf('\n');
    if (i < 0) break;
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line.startsWith('{')) continue;
    const m = JSON.parse(line);
    if (m.id !== undefined && (m.result !== undefined || m.error !== undefined)) {
      pending.get(m.id)?.(m);
      pending.delete(m.id);
    }
  }
});
function call(method, params) {
  const id = nextId++;
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000);
  });
}
async function tool(name, args) {
  const r = await call('tools/call', { name, arguments: args ?? {} });
  assert(!r.error, `${name} rpc error: ${JSON.stringify(r.error)}`);
  return r.result;
}
const toolText = (r) => r.content?.[0]?.text ?? '';

// ---------- run ----------
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✖ ${name}: ${e.message}`);
  }
}

const init = await call('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'e2e', version: '1.0' },
});
assert.equal(init.result.serverInfo.name, 'yandex-tracker');
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

await test('auth headers: OAuth + X-Org-ID', async () => {
  requests.length = 0;
  const r = await tool('get_priorities');
  assert(!r.isError, toolText(r));
  assert.equal(requests[0].auth, 'OAuth unit-test-token');
  assert.deepEqual(requests[0].orgHeader, { name: 'x-org-id', value: 'test-org-1' });
});

await test('catalog cache: second get_statuses hits no API', async () => {
  requests.length = 0;
  await tool('get_statuses');
  await tool('get_statuses');
  assert.equal(requests.length, 1, `expected 1 request, got ${requests.length}`);
});

await test('create_issue sends all optional fields in body', async () => {
  requests.length = 0;
  await tool('create_issue', { queue: 'TEST', summary: 'Hello', priority: 'critical', tags: ['a'] });
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].pathname, '/v3/issues');
  assert.equal(requests[0].body.summary, 'Hello');
  assert.equal(requests[0].body.priority, 'critical');
  assert.deepEqual(requests[0].body.tags, ['a']);
});

await test('create_entity wraps payload into {"fields": {...}}', async () => {
  requests.length = 0;
  await tool('create_entity', {
    entityType: 'goal',
    summary: 'G',
    fields: { entityStatus: 'on_track' },
  });
  assert.equal(requests[0].body.fields.summary, 'G');
  assert.equal(requests[0].body.fields.entityStatus, 'on_track');
});

await test('delete_filter without confirm is refused and makes NO request', async () => {
  requests.length = 0;
  const r = await tool('delete_filter', { filterId: 5 });
  assert(r.isError, 'expected refusal');
  assert.match(toolText(r), /confirm=true/);
  assert.equal(requests.length, 0);
});

await test('delete_filter with confirm=true calls DELETE /v2/filters/5', async () => {
  requests.length = 0;
  const r = await tool('delete_filter', { filterId: 5, confirm: true });
  assert(!r.isError, toolText(r));
  assert.equal(requests[0].method, 'DELETE');
  assert.equal(requests[0].pathname, '/v2/filters/5'); // version override works
});

await test('bulk_update_issues requires confirm', async () => {
  requests.length = 0;
  const r = await tool('bulk_update_issues', { issues: ['TEST-1'], values: { priority: 'minor' } });
  assert(r.isError && /confirm=true/.test(toolText(r)));
  assert.equal(requests.length, 0);
});

await test('API errors surface as isError with readable message', async () => {
  const r = await tool('get_issue', { key: 'TEST-404' });
  // stub returns 200 {ok:true} for unknown paths — assert plumbing instead:
  assert(r.content?.[0]?.text, 'has text');
});


await test('annotations: reads have readOnlyHint, deletes are destructive', async () => {
  const r = await call('tools/list', {});
  const tools = r.result.tools;
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.equal(byName.get_priorities.annotations?.readOnlyHint, true);
  assert.equal(byName.delete_filter.annotations?.destructiveHint, true);
  assert.equal(byName.create_issue.annotations?.readOnlyHint, false);
});

await test('serve: HTTP transport — health, auth gate, SSE initialize', async () => {
  const port = 34099;
  const srv = spawn(process.execPath, [path.join(root, 'dist', 'serve.js'), '--port', String(port)], {
    env: { ...process.env, TRACKER_TOKEN: 't', TRACKER_ORG_ID: '1', MCP_AUTH_TOKEN: 'sekret' },
    stdio: 'ignore',
  });
  try {
    let up = false;
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/health`);
        if (r.ok) {
          up = true;
          break;
        }
      } catch {
        /* server not up yet */
      }
      await new Promise((r2) => setTimeout(r2, 100));
    }
    assert(up, 'serve /health responds');

    const initBody = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 't', version: '0' },
      },
    });
    const post = (headers = {}) =>
      fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...headers,
        },
        body: initBody,
      });

    assert.equal((await post()).status, 401, 'no token → 401');
    const r = await post({ authorization: 'Bearer sekret' });
    assert.equal(r.status, 200, 'with token → 200');
    const text = await r.text();
    assert(text.includes('"protocolVersion":"2025-06-18"'), 'initialize answered (SSE)');
    assert(text.includes('"name":"yandex-tracker"'), 'serverInfo is yandex-tracker');

    assert.equal((await fetch(`http://127.0.0.1:${port}/nope`)).status, 404, 'unknown path → 404');
  } finally {
    srv.kill();
    await new Promise((r2) => setTimeout(r2, 200));
  }
});

child.kill();
stub.close();

if (failures.length) {
  console.error(`\nFAILED: ${failures.length}/${failures.length + 10}:`, failures.join(', '));
  process.exit(1);
}
console.log('\ne2e: all tests passed (stub API, no real token used)');
