import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value: function () {
    this.setAttribute('open', '');
  },
});
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value: function () {
    this.removeAttribute('open');
  },
});
Object.defineProperty(window, 'scrollTo', { configurable: true, value: () => {} });
