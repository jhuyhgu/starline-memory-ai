import { MemoryVault, MemoryDraft, buildAskRequest, validateAnswer } from './vault.js';
import { createConfirmation } from './confirmation.js';

const $ = id => document.getElementById(id);
const vault = new MemoryVault();
const draft = new MemoryDraft();
const askConfirmation = createConfirmation({ dialog: $('confirmation-dialog'), title: $('confirmation-title'),
  message: $('confirmation-message'), confirmButton: $('confirmation-confirm'), cancelButton: $('confirmation-cancel') });
const state = { records: [], selection: new Set(), activeId: null, vaultReady: false, organizing: false,
  asking: false, organizeController: null, askController: null, answerContext: null, ai: null };
const sample = `FICTIONAL SAMPLE — work handoff
On 18 October 2026, the demo team agreed that Maya will send the onboarding checklist by 23 October 2026.
The client prefers a Tuesday product walkthrough, but no date has been confirmed.
Budget approval is still pending. No final launch date has been agreed.`;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function error(id, message = '') { $(id).textContent = message; $(id).hidden = !message; }
function toast(message) { $('toast').textContent = message; $('toast').hidden = !message; }
function setView(view) {
  for (const name of ['capture', 'ask']) {
    $(`${name}-workspace`).hidden = name !== view;
    $(`${name}-tab`).classList.toggle('active', name === view);
    $(`${name}-tab`).setAttribute('aria-selected', String(name === view));
    $(`${name}-tab`).tabIndex = name === view ? 0 : -1;
  }
}
function dateText(value) {
  try { return new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' }); }
  catch { return ''; }
}
function hasDraft() { return Boolean($('capture-text').value.trim() || draft.memory); }
async function discardDraft() {
  if (hasDraft() && !await askConfirmation({ title: 'Discard this draft?',
    message: 'Your unsaved changes will be removed. Saved memories will stay in your vault.', confirmLabel: 'Discard draft', danger: true })) return false;
  state.organizeController?.abort();
  draft.cancel();
  $('capture-text').value = '';
  $('review-form').hidden = true;
  $('review-empty').hidden = false;
  $('review-state').textContent = 'Waiting for a note';
  $('character-count').textContent = '0 / 6,000';
  error('capture-error'); error('review-error');
  return true;
}
async function showCapture({ discard = false } = {}) {
  if (discard && !await discardDraft()) return false;
  state.activeId = null;
  $('memory-detail').hidden = true;
  document.querySelector('.capture-grid').hidden = false;
  setView('capture');
  renderLibrary();
  return true;
}

async function requestJSON(path, body, controller) {
  const requestController = controller || new AbortController();
  const timer = setTimeout(() => requestController.abort('timeout'), 90000);
  try {
    const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined, signal: requestController.signal, credentials: 'same-origin' });
    const value = await response.json().catch(() => null);
    if (!response.ok) throw new Error(value?.error?.message || `The service could not complete this request (${response.status}). Your draft is still here.`);
    if (!value) throw new Error('The service returned an unreadable response. Your draft is still here.');
    return value;
  } catch (reason) {
    if (requestController.signal.reason === 'timeout') throw new Error('Gemini took too long to respond. Try again, or save your note manually.');
    if (reason.name === 'TypeError') throw new Error('The service could not be reached. Check your connection, or save your note manually.');
    throw reason;
  } finally { clearTimeout(timer); }
}

