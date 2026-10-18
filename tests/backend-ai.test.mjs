import test from 'node:test';
import assert from 'node:assert/strict';
import * as ai from '../ai.mjs';

test('AI module implements the real integration boundary', () => {
  assert.equal(typeof ai?.createAIService, 'function', 'Google Gemini integration is not implemented yet');
});
const run = test;
const source = 'Fictional note: rehearsal is on October 21, 2026 at 16:00 in Studio B.';
const generated = () => ({ title: 'Rehearsal', summary: 'A rehearsal in Studio B.', category: 'Personal', tags: ['rehearsal'],
  fields: [{ label: 'Location', value: 'Studio B', quote: 'in Studio B' }],
  dates: [{ label: 'Rehearsal', date: '2026-10-21', quote: 'October 21, 2026' }] });
const record = { id: 'm1', title: 'Rehearsal', text: source, fields: [{ label: 'Location', value: 'Studio B' }] };

run('organize validates input length and language before sending anything', () => {
  assert.throws(() => ai.validateOrganizeInput({ text: 'a', language: 'en' }), /text/i);
  assert.throws(() => ai.validateOrganizeInput({ text: 'a'.repeat(6001), language: 'en' }), /text/i);
  assert.throws(() => ai.validateOrganizeInput({ text: source, language: 'fr' }), /language/i);
  assert.equal(ai.validateOrganizeInput({ text: '好'.repeat(6000), language: 'zh' }).text.length, 6000);
});
run('ask bounds selected memories, fields and combined text', () => {
  assert.throws(() => ai.validateAskInput({ question: 'q'.repeat(1001), memories: [record] }), /question/i);
  assert.throws(() => ai.validateAskInput({ question: 'Where?', memories: Array.from({ length: 13 }, (_, n) => ({ ...record, id: String(n) })) }), /memories/i);
  assert.throws(() => ai.validateAskInput({ question: 'Where?', memories: [{ ...record, text: 'a'.repeat(24001) }] }), /text/i);
  assert.throws(() => ai.validateAskInput({ question: 'Where?', memories: [record, record] }), /id/i);
});
run('organize omits unsupported field values, quotes and invented dates', () => {
  const raw = generated();
  raw.fields.push({ label: 'Invented', value: 'Studio Z', quote: 'in Studio B' }, { label: 'Hallucinated', value: 'passport', quote: 'not in note' });
  raw.dates.push({ label: 'Guessed expiry', date: '2036-10-21', quote: 'October 21, 2026' }, { label: 'Invalid day', date: '2026-02-31', quote: 'October 21, 2026' });
  const memory = ai.validateOrganizedOutput(raw, source);
  assert.equal(memory.originalText, source);
  assert.deepEqual(memory.fields, generated().fields);
  assert.deepEqual(memory.dates, generated().dates);
});
run('a longer numeric date cannot support a shorter day prefix', () => {
  const raw = generated();
  raw.dates = [{ label: 'Rehearsal', date: '2026-01-01', quote: '2026/1/12' }];
  assert.deepEqual(ai.validateOrganizedOutput(raw, 'Fictional rehearsal: 2026/1/12.').dates, []);
});
run('unsupported answer and malformed citation cannot appear as found', () => {
  for (const citation of [{ id: 'unknown', quote: 'Studio B' }, { id: 'm1', quote: 'Studio Z' }]) {
    const result = ai.validateAnswerOutput({ answer: 'It is Studio Z.', found: true, citations: [citation] }, [record]);
    assert.equal(result.found, false);
    assert.deepEqual(result.citations, []);
    assert.doesNotMatch(result.answer, /Studio Z/);
  }
  const result = ai.validateAnswerOutput({ answer: 'Studio B', found: false, citations: [{ id: 'm1', quote: 'Studio B' }] }, [record]);
  assert.equal(result.found, false);
  assert.deepEqual(result.citations, []);
});
run('valid lookup preserves only cited selected record IDs and exact quotes', () => {
  const result = ai.validateAnswerOutput({ answer: 'Studio B.', found: true, citations: [{ id: 'm1', quote: 'Studio B' }] }, [record]);
  assert.equal(result.found, true);
  assert.deepEqual(result.citations, [{ id: 'm1', quote: 'Studio B' }]);
});
run('a valid citation does not authorize an unsupported answer', () => {
  const result = ai.validateAnswerOutput({ answer: 'Studio Z.', found: true, citations: [{ id: 'm1', quote: 'Studio B' }] }, [record]);
  assert.equal(result.found, false);
  assert.deepEqual(result.citations, []);
});
run('unconfigured service never fabricates AI success or opens a client', async () => {
  const service = ai.createAIService({ env: {}, clientFactory() { assert.fail('must not construct SDK without configuration'); } });
  assert.deepEqual(service.status(), { ok: true, aiConfigured: false, provider: 'Google Gemini', model: null });
  await assert.rejects(service.organize({ text: source, language: 'en' }), error => error.status === 503 && error.code === 'AI_NOT_CONFIGURED');
});
run('Vertex ADC has priority over server-side API key and structured JSON is requested', async () => {
  let options; let request;
  const service = ai.createAIService({ env: { GOOGLE_CLOUD_PROJECT: 'fictional-project', GEMINI_API_KEY: 'test-only-not-a-key' },
    clientFactory(value) { options = value; return { models: { async generateContent(value) { request = value; return { text: JSON.stringify(generated()) }; } } }; } });
  const result = await service.organize({ text: source, language: 'en' });
  assert.equal(options.vertexai, true);
  assert.equal(options.project, 'fictional-project');
  assert.equal(options.apiKey, undefined);
  assert.equal(request.config.responseMimeType, 'application/json');
  assert.ok(request.config.responseJsonSchema);
  assert.equal(result.memory.originalText, source);
  assert.equal(result.provider, 'Google Gemini');
  assert.doesNotMatch(JSON.stringify(service.status()), /fictional-project|test-only/);
});
run('provider errors and malformed output are sanitized 503 errors', async () => {
  for (const generateContent of [async () => { throw new Error('sensitive upstream credentials and user text'); }, async () => ({ text: '<html>not JSON</html>' })]) {
    const service = ai.createAIService({ env: { GEMINI_API_KEY: 'test-only-not-a-key' }, clientFactory: () => ({ models: { generateContent } }) });
    await assert.rejects(service.organize({ text: source, language: 'en' }), error => {
      assert.equal(error.status, 503);
      assert.doesNotMatch(error.message, /sensitive|credentials|user text|html/);
      return true;
    });
  }
});
run('AI timeout aborts the provider operation and returns a clear error', async () => {
  let signal;
  const service = ai.createAIService({ env: { GEMINI_API_KEY: 'test-only-not-a-key' }, timeoutMs: 15,
    clientFactory: () => ({ models: { generateContent(request) { signal = request.config.abortSignal; return new Promise(() => {}); } } }) });
  await assert.rejects(service.organize({ text: source, language: 'en' }), error => error.status === 503 && error.code === 'AI_TIMEOUT');
  assert.equal(signal.aborted, true);
});
