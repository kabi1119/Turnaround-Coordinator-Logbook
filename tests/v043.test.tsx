import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, Modal, TextArea } from '../src/components/ui';
import AircraftEditor from '../src/features/AircraftEditor';
import AirlineCombobox from '../src/components/AirlineCombobox';
import {
  modalScrollArea,
  revealModalField,
  revealListOption,
  textEntries,
} from '../src/lib/modalInteraction';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';

class Viewport extends EventTarget {
  height = 800;
  width = 390;
  offsetTop = 0;
  scale = 1;
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function environment(viewport: Viewport | undefined = new Viewport()) {
  vi.useFakeTimers();
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 800);
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: query.includes('coarse') })),
  );
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) =>
    window.setTimeout(() => fn(0), 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
    { width: 200, height: 44 },
  ] as unknown as DOMRectList);
  return viewport;
}
const rect = (top: number, bottom: number): DOMRect => ({
  top,
  bottom,
  left: 0,
  right: 300,
  width: 300,
  height: bottom - top,
  x: 0,
  y: top,
  toJSON: () => ({}),
});
function Form({
  close = () => {},
  submit = () => {},
}: {
  close?: () => void;
  submit?: () => void;
}) {
  const [value, setValue] = useState('450A');
  return (
    <Modal title="Keyboard test" sheet onClose={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Arrival" value={value} onChange={(e) => setValue(e.target.value)} />
        <Field label="Departure" />
        <details>
          <summary>More</summary>
          <Field label="Registration" />
          <TextArea label="Notes" />
        </details>
        <div className="actions sticky-actions">
          <button type="button">Save Draft</button>
        </div>
      </form>
    </Modal>
  );
}
function geometry(viewport: Viewport) {
  const dialog = screen.getByRole('dialog') as HTMLDialogElement,
    area = modalScrollArea(dialog);
  const input = screen.getByLabelText('Arrival'),
    field = input.closest('.field')!;
  vi.spyOn(area, 'getBoundingClientRect').mockImplementation(() =>
    rect(100, viewport.offsetTop + viewport.height - 8),
  );
  const fieldMeasure = vi
    .spyOn(field, 'getBoundingClientRect')
    .mockImplementation(() => rect(700 - area.scrollTop, 800 - area.scrollTop));
  vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
    rect(724 - area.scrollTop, 768 - area.scrollTop),
  );
  area.scrollTop = 200;
  return { dialog, area, input, field, fieldMeasure };
}
const flush = () => act(() => vi.advanceTimersByTime(150));

