import { useEffect, type RefObject } from 'react';
import {
  isEditableField,
  isTextEntry,
  modalScrollArea,
  revealModalField,
  textEntries,
} from './modalInteraction';

/** Event-driven decoration only. No polling, React state, per-keystroke measurement or height animation. */
export function useModalViewport(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const mounted = ref.current;
    if (!mounted) return;
    const dialog: HTMLDialogElement = mounted;
    const viewport = window.visualViewport,
      area = modalScrollArea(dialog);
    let frame = 0,
      settle: ReturnType<typeof setTimeout> | undefined,
      manual = false,
      upperPlaced = false;
    let lastWidth = viewport?.width || window.innerWidth;
    const requestFrame =
      window.requestAnimationFrame?.bind(window) ||
      ((fn: FrameRequestCallback) => window.setTimeout(() => fn(0), 0));
    const cancelFrame =
      window.cancelAnimationFrame?.bind(window) || window.clearTimeout.bind(window);
    const focused = () => {
      const el = document.activeElement;
      return el instanceof HTMLElement && dialog.contains(el) && el.closest('dialog') === dialog
        ? el
        : null;
    };
    function reveal() {
      frame = 0;
      const el = focused();
      if (!manual && el && (isEditableField(el) || el.matches('[aria-invalid="true"]'))) {
        const upper =
          !upperPlaced &&
          dialog.dataset.upperKeyboardFocus === 'true' &&
          dialog.dataset.keyboardOpen === 'true' &&
          isTextEntry(el);
        revealModalField(el, upper);
        if (upper) upperPlaced = true;
      }
    }
    function schedule() {
      if (!frame) frame = requestFrame(reveal);
    }
    function geometry() {
      const height = viewport?.height || window.innerHeight,
        width = viewport?.width || window.innerWidth;
      const scale = viewport?.scale || 1,
        top = viewport?.offsetTop || 0;
      const rotated = Math.abs(width - lastWidth) > Math.max(1, lastWidth * 0.1);
      lastWidth = width;
      const zoomed = Math.abs(scale - 1) > 0.01;
      const mobile =
        window.matchMedia?.('(any-pointer: coarse)').matches || window.innerWidth <= 767;
      // Require actual visual/layout occlusion as well as editable focus; browser/desktop resizing alone is insufficient.
      const keyboard =
        !zoomed &&
        !rotated &&
        mobile &&
        isEditableField(focused()) &&
        height < window.innerHeight * 0.75;
      dialog.dataset.keyboardOpen = String(Boolean(keyboard));
      if (zoomed) {
        dialog.removeAttribute('data-viewport-fit');
        return;
      }
      dialog.dataset.viewportFit = 'true';
      const properties = {
        '--modal-viewport-height': height,
        '--sheet-viewport-height': height,
        '--modal-viewport-top': top,
        '--modal-viewport-bottom': Math.max(0, window.innerHeight - top - height),
      };
      for (const [key, value] of Object.entries(properties)) {
        const px = `${value}px`;
        if (dialog.style.getPropertyValue(key) !== px) dialog.style.setProperty(key, px);
      }
    }
    function viewportChanged() {
      geometry();
      clearTimeout(settle);
      // Focus checks run immediately on a frame; a trailing viewport-event check handles keyboard settling.
      settle = setTimeout(schedule, 100);
    }
    function focusChanged() {
      manual = false;
      upperPlaced = false;
      geometry();
      const el = focused();
      if (el && isTextEntry(el) && !(el instanceof HTMLTextAreaElement)) {
        const entries = textEntries(dialog);
        el.setAttribute('enterkeyhint', entries.indexOf(el) < entries.length - 1 ? 'next' : 'done');
      }
      schedule();
    }
    function userScroll() {
      manual = true;
      clearTimeout(settle);
      if (frame) cancelFrame(frame);
      frame = 0;
    }
    function pointer(event: Event) {
      if (event.target === document.activeElement && isEditableField(document.activeElement))
        focusChanged();
    }
    function keyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key !== 'Enter' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const el = focused();
      if (!el || !isTextEntry(el) || el instanceof HTMLTextAreaElement || event.target !== el)
        return;
      event.preventDefault(); // Next/Done must never invoke a form's implicit submit.
      const entries = textEntries(dialog),
        next = entries[entries.indexOf(el) + 1];
      if (next) next.focus({ preventScroll: true });
      else el.blur();
    }
    geometry();
    dialog.addEventListener('focusin', focusChanged);
    dialog.addEventListener('focusout', geometry);
    dialog.addEventListener('modal-field-reveal', focusChanged);
    dialog.addEventListener('pointerdown', pointer);
    dialog.addEventListener('keydown', keyDown);
    area.addEventListener('touchmove', userScroll, { passive: true });
    area.addEventListener('wheel', userScroll, { passive: true });
    viewport?.addEventListener('resize', viewportChanged);
    viewport?.addEventListener('scroll', viewportChanged);
    window.addEventListener('resize', viewportChanged);
    return () => {
      if (frame) cancelFrame(frame);
      clearTimeout(settle);
      dialog.removeEventListener('focusin', focusChanged);
      dialog.removeEventListener('focusout', geometry);
      dialog.removeEventListener('modal-field-reveal', focusChanged);
      dialog.removeEventListener('pointerdown', pointer);
      dialog.removeEventListener('keydown', keyDown);
      area.removeEventListener('touchmove', userScroll);
      area.removeEventListener('wheel', userScroll);
      viewport?.removeEventListener('resize', viewportChanged);
      viewport?.removeEventListener('scroll', viewportChanged);
      window.removeEventListener('resize', viewportChanged);
    };
  }, [ref]);
}
