#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateBaseURL(input) {
  const url = new URL(input);
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('Use a bare service URL with no credentials, query or path.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Use HTTPS for a remote live service.');
  return url.origin;
}
function check(condition, message) { if (!condition) throw new Error(message); }
function envelope(result, model) { check(result?.provider === 'Google Gemini' && result.model === model, 'Provider/model receipt does not match the expected real service configuration.'); }
function organization(result, text) {
  const memory = result.memory;
  check(memory && memory.originalText === text, 'Organization did not preserve the original fictional note.');
  check(typeof memory.title === 'string' && memory.title.trim() && typeof memory.summary === 'string' && memory.summary.trim(), 'Organization positive result is incomplete.');
  check(Array.isArray(memory.fields) && Array.isArray(memory.dates), 'Organization arrays are missing.');
  for (const field of memory.fields) check(typeof field.quote === 'string' && text.includes(field.quote) && field.quote.includes(field.value), 'An organized fact lacks verbatim source evidence.');
  for (const date of memory.dates) check(typeof date.quote === 'string' && text.includes(date.quote) && /^\d{4}-\d{2}-\d{2}$/.test(date.date), 'An organized date lacks source evidence.');
  return memory;
}
export async function runLiveSmoke({ baseURL, expectedModel = 'gemini-3.5-flash', fetchImpl = fetch, delayMs = 1500, log = value => console.log(JSON.stringify(value)) } = {}) {
  const origin = validateBaseURL(baseURL);
  const pause = () => new Promise(accept => setTimeout(accept, delayMs));
  async function request(path, body) {
    const response = await fetchImpl(origin + path, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json', origin } : {},
      body: body ? JSON.stringify(body) : undefined, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(70000) });
    let result;
    try { result = await response.json(); } catch { throw new Error(`Live service returned non-JSON (HTTP ${response.status}); no successful AI result is claimed.`); }
    if (!response.ok) throw new Error(`Live request failed: HTTP ${response.status}, code ${typeof result.error?.code === 'string' ? result.error.code : 'unknown'}. No raw note, model output or provider error is logged.`);
    return result;
  }
  const health = await request('/api/health');
  check(health.ok === true && health.aiConfigured === true, 'Google Gemini is not configured. Stop before sending any fictional sample notes.');
  envelope(health, expectedModel);
  log({ case: 'health', ok: true, provider: health.provider, model: health.model, note: 'configuration only; live cases follow' });

  const text = 'FICTIONAL SAMPLE. Rehearsal is on November 19, 2026 at 16:00 in Studio B. Reference code: BLUE-417.';
  const organized = await request('/api/organize', { text, language: 'en' });
  envelope(organized, expectedModel);
  const memory = organization(organized, text);
  check(memory.fields.some(field => field.value.includes('BLUE-417')), 'Positive organization did not extract the explicitly recorded reference code.');
  check(memory.dates.some(date => date.date === '2026-11-19'), 'Positive organization did not retain the explicit rehearsal date.');
  log({ case: 'organize-positive', ok: true, fields: memory.fields.length, dates: memory.dates.length, provider: organized.provider, model: organized.model });
  await pause();

  const uncertain = 'FICTIONAL SAMPLE. A spare prop key is kept in the blue tin. No exact expiry or deadline date has been recorded.';
  const withoutDates = await request('/api/organize', { text: uncertain, language: 'en' });
  envelope(withoutDates, expectedModel);
  const uncertainMemory = organization(withoutDates, uncertain);
  check(uncertainMemory.dates.length === 0, 'Negative organization invented a date that was not recorded.');
  log({ case: 'organize-negative-no-inferred-date', ok: true, dates: 0, provider: withoutDates.provider, model: withoutDates.model });
  await pause();

  const record = { id: 'fictional-rehearsal-smoke', title: memory.title, text, fields: memory.fields.map(({ label, value }) => ({ label, value })) };
  const positive = await request('/api/ask', { question: 'What is the recorded rehearsal reference code?', memories: [record] });
  envelope(positive, expectedModel);
  check(positive.found === true && typeof positive.answer === 'string' && positive.answer.includes('BLUE-417') && Array.isArray(positive.citations) && positive.citations.length > 0, 'Positive lookup did not find and cite the explicit fictional reference code.');
  for (const citation of positive.citations) check(citation.id === record.id && typeof citation.quote === 'string' && [text, ...record.fields.map(field => field.value)].some(source => source.includes(citation.quote)), 'Positive lookup contains an invalid source quote or record ID.');
  check(positive.answer.split(/\r?\n/).filter(line => line.trim()).every(line => positive.citations.some(citation => citation.quote.includes(line.trim().replace(/[.!?。！？]+$/u, '').trim()))), 'Positive lookup adds answer text outside its exact source quotes.');
  log({ case: 'ask-positive-cited', ok: true, citations: positive.citations.length, provider: positive.provider, model: positive.model });
  await pause();

  const negative = await request('/api/ask', { question: 'What is my passport number?', memories: [record] });
  envelope(negative, expectedModel);
  check(negative.found === false && Array.isArray(negative.citations) && negative.citations.length === 0, 'Negative lookup guessed an unsupported answer or fabricated a citation.');
  log({ case: 'ask-negative-unsupported', ok: true, citations: 0, provider: negative.provider, model: negative.model });
  const summary = { ok: true, liveCasesPassed: 4, provider: 'Google Gemini', model: expectedModel, persistedNotes: 0, credentialsSaved: false };
  log(summary);
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || !args[0]) {
    console.log('Usage: node scripts/live-smoke.mjs https://SERVICE.run.app [--expect-model gemini-3.5-flash]\nRuns four real, billable Google Gemini requests with fictional notes only. No credentials are read or saved; output is a non-sensitive pass/fail summary. No automatic retries.');
    if (!args[0]) process.exitCode = 1;
  } else {
    if ((args.length !== 1 && args.length !== 3) || (args.length === 3 && args[1] !== '--expect-model')) { console.error('Invalid smoke-runner arguments; see --help.'); process.exitCode = 1; }
    else runLiveSmoke({ baseURL: args[0], expectedModel: args[2] || 'gemini-3.5-flash' }).catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
