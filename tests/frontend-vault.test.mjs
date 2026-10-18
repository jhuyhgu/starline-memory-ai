import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { MemoryVault, MemoryDraft, validateOrganizedMemory, validateAnswer, buildAskRequest } from '../public/vault.js';

const original = 'Fictional note: our design review is on 2026-10-23. Bring the revised prototype.';
const organized = () => ({ title: 'Design review', summary: 'Bring the revised prototype.', category: 'Work',
  tags: ['prototype'], fields: [{ label: 'Bring', value: 'revised prototype', quote: 'revised prototype' }],
  dates: [{ label: 'Review', date: '2026-10-23', quote: '2026-10-23' }], originalText: original });
function storage() {
  let key;
  const rows = new Map();
  return { rows, async getOrCreateKey(candidate) { key ??= candidate; return key; },
    async list() { return [...rows.values()]; }, async put(row) { rows.set(row.id, row); },
    async remove(id) { rows.delete(id); } };
}

test('vault encrypts every note and reopens with a persistent non-extractable key', async () => {
  const db = storage();
  const vault = new MemoryVault({ storage: db, crypto: webcrypto });
  const saved = await vault.save({ ...organized(), id: 'example-1' });
  const row = db.rows.get(saved.id);
  assert.ok(row.ciphertext instanceof ArrayBuffer);
  assert.equal(JSON.stringify(row).includes('Design review'), false);
  assert.equal(new TextDecoder().decode(row.ciphertext).includes(original), false);
  assert.equal(vault.key.extractable, false);
  await assert.rejects(webcrypto.subtle.exportKey('raw', vault.key));
  const reopened = new MemoryVault({ storage: db, crypto: webcrypto });
  assert.equal((await reopened.list())[0].originalText, original);
  await reopened.remove(saved.id);
  assert.equal((await reopened.list()).length, 0);
});

test('tampered ciphertext and swapped record identities fail closed', async () => {
  const db = storage();
  const vault = new MemoryVault({ storage: db, crypto: webcrypto });
  await vault.save({ ...organized(), id: 'example-1' });
  const row = db.rows.get('example-1');
  db.rows.set('example-1', { ...row, id: 'different-record' });
  await assert.rejects(vault.list(), /could not be opened/i);
  const corrupted = new Uint8Array(row.ciphertext.slice(0));
  corrupted[0] ^= 1;
  db.rows.set('example-1', { ...row, ciphertext: corrupted.buffer });
  await assert.rejects(vault.list(), /could not be opened/i);
});

test('review and cancel never save; explicit manual save works without any AI request', async () => {
  const db = storage();
  const vault = new MemoryVault({ storage: db, crypto: webcrypto });
  const draft = new MemoryDraft({ crypto: webcrypto });
  draft.start(original);
  draft.review(organized());
  assert.equal(db.rows.size, 0);
  draft.cancel();
  assert.equal(draft.memory, null);
  assert.equal(db.rows.size, 0);
  draft.start(original);
  draft.manual();
  draft.memory.title = 'Edited by the user';
  const saved = await draft.save(vault);
  assert.equal(saved.title, 'Edited by the user');
  assert.equal((await vault.list())[0].originalText, original);
});

test('AI facts require verbatim evidence and dates are omitted until confirmed', async () => {
  assert.throws(() => validateOrganizedMemory({ ...organized(), fields: [{ label: 'Place', value: 'London', quote: 'London' }] }, original), /evidence/i);
  assert.throws(() => validateOrganizedMemory({ ...organized(), originalText: 'different text' }, original), /original/i);
  const draft = new MemoryDraft({ crypto: webcrypto });
  draft.start(original);
  draft.review(organized());
  const vault = new MemoryVault({ storage: storage(), crypto: webcrypto });
  assert.deepEqual((await draft.save(vault)).dates, []);
  draft.start(original);
  draft.review(organized());
  draft.confirmDate(0, true);
  assert.equal((await draft.save(vault)).dates[0].date, '2026-10-23');
});

test('questions send only selected records and only after explicit consent', () => {
  const records = [{ ...organized(), id: 'selected' }, { ...organized(), id: 'private-unselected' }];
  assert.throws(() => buildAskRequest('What should I bring?', records, new Set(['selected']), false), /consent/i);
  const payload = buildAskRequest('What should I bring?', records, new Set(['selected']), true);
  assert.deepEqual(payload.memories.map(memory => memory.id), ['selected']);
  assert.equal(JSON.stringify(payload).includes('private-unselected'), false);
  assert.throws(() => buildAskRequest('?', records, new Set(), true), /select/i);
  assert.throws(() => buildAskRequest('?', Array.from({ length: 13 }, (_, i) => ({ ...organized(), id: String(i) })),
    new Set(Array.from({ length: 13 }, (_, i) => String(i))), true), /12/);
  assert.throws(() => buildAskRequest('What is due?', [{ ...organized(), id: 'large', originalText: 'x'.repeat(23990), title: 'A long title that exceeds the shared limit' }], new Set(['large']), true), /24,000/);
});

test('answer citations cannot escape selected records or invent evidence', () => {
  const memories = [{ id: 'selected', title: 'Design review', text: original, fields: [] }];
  assert.equal(validateAnswer({ answer: 'revised prototype', found: true,
    citations: [{ id: 'selected', quote: 'revised prototype' }] }, memories).found, true);
  assert.throws(() => validateAnswer({ answer: 'x', found: true, citations: [{ id: 'other', quote: 'prototype' }] }, memories), /citation/i);
  assert.throws(() => validateAnswer({ answer: 'x', found: true, citations: [{ id: 'selected', quote: 'invented' }] }, memories), /citation/i);
  assert.throws(() => validateAnswer({ answer: 'x', found: false, citations: [{ id: 'selected', quote: 'prototype' }] }, memories), /citation/i);
  assert.throws(() => validateAnswer({ answer: 'The tool is approved for launch.', found: true,
    citations: [{ id: 'selected', quote: 'revised prototype' }] }, memories), /evidence/i);
  assert.throws(() => validateAnswer({ answer: 'Owner', found: true,
    citations: [{ id: 'selected', quote: 'Owner' }] }, [{ ...memories[0], fields: [{ label: 'Owner', value: 'Maya' }] }]), /citation/i);
});

test('a real quote cannot support an invented extracted value', () => {
  assert.throws(() => validateOrganizedMemory({ ...organized(), fields: [{ label: 'Tool', value: 'Approved', quote: 'revised prototype' }] }, original), /evidence/i);
  const impossible = 'The review is on 2026-02-30.';
  assert.throws(() => validateOrganizedMemory({ ...organized(), originalText: impossible, fields: [],
    dates: [{ label: 'Review', date: '2026-02-30', quote: '2026-02-30' }] }, impossible), /date/i);
});
