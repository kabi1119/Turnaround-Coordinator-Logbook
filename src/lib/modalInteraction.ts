/** One shared scroll surface for sheets, record navigation and nested-dialog return. */
export const modalScrollArea = (dialog: HTMLDialogElement) =>
  dialog.querySelector<HTMLElement>(':scope > .modal-body') || dialog;

export function isTextEntry(
  element: Element | null,
): element is HTMLInputElement | HTMLTextAreaElement {
  return (
    (element instanceof HTMLTextAreaElement ||
      (element instanceof HTMLInputElement &&
        ['text', 'search', 'email', 'tel', 'url', 'password', 'number'].includes(element.type))) &&
    !element.disabled &&
    !element.readOnly
  );
}

/** Native date/time/select controls need visibility protection too, without replacing their picker behavior. */
export function isEditableField(element: Element | null) {
  return (
    isTextEntry(element) ||
    (element instanceof HTMLSelectElement && !element.disabled) ||
    (element instanceof HTMLInputElement &&
      !element.disabled &&
      !element.readOnly &&
      ['date', 'time', 'datetime-local', 'month', 'week'].includes(element.type))
  );
}

export function textEntries(dialog: HTMLDialogElement) {
  return [
    ...modalScrollArea(dialog).querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input, textarea',
    ),
  ].filter(
    (el) =>
      isTextEntry(el) &&
      el.closest('dialog') === dialog &&
      !el.closest('[hidden], [inert]') &&
      !el.closest('details:not([open])') &&
      el.getClientRects().length > 0,
  );
}

/** Label + hint/error when they fit; otherwise prioritize the label/control, then the control itself. */
export function revealModalField(control: HTMLElement) {
  const dialog = control.closest('dialog');
  if (
    !dialog ||
    dialog.inert ||
    dialog.classList.contains('closing') ||
    [...document.querySelectorAll('dialog[open]')].at(-1) !== dialog
  )
    return;
  const viewport = window.visualViewport;
  if (viewport && viewport.scale && Math.abs(viewport.scale - 1) > 0.01) return; // Leave pinch zoom to the browser.
  const area = modalScrollArea(dialog),
    box = area.getBoundingClientRect();
  const top = Math.max(box.top, viewport?.offsetTop || 0);
  let bottom = Math.min(
    box.bottom,
    (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight),
  );
  const footer = area.querySelector<HTMLElement>('.sticky-actions');
  if (footer && getComputedStyle(footer).position === 'sticky')
    bottom = Math.min(bottom, footer.getBoundingClientRect().top);
  const input = control.getBoundingClientRect(),
    available = bottom - top;
  if (available <= 0 || input.height <= 0) return;
  let clearance = Math.min(20, Math.max(0, (available - input.height) / 3));
  const field = (
    control.closest('.airline-combobox, .field, .check') || control
  ).getBoundingClientRect();
  const popup = control
    .closest('.airline-combobox')
    ?.querySelector<HTMLElement>('[role="listbox"]');
  const popupBox = popup?.getBoundingClientRect();
  // Prefer input + options over the explanatory hint when the dropdown is open. Relax clearance in tight spaces.
  if (popupBox)
    clearance = Math.min(clearance, Math.max(0, (available - (popupBox.bottom - field.top)) / 2));
  const room = available - clearance * 2;
  const region =
    popupBox && input.bottom - field.top <= room
      ? { top: field.top, bottom: Math.min(popupBox.bottom, field.top + room) }
      : field.height <= room
        ? field
        : input.bottom - field.top <= room
          ? { top: field.top, bottom: input.bottom }
          : input;
  const delta =
    region.bottom > bottom - clearance
      ? region.bottom - bottom + clearance
      : region.top < top + clearance
        ? region.top - top - clearance
        : 0;
  if (Math.abs(delta) > 1) area.scrollTop += delta; // Only this surface, never document/background scrolling.
}

/** Validation explicitly requests one post-render check; no global scrollIntoView or keyboard toggling. */
export function focusModalField(control: HTMLElement) {
  control.focus({ preventScroll: true });
  control.dispatchEvent(new Event('modal-field-reveal', { bubbles: true }));
}

/** Combobox arrows scroll only their options, never ancestor sheets or the document. */
export function revealListOption(option: HTMLElement | null) {
  const list = option?.closest<HTMLElement>('[role="listbox"]');
  if (!option || !list) return;
  const item = option.getBoundingClientRect(),
    bounds = list.getBoundingClientRect();
  if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
  else if (item.top < bounds.top) list.scrollTop += item.top - bounds.top;
}
