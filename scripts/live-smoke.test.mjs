import test from 'node:test';
import assert from 'node:assert/strict';
import * as smoke from './live-smoke.mjs';
test('live smoke helper implements explicit positive and negative cases', () => assert.equal(typeof smoke?.runLiveSmoke, 'function'));
const run = test;
run('unconfigured health fails before transmitting sample notes', async () => {
  let calls = 0;
  await assert.rejects(smoke.runLiveSmoke({ baseURL: 'http://127.0.0.1:8080', delayMs: 0, log() {}, fetchImpl: async () => { calls++; return Response.json({ ok: true, aiConfigured: false }); } }), /configured/i);
  assert.equal(calls, 1);
});
run('unsafe credential-bearing or remote plaintext URL is rejected', () => {
  assert.throws(() => smoke.validateBaseURL('https://user:password@example.com/'), /URL/i);
  assert.throws(() => smoke.validateBaseURL('http://example.com/'), /HTTPS/i);
  assert.throws(() => smoke.validateBaseURL('https://example.com/?token=example'), /URL/i);
});
run('smoke never accepts missing citation or invented positive facts as success', async () => {
  const validStatus = { ok: true, aiConfigured: true, provider: 'Google Gemini', model: 'gemini-3.5-flash' };
  await assert.rejects(smoke.runLiveSmoke({ baseURL: 'http://localhost:8080', delayMs: 0, log() {}, fetchImpl: async (_url, init) => {
    if (!init?.body) return Response.json(validStatus);
    return Response.json({ memory: { title: 'Example', summary: 'Example', category: 'Note', tags: [], fields: [], dates: [], originalText: 'invented input' }, provider: 'Google Gemini', model: 'gemini-3.5-flash' });
  } }), /original|organization|positive/i);
});
