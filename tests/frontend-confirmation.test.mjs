import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmation } from '../public/confirmation.js';

function fixture() {
  const dialog = new EventTarget();
  dialog.open = false;
  dialog.returnValue = '';
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = value => { dialog.returnValue = value; dialog.open = false; dialog.dispatchEvent(new Event('close')); };
  const confirmButton = new EventTarget();
  confirmButton.classList = { toggle() {} };
  const cancelButton = new EventTarget();
  const title = {}, message = {};
  return { dialog, confirmButton, cancelButton, title, message,
    ask: createConfirmation({ dialog, confirmButton, cancelButton, title, message }) };
}

test('page confirmation keeps a pending choice until the user explicitly confirms', async () => {
  const f = fixture();
  let settled = false;
  const choice = f.ask({ title: 'Discard draft?', message: 'The unsaved draft will be removed.', confirmLabel: 'Discard draft' });
  choice.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(f.dialog.open, true);
  assert.equal(settled, false);
  assert.equal(f.title.textContent, 'Discard draft?');
  f.confirmButton.dispatchEvent(new Event('click'));
  assert.equal(await choice, true);
  assert.equal(f.dialog.open, false);
});

test('cancel or Escape rejects discarding and a later dialog can be opened', async () => {
  const f = fixture();
  const cancelled = f.ask({ title: 'Discard draft?', message: 'Keep the note if cancelled.', confirmLabel: 'Discard' });
  f.cancelButton.dispatchEvent(new Event('click'));
  assert.equal(await cancelled, false);
  const escaped = f.ask({ title: 'Delete memory?', message: 'This removes a record.', confirmLabel: 'Delete' });
  const event = new Event('cancel', { cancelable: true });
  f.dialog.dispatchEvent(event);
  assert.equal(await escaped, false);
  assert.equal(f.dialog.open, false);
});

test('a second request cannot replace an unresolved confirmation', async () => {
  const f = fixture();
  const first = f.ask({ title: 'First', message: 'Keep this pending.', confirmLabel: 'Confirm' });
  assert.equal(await f.ask({ title: 'Second', message: 'Must not replace first.', confirmLabel: 'Confirm' }), false);
  assert.equal(f.title.textContent, 'First');
  f.cancelButton.dispatchEvent(new Event('click'));
  assert.equal(await first, false);
});
