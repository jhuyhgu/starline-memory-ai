import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import * as backend from '../server.mjs';
import { createAIService } from '../ai.mjs';
test('HTTP server implements the prototype contract', () => {
  assert.equal(typeof backend?.createAppServer, 'function', 'HTTP API is not implemented yet');
});
const run = test;
const health = { ok: true, aiConfigured: true, provider: 'Google Gemini', model: 'test-model' };
async function fixture(t, options = {}) {
  const publicDir = await mkdtemp(join(tmpdir(), 'starline-backend-'));
  await writeFile(join(publicDir, 'index.html'), '<!doctype html><title>Starline Memory</title>');
  let calls = 0;
  const server = backend.createAppServer({ publicDir, aiService: {
    status: () => health,
    organize: async ({ text }) => { calls++; return { memory: { originalText: text }, provider: 'Google Gemini', model: 'test-model' }; },
    ask: async () => { calls++; return { answer: 'Not found.', found: false, citations: [], provider: 'Google Gemini', model: 'test-model' }; }
  }, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(publicDir, { recursive: true, force: true }); });
  return { url, server, calls: () => calls, post: (path, value, headers = {}) => fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value) }) };
}
run('health and static client are served without internal configuration', async t => {
  const app = await fixture(t);
  const response = await fetch(app.url + '/api/health');
  assert.deepEqual(await response.json(), health);
  const page = await fetch(app.url + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Starline Memory/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal((await fetch(app.url + '/server.mjs')).status, 404);
  assert.equal((await fetch(app.url + '/.env')).status, 404);
});
run('real HTTP organize accepts contract JSON and validates before AI', async t => {
  const app = await fixture(t);
  const valid = await app.post('/api/organize', { text: 'Fictional note', language: 'en' });
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).memory.originalText, 'Fictional note');
  const invalid = await app.post('/api/organize', { text: 'x', language: 'en' });
  assert.equal(invalid.status, 400);
  assert.equal(app.calls(), 1);
});
run('unconfigured real AI service reports unavailable without credentials or fake output', async t => {
  const app = await fixture(t, { aiService: createAIService({ env: {} }) });
  const status = await fetch(app.url + '/api/health');
  assert.deepEqual(await status.json(), { ok: true, aiConfigured: false, provider: 'Google Gemini', model: null });
  const response = await app.post('/api/organize', { text: 'Fictional note only', language: 'en' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED');
});
run('health discards any accidental internal configuration fields', async t => {
  const app = await fixture(t, { aiService: { status: () => ({ ...health, project: 'fictional-project', apiKey: 'test-only-not-a-key' }) } });
  assert.deepEqual(await (await fetch(app.url + '/api/health')).json(), health);
});
run('real HTTP rejects malformed JSON, oversized body and cross-origin browser calls', async t => {
  const app = await fixture(t, { limits: { bodyBytes: 128 } });
  const malformed = await fetch(app.url + '/api/organize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  const big = await app.post('/api/organize', { text: 'x'.repeat(150), language: 'en' });
  assert.equal(big.status, 413);
  const cross = await app.post('/api/organize', { text: 'Fictional', language: 'en' }, { origin: 'https://other.example' });
  assert.equal(cross.status, 400);
  assert.equal(cross.headers.get('access-control-allow-origin'), null);
  assert.equal(app.calls(), 0);
});
run('real HTTP ask caps selected records and returns the required response', async t => {
  const app = await fixture(t);
  const response = await app.post('/api/ask', { question: 'Where?', memories: [{ id: 'm1', title: 'Sample', text: 'Fictional sample.', fields: [] }] });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).found, false);
  const invalid = await app.post('/api/ask', { question: 'Where?', memories: Array.from({ length: 13 }, (_, n) => ({ id: String(n), title: 'Sample', text: 'Fictional sample.', fields: [] })) });
  assert.equal(invalid.status, 400);
});
run('chunked oversized JSON receives 413 without resetting the connection', async t => {
  const app = await fixture(t, { limits: { bodyBytes: 64 } });
  const result = await new Promise((resolve, reject) => {
    const request = httpRequest(app.url + '/api/organize', { method: 'POST', headers: { 'content-type': 'application/json' } }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, text }));
    });
    request.on('error', reject);
    request.write('{"text":"');
    request.write('x'.repeat(100));
    request.end('","language":"en"}');
  });
  assert.equal(result.status, 413);
  assert.equal(JSON.parse(result.text).error.code, 'BODY_TOO_LARGE');
});
run('public API has bounded rate protection', async t => {
  const app = await fixture(t, { limits: { requestsPerMinute: 2, globalRequestsPerMinute: 4 } });
  await app.post('/api/organize', { text: 'Fictional', language: 'en' });
  await app.post('/api/organize', { text: 'Fictional', language: 'en' });
  const limited = await app.post('/api/organize', { text: 'Fictional', language: 'en' });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
});
run('concurrent AI requests are capped and slot is released after failure', async t => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const app = await fixture(t, { limits: { maxConcurrent: 1 }, aiService: { status: () => health, organize: async () => { await blocked; throw new Error('private internal failure'); } } });
  const first = app.post('/api/organize', { text: 'Fictional', language: 'en' });
  await new Promise(resolve => setTimeout(resolve, 20));
  const second = await app.post('/api/organize', { text: 'Fictional', language: 'en' });
  assert.equal(second.status, 429);
  release();
  const failed = await first;
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private|internal/);
  assert.equal((await app.post('/api/organize', { text: 'Fictional', language: 'en' })).status, 503);
});