describe('v0.4.3 event-driven keyboard viewport and visibility', () => {
  it('Fits visual height and offset, revealing the field/label once after keyboard settling without moving the background', () => {
    const viewport = environment()!;
    render(<Form />);
    const { dialog, area, input, field } = geometry(viewport),
      background = vi.spyOn(window, 'scrollTo');
    (input as HTMLElement).focus();
    flush();
    expect(area.scrollTop).toBe(200);
    viewport.height = 420;
    viewport.offsetTop = 40;
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    flush();
    expect(dialog).toHaveAttribute('data-keyboard-open', 'true');
    expect(dialog.style.getPropertyValue('--modal-viewport-height')).toBe('420px');
    expect(dialog.style.getPropertyValue('--modal-viewport-top')).toBe('40px');
    expect(dialog.style.getPropertyValue('--modal-viewport-bottom')).toBe('340px');
    expect(input.getBoundingClientRect().bottom).toBeLessThanOrEqual(440);
    expect(field.getBoundingClientRect().top).toBeGreaterThanOrEqual(120);
    expect(background).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('hidden');
  });
  it('Does not recenter a visible input or remeasure on each controlled keystroke; focus and DOM identity survive', () => {
    const viewport = environment()!;
    render(<Form />);
    const { area, input, fieldMeasure } = geometry(viewport);
    (input as HTMLElement).focus();
    flush();
    const count = fieldMeasure.mock.calls.length;
    for (const value of ['45', '450', '450A']) fireEvent.change(input, { target: { value } });
    flush();
    expect(fieldMeasure).toHaveBeenCalledTimes(count);
    expect(area.scrollTop).toBe(200);
    expect(screen.getByLabelText('Arrival')).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('450A');
  });
  it('Restores viewport size without resetting current form scroll, closing the form or changing entered values', () => {
    const viewport = environment()!,
      close = vi.fn();
    render(<Form close={close} />);
    const { input, area, dialog } = geometry(viewport);
    (input as HTMLElement).focus();
    viewport.height = 400;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    const position = area.scrollTop;
    viewport.height = 800;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    expect(area.scrollTop).toBe(position);
    expect(dialog).toHaveAttribute('data-keyboard-open', 'false');
    expect(input).toHaveValue('450A');
    expect(close).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute('open');
  });
  it('Coalesces keyboard resize events and respects deliberate manual scrolling until another field is focused', () => {
    const viewport = environment()!;
    render(<Form />);
    const { area, input, fieldMeasure } = geometry(viewport);
    (input as HTMLElement).focus();
    flush();
    fieldMeasure.mockClear();
    for (const height of [700, 600, 500, 400]) {
      viewport.height = height;
      viewport.dispatchEvent(new Event('resize'));
    }
    flush();
    expect(fieldMeasure).toHaveBeenCalledOnce();
    area.scrollTop = 100;
    fireEvent.touchMove(area);
    viewport.height = 380;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    expect(area.scrollTop).toBe(100);
    fireEvent.pointerDown(input);
    flush();
    expect(area.scrollTop).toBeGreaterThan(100);
  });
  it('Prioritizes the control without imposing impossible clearance in a tiny viewport', () => {
    const viewport = environment()!;
    render(<Form />);
    const { area, input } = geometry(viewport);
    viewport.height = 170;
    (input as HTMLElement).focus();
    flush();
    expect(area.scrollTop).toBeGreaterThan(200);
    expect(input.getBoundingClientRect().bottom).toBeLessThanOrEqual(170);
  });
  it('Does not mistake desktop resizing, toolbar changes or hardware keyboard focus for occlusion', () => {
    const viewport = environment()!;
    render(<Form />);
    const { input, dialog } = geometry(viewport);
    (input as HTMLElement).focus();
    viewport.height = 720;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    expect(dialog).toHaveAttribute('data-keyboard-open', 'false');
    vi.stubGlobal('innerHeight', 420);
    viewport.height = 420;
    fireEvent(window, new Event('resize'));
    flush();
    expect(dialog).toHaveAttribute('data-keyboard-open', 'false');
    vi.stubGlobal('innerWidth', 1440);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    viewport.height = 400;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    expect(dialog).toHaveAttribute('data-keyboard-open', 'false');
  });
  it('Leaves pinch zoom in the browser’s control and resets fitting geometry after zoom/orientation changes', () => {
    const viewport = environment()!;
    render(<Form />);
    const { dialog, input, area } = geometry(viewport);
    viewport.scale = 2;
    viewport.height = 400;
    (input as HTMLElement).focus();
    flush();
    expect(dialog).not.toHaveAttribute('data-viewport-fit');
    expect(area.scrollTop).toBe(200);
    viewport.scale = 1;
    viewport.width = 844;
    viewport.height = 300;
    viewport.dispatchEvent(new Event('resize'));
    expect(dialog).toHaveAttribute('data-keyboard-open', 'false');
    flush();
    expect(dialog).toHaveAttribute('data-viewport-fit', 'true');
    expect(dialog.style.getPropertyValue('--modal-viewport-height')).toBe('300px');
  });
  it('Has a no-VisualViewport fallback and cleans up listeners and queued checks on unmount', () => {
    environment(undefined); // Explicitly remove the optional API after default parameter construction.
    vi.stubGlobal('visualViewport', undefined);
    const timerSet = vi.spyOn(window, 'setTimeout'),
      timerClear = vi.spyOn(window, 'clearTimeout');
    let view = render(<Form />);
    expect(screen.getByRole('dialog').style.getPropertyValue('--modal-viewport-height')).toBe(
      '800px',
    );
    view.unmount();
    const viewport = new Viewport(),
      add = vi.spyOn(viewport, 'addEventListener'),
      remove = vi.spyOn(viewport, 'removeEventListener');
    vi.stubGlobal('visualViewport', viewport);
    view = render(<Form />);
    (screen.getByLabelText('Arrival') as HTMLElement).focus();
    viewport.dispatchEvent(new Event('resize'));
    view.unmount();
    for (const [type, handler] of add.mock.calls)
      expect(remove).toHaveBeenCalledWith(type, handler);
    timerSet.mock.calls.forEach(([, delay], i) => {
      if (delay === 16 || delay === 100)
        expect(timerClear).toHaveBeenCalledWith(timerSet.mock.results[i].value);
    });
    // jsdom queues its own zero-delay selectionchange on focus; the controller's timers were cancelled above.
    act(() => vi.advanceTimersByTime(0));
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('v0.4.3 native Next/Done and nested focus', () => {
  it('Keeps airline input and its opened options visible before lower-priority hint text', () => {
    const viewport = environment()!;
    viewport.height = 320;
    render(
      <Modal title="Airlines" sheet onClose={() => {}}>
        <AirlineCombobox value="" onChange={() => {}} />
      </Modal>,
    );
    const dialog = screen.getByRole('dialog') as HTMLDialogElement,
      area = modalScrollArea(dialog),
      input = screen.getByRole('combobox');
    vi.spyOn(area, 'getBoundingClientRect').mockReturnValue(rect(80, 312));
    vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
      rect(400 - area.scrollTop, 444 - area.scrollTop),
    );
    vi.spyOn(input.closest('.airline-combobox')!, 'getBoundingClientRect').mockImplementation(() =>
      rect(376 - area.scrollTop, 620 - area.scrollTop),
    );
    (input as HTMLElement).focus();
    fireEvent.click(screen.getByRole('button', { name: 'Show airline options' }));
    const options = screen.getByRole('listbox');
    vi.spyOn(options, 'getBoundingClientRect').mockImplementation(() =>
      rect(448 - area.scrollTop, 544 - area.scrollTop),
    );
    flush();
    expect(options.getBoundingClientRect().bottom).toBeLessThanOrEqual(312);
    expect(input.getBoundingClientRect().top).toBeGreaterThanOrEqual(80);
  });
  it('Protects native date/time field visibility without replacing their picker keyboard behavior', () => {
    const viewport = environment()!;
    render(
      <Modal title="Date picker" sheet onClose={() => {}}>
        <Field label="Shift start" type="time" />
      </Modal>,
    );
    const input = screen.getByLabelText('Shift start'),
      dialog = screen.getByRole('dialog') as HTMLDialogElement,
      area = modalScrollArea(dialog);
    vi.spyOn(area, 'getBoundingClientRect').mockImplementation(() => rect(80, viewport.height - 8));
    vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
      rect(700 - area.scrollTop, 744 - area.scrollTop),
    );
    vi.spyOn(input.closest('.field')!, 'getBoundingClientRect').mockImplementation(() =>
      rect(676 - area.scrollTop, 744 - area.scrollTop),
    );
    (input as HTMLElement).focus();
    viewport.height = 320;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    expect(input.getBoundingClientRect().bottom).toBeLessThanOrEqual(292);
    expect(dialog).toHaveAttribute('data-keyboard-open', 'true');
    expect(input).not.toHaveAttribute('enterkeyhint');
  });
  it('Uses Next for Arrival → Departure and Done at the end, never implicitly submitting', () => {
    environment();
    const submit = vi.fn();
    render(<Form submit={submit} />);
    const arrival = screen.getByLabelText('Arrival'),
      departure = screen.getByLabelText('Departure');
    (arrival as HTMLElement).focus();
    expect(arrival).toHaveAttribute('enterkeyhint', 'next');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    arrival.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(departure).toHaveFocus();
    expect(departure).toHaveAttribute('enterkeyhint', 'done');
    fireEvent.keyDown(departure, { key: 'Enter' });
    expect(departure).not.toHaveFocus();
    expect(submit).not.toHaveBeenCalled();
  });
  it('Skips hidden/inapplicable/disabled fields and preserves textarea newlines and IME composition', () => {
    environment();
    render(<Form />);
    const dialog = screen.getByRole('dialog') as HTMLDialogElement;
    expect(textEntries(dialog)).toHaveLength(2);
    fireEvent.click(screen.getByText('More'));
    (dialog.querySelector('details') as HTMLDetailsElement).open = true;
    const textarea = screen.getByLabelText('Notes');
    (textarea as HTMLElement).focus();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    textarea.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(textarea).toHaveFocus();
    const input = screen.getByLabelText('Arrival');
    (input as HTMLElement).focus();
    const ime = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(ime);
    expect(ime.defaultPrevented).toBe(false);
    expect(input).toHaveFocus();
    (screen.getByLabelText('Departure') as HTMLInputElement).disabled = true;
    expect(textEntries(dialog)).not.toContain(screen.getByLabelText('Departure'));
  });
  it('Restores parent form scroll and focus without scrolling the document after a nested review', () => {
    environment();
    function Nested() {
      const [child, setChild] = useState(false);
      return (
        <Modal title="Parent" sheet onClose={() => {}}>
          <Field label="Value" defaultValue="Preserved" />
          <button onClick={() => setChild(true)}>Review</button>
          {child && (
            <Modal title="Review" onClose={() => setChild(false)}>
              <p>Check</p>
            </Modal>
          )}
        </Modal>
      );
    }
    render(<Nested />);
    const parent = screen.getByRole('dialog') as HTMLDialogElement,
      area = modalScrollArea(parent);
    const input = screen.getByLabelText('Value');
    (input as HTMLElement).focus();
    area.scrollTop = 270;
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const child = screen.getByRole('dialog', { name: 'Review' });
    fireEvent.click(within(child).getByRole('button', { name: 'Close' }));
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Preserved');
    expect(area.scrollTop).toBe(270);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement).toHaveClass('modal-open');
  });
  it('Does not move an underlying or closing dialog, and keeps option scrolling inside its list', () => {
    environment();
    render(<Form />);
    const dialog = screen.getByRole('dialog') as HTMLDialogElement,
      input = screen.getByLabelText('Arrival');
    dialog.classList.add('closing');
    const measured = vi.spyOn(input, 'getBoundingClientRect');
    revealModalField(input);
    expect(measured).not.toHaveBeenCalled();
    dialog.classList.remove('closing');
    const list = document.createElement('div'),
      option = document.createElement('div');
    list.setAttribute('role', 'listbox');
    list.append(option);
    document.body.append(list);
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(rect(100, 200));
    vi.spyOn(option, 'getBoundingClientRect').mockReturnValue(rect(190, 240));
    revealListOption(option);
    expect(list.scrollTop).toBe(40);
    expect(modalScrollArea(dialog).scrollTop).toBe(0);
    list.remove();
  });
  it('Touch selection does not reopen the airline keyboard; controlled values and fixed prefixes survive focus navigation', () => {
    environment();
    const change = vi.fn();
    render(<AirlineCombobox value="" onChange={change} />);
    const input = screen.getByRole('combobox'),
      focus = vi.spyOn(input, 'focus');
    fireEvent.click(screen.getByRole('button', { name: 'Show airline options' }));
    (input as HTMLElement).blur();
    focus.mockClear();
    fireEvent.click(screen.getByRole('option', { name: 'Cathay Pacific CX' }));
    expect(change).toHaveBeenCalledWith('Cathay Pacific');
    expect(focus).not.toHaveBeenCalled();
  });
  it('New Handling has no forced input focus and retains incomplete Draft review, values and unchanged persisted bytes', () => {
    environment();
    const db = seedDatabase(),
      commit = vi.fn(() => true),
      bytes = JSON.stringify(db);
    localStorage.setItem(STORAGE_KEY, bytes);
    const view = render(
      <AircraftEditor db={db} commit={commit} onClose={() => {}} onSaved={() => {}} />,
    );
    expect(document.activeElement?.tagName).not.toBe('INPUT');
    const form = view.container.querySelector('form')!,
      area = modalScrollArea(screen.getByRole('dialog') as HTMLDialogElement);
    const airline = screen.getByRole('combobox', { name: 'Airline *' });
    fireEvent.change(airline, { target: { value: 'Fictional keyboard entry' } });
    area.scrollTop = 320;
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(screen.getByRole('dialog', { name: 'Review Handling Record' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Edit' }));
    flush();
    expect(screen.getByRole('combobox', { name: 'Airline *' })).toBe(airline);
    expect(airline).toHaveValue('Fictional keyboard entry');
    expect(area.scrollTop).toBe(320);
    expect(form).toBe(view.container.querySelector('form'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
    expect(commit).not.toHaveBeenCalled();
  });
});
