/** Open or close a <dialog>, also in environments without showModal (jsdom). */
export function syncDialog(dialog, open) {
  if (open && !dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  } else if (!open && dialog.open) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
}