async function refreshRecords() {
  state.records = await vault.list();
  state.vaultReady = true;
  renderLibrary();
  renderSelection();
  $('save-memory').disabled = false;
}
function renderLibrary() {
  const list = $('memory-list');
  list.replaceChildren();
  $('memory-count').textContent = String(state.records.length);
  $('export-memories').disabled = !state.records.length || !state.vaultReady;
  const search = $('memory-search').value.trim().toLowerCase();
  const records = state.records.filter(record => [record.title, record.summary, record.category, record.originalText,
    ...(record.tags || []), ...(record.fields || []).map(field => field.value)].join(' ').toLowerCase().includes(search));
  if (!records.length) list.append(element('p', 'library-empty', state.records.length ? 'No matching memories.' : 'Your saved memories will appear here. Start with a note.'));
  for (const record of records) {
    const row = element('div', `memory-item${state.activeId === record.id ? ' active' : ''}`);
    const checkbox = element('input');
    checkbox.type = 'checkbox'; checkbox.checked = state.selection.has(record.id);
    checkbox.setAttribute('aria-label', `Select ${record.title} for a question`);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked && state.selection.size >= 12) {
        checkbox.checked = false; toast('You can select up to 12 memories for one question.'); return;
      }
      if (checkbox.checked) state.selection.add(record.id); else state.selection.delete(record.id);
      resetAnswer(); renderSelection();
    });
    const button = element('button');
    button.type = 'button'; button.append(element('h3', '', record.title), element('p', '', record.summary || record.originalText));
    const meta = element('span', 'record-meta', `${record.category || 'Note'} · ${dateText(record.updatedAt)}`);
    if (record.isSample) meta.append(element('span', 'sample-tag', ' · Fictional sample'));
    button.append(meta);
    button.addEventListener('click', () => openMemory(record));
    row.append(checkbox, button); list.append(row);
  }
}
function renderSelection() {
  $('selected-count').textContent = String(state.selection.size);
  $('selection-hint').textContent = state.selection.size ? `${state.selection.size} selected for your question · max 12` : 'Select memories to ask a question.';
  $('clear-selection').hidden = !state.selection.size;
  $('ask-consent').checked = false;
  $('ask-consent-label').textContent = `Send ${state.selection.size ? `these ${state.selection.size} selected memories` : 'my selected memories'} and this question to Google Gemini for this request.`;
  const container = $('selected-records'); container.replaceChildren();
  for (const record of state.records.filter(item => state.selection.has(item.id))) container.append(element('span', 'selected-chip', record.title));
  if (!state.selection.size) container.append(element('p', 'no-selection', 'Select records using the checkboxes in Your memories. Your vault is never sent automatically.'));
  updateAskButton();
}
function updateAskButton() { $('ask-button').disabled = state.asking || !state.selection.size || !$('ask-question').value.trim() || !$('ask-consent').checked; }
function resetAnswer() {
  state.askController?.abort();
  state.answerContext = null;
  $('answer-empty').hidden = false;
  $('answer-result').hidden = true;
  $('answer-result').replaceChildren();
  error('ask-error');
}

