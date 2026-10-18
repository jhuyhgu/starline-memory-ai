export function createConfirmation({ dialog, title, message, confirmButton, cancelButton }) {
  let pending = null;
  const close = value => dialog.close(value ? 'confirm' : 'cancel');
  confirmButton.addEventListener('click', () => close(true));
  cancelButton.addEventListener('click', () => close(false));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(false); });
  dialog.addEventListener('close', () => {
    const resolve = pending;
    pending = null;
    resolve?.(dialog.returnValue === 'confirm');
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close(false);
  });
  return options => {
    if (pending || dialog.open) return Promise.resolve(false);
    title.textContent = options.title;
    message.textContent = options.message;
    confirmButton.textContent = options.confirmLabel || 'Confirm';
    confirmButton.classList.toggle('danger-primary', Boolean(options.danger));
    dialog.returnValue = 'cancel';
    return new Promise(resolve => { pending = resolve; dialog.showModal(); });
  };
}
