const encoder = new TextEncoder();
const decoder = new TextDecoder();
const clone = value => structuredClone(value);
const characterLength = value => [...value].length;

function requireText(value, name, max, minimum = 1) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.length > max) {
    throw new Error(`${name} must contain ${minimum}–${max} characters.`);
  }
  return value;
}

export function validateOrganizedMemory(memory, original) {
  if (!memory || memory.originalText !== original) throw new Error('Gemini returned a different original note. Your text has been kept.');
  requireText(memory.title, 'Title', 120);
  if (typeof memory.summary !== 'string' || memory.summary.length > 1200) throw new Error('The summary is invalid.');
  requireText(memory.category, 'Category', 80);
  if (!Array.isArray(memory.tags) || memory.tags.length > 12 || memory.tags.some(tag => typeof tag !== 'string' || tag.length > 60)) throw new Error('The tags are invalid.');
  if (!Array.isArray(memory.fields) || memory.fields.length > 20 || !Array.isArray(memory.dates) || memory.dates.length > 12) throw new Error('The extracted facts are invalid.');
  for (const field of memory.fields) {
    requireText(field.label, 'Fact label', 100);
    requireText(field.value, 'Fact value', 1000);
    if (typeof field.quote !== 'string' || !field.quote.trim() || !original.includes(field.quote) || !field.quote.includes(field.value)) throw new Error('A suggested fact has no matching evidence in your note.');
  }
  for (const date of memory.dates) {
    requireText(date.label, 'Date label', 100);
    const parsed = new Date(`${date.date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.date) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date.date) throw new Error('A suggested date is invalid.');
    if (typeof date.quote !== 'string' || !date.quote.trim() || !original.includes(date.quote)) throw new Error('A suggested date has no matching evidence in your note.');
  }
  return clone(memory);
}

export function buildAskRequest(question, records, selection, consent) {
  if (!consent) throw new Error('Please give consent before sending selected memories to Google Gemini.');
  requireText(question, 'Question', 1000);
  const selected = records.filter(record => selection.has(record.id));
  if (!selected.length) throw new Error('Select at least one memory first.');
  if (selected.length > 12) throw new Error('Select no more than 12 memories for one question.');
  const memories = selected.map(record => ({ id: record.id, title: record.title, text: record.originalText,
    fields: record.fields.map(({ label, value }) => ({ label, value })) }));
  for (const memory of memories) {
    for (const field of memory.fields) { requireText(field.label, 'Detail name', 100); requireText(field.value, 'Detail value', 1000); }
  }
  const total = memories.reduce((count, memory) => count + characterLength(memory.text) + characterLength(memory.title)
    + memory.fields.reduce((sum, field) => sum + characterLength(field.label) + characterLength(field.value), 0), 0);
  if (total > 24000) throw new Error('Selected notes, titles and details exceed 24,000 characters combined. Please select fewer memories.');
  return { question: question.trim(), memories };
}

export function validateAnswer(answer, memories) {
  if (!answer || typeof answer.answer !== 'string' || typeof answer.found !== 'boolean' || !Array.isArray(answer.citations)) throw new Error('Gemini returned an invalid answer.');
  if ((!answer.found && answer.citations.length) || (answer.found && !answer.citations.length)) throw new Error('The answer has invalid citations.');
  for (const citation of answer.citations) {
    const memory = memories.find(record => record.id === citation.id);
    const evidence = memory ? [memory.text, ...memory.fields.map(field => field.value)] : [];
    if (!memory || typeof citation.quote !== 'string' || !citation.quote.trim() || !evidence.some(text => text.includes(citation.quote))) {
      throw new Error('The answer contains a citation that does not match your selected records.');
    }
  }
  if (answer.found && !answer.answer.split(/\r?\n/).map(line => line.trim()).filter(Boolean).every(line => {
    const excerpt = line.replace(/[.!?。！？]+$/u, '').trim();
    return excerpt && answer.citations.some(citation => citation.quote.includes(excerpt));
  })) throw new Error('The answer includes wording not supported by its cited evidence.');
  return clone(answer);
}

export class MemoryDraft {
  constructor({ crypto = globalThis.crypto } = {}) { this.crypto = crypto; this.cancel(); }
  start(text) { this.cancel(); this.text = requireText(text, 'Note', 6000); }
  manual() {
    this.memory = { title: this.text.trim().split('\n')[0].slice(0, 80), summary: '', category: 'Note',
      tags: [], fields: [], dates: [], originalText: this.text };
    return this.memory;
  }
  review(memory) { this.memory = validateOrganizedMemory(memory, this.text); this.confirmedDates.clear(); return this.memory; }
  edit(memory) {
    this.text = memory.originalText;
    this.memory = clone(memory);
    this.confirmedDates = new Set(memory.dates.map((_, index) => index));
    return this.memory;
  }
  confirmDate(index, confirmed) { if (confirmed) this.confirmedDates.add(index); else this.confirmedDates.delete(index); }
  cancel() { this.text = ''; this.memory = null; this.confirmedDates = new Set(); }
  async save(vault) {
    if (!this.memory) throw new Error('There is no memory to save.');
    const memory = clone(this.memory);
    requireText(memory.title, 'Title', 120);
    requireText(memory.originalText, 'Original note', 6000);
    memory.id ||= this.crypto.randomUUID();
    const now = new Date().toISOString();
    memory.createdAt ||= now;
    memory.updatedAt = now;
    memory.dates = memory.dates.filter((_, index) => this.confirmedDates.has(index));
    const saved = await vault.save(memory);
    this.cancel();
    return saved;
  }
}

export class IndexedDBStorage {
  constructor(indexedDB = globalThis.indexedDB) { this.indexedDB = indexedDB; }
  async database() {
    if (!this.indexedDB) throw new Error('This browser does not support the local vault. Use a current browser with IndexedDB enabled.');
    if (!this.promise) this.promise = new Promise((resolve, reject) => {
      const request = this.indexedDB.open('starline-memory-vault', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('keys');
        request.result.createObjectStore('memories', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('The local vault could not be opened. Browser storage may be blocked.'));
      request.onblocked = () => reject(new Error('Close older Starline Memory tabs and try again.'));
    });
    return this.promise;
  }
  async transaction(storeName, mode, operation) {
    const database = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      let result;
      operation(transaction.objectStore(storeName), value => { result = value; });
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(new Error('The local vault could not be updated. Check browser storage space.'));
      transaction.onabort = () => reject(new Error('The local vault operation was cancelled. Your note has not been discarded.'));
    });
  }
  getOrCreateKey(candidate) {
    return this.transaction('keys', 'readwrite', (store, done) => {
      const request = store.get('aes-gcm-v1');
      request.onsuccess = () => {
        if (request.result) done(request.result);
        else { store.put(candidate, 'aes-gcm-v1'); done(candidate); }
      };
    });
  }
  list() { return this.transaction('memories', 'readonly', (store, done) => { const request = store.getAll(); request.onsuccess = () => done(request.result); }); }
  put(record) { return this.transaction('memories', 'readwrite', store => { store.put(record); }); }
  remove(id) { return this.transaction('memories', 'readwrite', store => { store.delete(id); }); }
}

export class MemoryVault {
  constructor({ storage = new IndexedDBStorage(), crypto = globalThis.crypto } = {}) { this.storage = storage; this.crypto = crypto; }
  async initialize() {
    if (!this.crypto?.subtle) throw new Error('Local encryption needs HTTPS or localhost in a current browser.');
    if (!this.initialization) this.initialization = (async () => {
      const candidate = await this.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      this.key = await this.storage.getOrCreateKey(candidate);
    })();
    return this.initialization;
  }
  async save(memory) {
    await this.initialize();
    const iv = this.crypto.getRandomValues(new Uint8Array(12));
    const record = clone(memory);
    record.id ||= this.crypto.randomUUID();
    const ciphertext = await this.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(record.id) }, this.key, encoder.encode(JSON.stringify(record)));
    await this.storage.put({ id: record.id, iv: iv.buffer, ciphertext });
    return record;
  }
  async list() {
    await this.initialize();
    const rows = await this.storage.list();
    try {
      const records = await Promise.all(rows.map(async row => {
        const plaintext = await this.crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv, additionalData: encoder.encode(row.id) }, this.key, row.ciphertext);
        const record = JSON.parse(decoder.decode(plaintext));
        if (record.id !== row.id) throw new Error('Record identity mismatch');
        return record;
      }));
      return records.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } catch { throw new Error('A saved memory could not be opened. Existing encrypted records have been kept. Do not clear browser storage.'); }
  }
  async remove(id) { await this.initialize(); await this.storage.remove(id); }
}