function renderReview() {
  const memory = draft.memory;
  if (!memory) return;
  $('review-form').hidden = false;
  $('review-empty').hidden = true;
  $('review-title').value = memory.title;
  $('review-category').value = memory.category;
  $('review-tags').value = memory.tags.join(', ');
  $('review-summary').value = memory.summary;
  $('review-original').textContent = memory.originalText;
  $('review-state').textContent = memory.id ? 'Editing saved memory' : 'Not saved yet';
  $('save-memory').textContent = memory.id ? 'Save changes' : 'Save memory';
  $('save-memory').disabled = !state.vaultReady;
  renderFields(); renderDates();
}
function renderFields() {
  const container = $('review-fields'); container.replaceChildren();
  if (!draft.memory.fields.length) container.append(element('p', 'muted small', 'No details added. You can keep this as a simple note.'));
  draft.memory.fields.forEach((field, index) => {
    const row = element('div', 'fact-row');
    const inputs = element('div', 'fact-inputs');
    for (const [key, placeholder, maximum] of [['label', 'Detail name', 100], ['value', 'Value', 1000]]) {
      const input = element('input'); input.value = field[key]; input.placeholder = placeholder; input.maxLength = maximum;
      input.setAttribute('aria-label', `${placeholder} ${index + 1}`);
      input.addEventListener('input', () => { field[key] = input.value; });
      inputs.append(input);
    }
    const remove = element('button', 'remove-field', '×'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove detail ${index + 1}`);
    remove.addEventListener('click', () => { draft.memory.fields.splice(index, 1); renderFields(); });
    inputs.append(remove); row.append(inputs);
    if (field.quote) row.append(element('p', 'evidence', `Source: “${field.quote}”`));
    else row.append(element('p', 'evidence', 'Added by you.'));
    container.append(row);
  });
}
function renderDates() {
  const container = $('review-dates'); container.replaceChildren();
  $('review-dates-section').hidden = !draft.memory.dates.length;
  draft.memory.dates.forEach((date, index) => {
    const row = element('div', 'date-row');
    const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = draft.confirmedDates.has(index);
    checkbox.id = `date-confirm-${index}`; checkbox.setAttribute('aria-label', `Confirm ${date.label}`);
    checkbox.addEventListener('change', () => draft.confirmDate(index, checkbox.checked));
    const label = element('label'); label.htmlFor = checkbox.id; label.append(element('strong', '', date.label));
    const input = element('input'); input.type = 'date'; input.value = date.date;
    input.setAttribute('aria-label', `${date.label} date`);
    input.addEventListener('input', () => { date.date = input.value; checkbox.checked = false; draft.confirmDate(index, false); });
    label.append(input, element('p', 'evidence', `Source: “${date.quote}”`));
    row.append(checkbox, label); container.append(row);
  });
}

function detailContent(record, quote) {
  const fragment = document.createDocumentFragment();
  if (record.summary) fragment.append(element('p', 'detail-summary', record.summary));
  if (record.isSample) fragment.append(element('p', 'detail-meta sample-tag', 'Fictional sample · demonstration data'));
  const details = element('dl', 'detail-fields');
  for (const field of [...(record.fields || []), ...(record.dates || []).map(date => ({ label: date.label, value: date.date }))]) {
    const item = element('div'); item.append(element('dt', '', field.label), element('dd', '', field.value)); details.append(item);
  }
  if (details.childNodes.length) fragment.append(details);
  fragment.append(element('h3', 'detail-original-heading', 'Original note'));
  const original = element('pre', 'original-copy');
  if (quote && record.originalText.includes(quote)) {
    const position = record.originalText.indexOf(quote);
    original.append(document.createTextNode(record.originalText.slice(0, position)), element('mark', '', quote), document.createTextNode(record.originalText.slice(position + quote.length)));
  } else original.textContent = record.originalText;
  fragment.append(original);
  return fragment;
}
async function openMemory(record) {
  if (hasDraft() && !await discardDraft()) return;
  setView('capture'); state.activeId = record.id;
  document.querySelector('.capture-grid').hidden = true;
  const detail = $('memory-detail'); detail.hidden = false; detail.replaceChildren();
  const heading = element('div', 'detail-heading');
  const title = element('div'); const h2 = element('h2', '', record.title); h2.id = 'detail-title';
  title.append(h2, element('p', 'detail-meta', `${record.category || 'Note'} · Saved ${dateText(record.updatedAt)} · This browser only`));
  const actions = element('div', 'detail-actions');
  const edit = element('button', 'button quiet', 'Edit'); edit.addEventListener('click', () => {
    draft.edit(record); $('capture-text').value = record.originalText;
    $('character-count').textContent = `${record.originalText.length.toLocaleString('en')} / 6,000`;
    showCapture(); renderReview();
  });
  const remove = element('button', 'button quiet danger-button', 'Delete');
  remove.addEventListener('click', async () => {
    if (!await askConfirmation({ title: 'Delete this memory?', message: `“${record.title}” will be removed from this browser. This cannot be undone.`, confirmLabel: 'Delete memory', danger: true })) return;
    remove.disabled = true;
    try {
      await vault.remove(record.id); state.selection.delete(record.id); resetAnswer();
      await refreshRecords(); showCapture(); toast('Memory deleted from this browser.');
    } catch (reason) { toast(''); error('vault-error', reason.message); remove.disabled = false; }
  });
  actions.append(edit, remove); heading.append(title, actions); detail.append(heading, detailContent(record));
  renderLibrary();
}

$('capture-text').addEventListener('input', () => {
  $('character-count').textContent = `${$('capture-text').value.length.toLocaleString('en')} / 6,000`;
  error('capture-error');
  if (draft.memory) {
    draft.cancel(); $('review-form').hidden = true; $('review-empty').hidden = false;
    $('review-state').textContent = 'Note changed · review again';
  }
});
$('organize-button').addEventListener('click', async () => {
  if (state.organizing) return;
  const text = $('capture-text').value;
  if (text.trim().length < 2) { error('capture-error', 'Write at least two characters to organize a note.'); return; }
  state.organizing = true; state.organizeController = new AbortController();
  $('organize-button').disabled = true; $('organize-button').textContent = 'Organizing with Gemini…';
  $('manual-button').disabled = true; $('capture-text').disabled = true;
  error('capture-error'); toast('');
  try {
    const result = await requestJSON('/api/organize', { text, language: 'en' }, state.organizeController);
    if (state.organizeController.signal.aborted) return;
    draft.start(text); draft.review(result.memory); draft.memory.isSample = text.startsWith('FICTIONAL SAMPLE');
    renderReview(); $('review-state').textContent = 'Gemini suggestions · please check';
    if (matchMedia('(max-width: 900px)').matches) $('review-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (reason) { if (reason.name !== 'AbortError') error('capture-error', reason.message); }
  finally {
    state.organizing = false; $('organize-button').disabled = false; $('organize-button').textContent = 'Organize with Gemini';
    $('manual-button').disabled = false; $('capture-text').disabled = false;
  }
});
$('manual-button').addEventListener('click', () => {
  try {
    draft.start($('capture-text').value); draft.manual(); draft.memory.isSample = draft.text.startsWith('FICTIONAL SAMPLE');
    error('capture-error'); renderReview(); $('review-title').focus();
  } catch (reason) { error('capture-error', reason.message); }
});
$('sample-button').addEventListener('click', async () => {
  if (hasDraft() && !await discardDraft()) return;
  $('capture-text').value = sample;
  $('capture-text').dispatchEvent(new Event('input'));
  $('capture-text').focus(); toast('Fictional sample loaded as a draft. It has not been saved.');
});
$('review-title').addEventListener('input', event => { if (draft.memory) draft.memory.title = event.target.value; });
$('review-category').addEventListener('input', event => { if (draft.memory) draft.memory.category = event.target.value; });
$('review-summary').addEventListener('input', event => { if (draft.memory) draft.memory.summary = event.target.value; });
$('review-tags').addEventListener('input', event => { if (draft.memory) draft.memory.tags = event.target.value.split(',').map(tag => tag.trim().slice(0, 60)).filter(Boolean).slice(0, 12); });
$('add-field').addEventListener('click', () => {
  if (draft.memory.fields.length >= 20) { error('review-error', 'Keep up to 20 details in one memory.'); return; }
  draft.memory.fields.push({ label: '', value: '', quote: '' }); renderFields();
  $('review-fields').querySelector('.fact-row:last-child input')?.focus();
});
$('review-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!draft.memory || !state.vaultReady) return;
  $('save-memory').disabled = true; error('review-error');
  try {
    draft.memory.title = draft.memory.title.trim();
    draft.memory.category = draft.memory.category.trim() || 'Note';
    draft.memory.fields = draft.memory.fields.filter(field => field.label.trim() && field.value.trim());
    for (const [index, date] of draft.memory.dates.entries()) {
      if (draft.confirmedDates.has(index) && !date.date) throw new Error('Choose a valid date or leave it unconfirmed.');
    }
    const saved = await draft.save(vault);
    $('capture-text').value = ''; $('review-form').hidden = true; $('review-empty').hidden = false;
    await refreshRecords(); openMemory(saved); toast('Memory saved and encrypted in this browser.');
  } catch (reason) { error('review-error', reason.message); }
  finally { $('save-memory').disabled = !state.vaultReady; }
});
$('cancel-draft').addEventListener('click', async () => { if (await discardDraft()) { showCapture(); toast('Draft cancelled. No changes were saved.'); } });
$('new-memory').addEventListener('click', async () => { if (await showCapture({ discard: true })) $('capture-text').focus(); });
$('capture-tab').addEventListener('click', () => setView('capture'));
$('ask-tab').addEventListener('click', () => setView('ask'));
for (const tab of [$('capture-tab'), $('ask-tab')]) tab.addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const other = tab.id === 'capture-tab' ? $('ask-tab') : $('capture-tab'); other.click(); other.focus(); }
});
$('memory-search').addEventListener('input', renderLibrary);
$('clear-selection').addEventListener('click', () => { state.selection.clear(); resetAnswer(); renderLibrary(); renderSelection(); });
$('ask-question').addEventListener('input', () => { $('ask-consent').checked = false; resetAnswer(); updateAskButton(); });
$('ask-consent').addEventListener('change', updateAskButton);
$('ask-button').addEventListener('click', async () => {
  if (state.asking) return;
  let payload;
  try { payload = buildAskRequest($('ask-question').value, state.records, state.selection, $('ask-consent').checked); }
  catch (reason) { error('ask-error', reason.message); return; }
  state.asking = true; state.askController = new AbortController(); updateAskButton();
  $('ask-button').textContent = 'Looking through selected memories…'; error('ask-error');
  try {
    const result = await requestJSON('/api/ask', payload, state.askController);
    if (state.askController.signal.aborted) return;
    const answer = validateAnswer(result, payload.memories);
    state.answerContext = payload;
    const container = $('answer-result'); container.replaceChildren(); container.hidden = false; $('answer-empty').hidden = true;
    container.append(element('p', `answer-status${answer.found ? '' : ' not-found'}`, answer.found ? `Based on ${payload.memories.length} selected ${payload.memories.length === 1 ? 'memory' : 'memories'}` : 'Not found in these memories'), element('p', 'answer-copy', answer.answer));
    if (answer.citations.length) container.append(element('h3', 'citations-heading', 'Check the original records'));
    for (const [index, citation] of answer.citations.entries()) {
      const record = state.records.find(memory => memory.id === citation.id);
      const source = element('div', 'citation'); source.append(element('blockquote', '', `“${citation.quote}”`));
      const open = element('button'); open.append(element('span', '', `${index + 1}. ${record.title}`), element('span', '', 'Open original →'));
      open.addEventListener('click', () => { $('source-title').textContent = record.title; $('source-content').replaceChildren(detailContent(record, citation.quote)); $('source-dialog').showModal(); });
      source.append(open); container.append(source);
    }
    container.append(element('p', 'model-receipt', `${result.provider || 'Google Gemini'}${result.model ? ` · ${result.model}` : ''} · Only the selected records were sent.`));
  } catch (reason) { if (reason.name !== 'AbortError') error('ask-error', reason.message); }
  finally { state.asking = false; $('ask-button').textContent = 'Ask Gemini'; $('ask-consent').checked = false; updateAskButton(); }
});
$('privacy-details').addEventListener('click', () => $('privacy-dialog').showModal());
$('export-memories').addEventListener('click', () => $('export-dialog').showModal());
for (const name of ['source', 'privacy', 'export']) {
  $(`close-${name}`).addEventListener('click', () => $(`${name}-dialog`).close());
  $(`${name}-dialog`).addEventListener('click', event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close(); } });
}
$('confirm-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ format: 'starline-memory-v1', exportedAt: new Date().toISOString(), memories: state.records }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = element('a');
  link.href = url; link.download = `starline-memories-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); $('export-dialog').close(); toast('Readable export downloaded. Keep it somewhere you trust.');
});
async function initialize() {
  renderLibrary(); renderSelection(); $('save-memory').disabled = true;
  try { await refreshRecords(); }
  catch (reason) { state.vaultReady = false; error('vault-error', reason.message); }
  try {
    state.ai = await requestJSON('/api/health');
    const status = $('ai-status'); status.classList.add(state.ai.aiConfigured ? 'ready' : 'unavailable');
    status.lastElementChild.textContent = state.ai.aiConfigured ? 'Gemini ready' : 'Gemini not configured';
    if (!state.ai.aiConfigured) error('capture-error', 'Gemini is not configured on this server yet. You can still review and save a note manually.');
  } catch { $('ai-status').classList.add('unavailable'); $('ai-status').lastElementChild.textContent = 'Gemini unavailable'; }
}
initialize();
