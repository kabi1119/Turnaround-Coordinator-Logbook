import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import ConnectivityStatus from '../src/pwa/ConnectivityStatus';
import OfflineSetup from '../src/pwa/OfflineSetup';
import { LanguageContext } from '../src/i18n';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

function worker(state: ServiceWorkerState = 'installed') {
  return Object.assign(new EventTarget(), { state, postMessage: vi.fn() });
}
function setupWorker(waiting = false) {
  vi.stubEnv('PROD', true);
  vi.stubGlobal('isSecureContext', true);
  const candidate = worker();
  const registration = Object.assign(new EventTarget(), {
    active: worker('activated'),
    waiting: waiting ? candidate : null,
    installing: null as ReturnType<typeof worker> | null,
  });
  const register = vi.fn().mockResolvedValue(registration);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register },
  });
  return { registration, candidate, register };
}

describe('v0.5.1 unobtrusive PWA feedback', () => {
  it('follows browser connectivity/resume events without probing a server and cleans up listeners', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const fetch = vi.spyOn(globalThis, 'fetch');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<ConnectivityStatus />);
    expect(screen.getByRole('status')).toHaveTextContent('Online');
    online.mockReturnValue(false);
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
    expect(screen.getByRole('status')).toHaveTextContent('Device only');
    online.mockReturnValue(true);
    fireEvent(window, new Event('pageshow'));
    expect(screen.getByRole('status')).toHaveTextContent('Online');
    expect(fetch).not.toHaveBeenCalled();
    unmount();
    for (const event of ['online', 'offline', 'pageshow'])
      expect(remove).toHaveBeenCalledWith(event, expect.any(Function));
  });
  it('localizes connectivity and update guidance in Traditional Chinese', async () => {
    setupWorker(true);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(
      <LanguageContext.Provider value="zh-HK">
        <ConnectivityStatus />
        <OfflineSetup />
      </LanguageContext.Provider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('離線');
    await screen.findByText('更新已就緒');
    expect(screen.getByText(/請先儲存修改，再關閉所有/)).toBeInTheDocument();
  });
  it('announces an already waiting update, dismisses it without activation and removes listeners', async () => {
    const { registration, candidate } = setupWorker(true);
    const remove = vi.spyOn(registration, 'removeEventListener');
    const { unmount } = render(<OfflineSetup />);
    await screen.findByText('Update ready');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss update notice' }));
    expect(screen.queryByText('Update ready')).toBeNull();
    act(() => registration.dispatchEvent(new Event('updatefound')));
    expect(screen.queryByText('Update ready')).toBeNull();
    expect(candidate.postMessage).not.toHaveBeenCalled();
    unmount();
    expect(remove).toHaveBeenCalledWith('updatefound', expect.any(Function));
  });
  it('detects a newly installed waiting worker without changing an unsaved form', async () => {
    const { registration, candidate, register } = setupWorker();
    const { unmount } = render(
      <>
        <input aria-label="Unsaved note" defaultValue="Keep my edit" />
        <OfflineSetup />
      </>,
    );
    await waitFor(() => expect(register).toHaveBeenCalledOnce());
    const remove = vi.spyOn(candidate, 'removeEventListener');
    act(() => {
      candidate.state = 'installing';
      registration.installing = candidate;
      registration.dispatchEvent(new Event('updatefound'));
      registration.waiting = candidate;
      candidate.state = 'installed';
      candidate.dispatchEvent(new Event('statechange'));
    });
    await screen.findByText('Update ready');
    expect(screen.getByLabelText('Unsaved note')).toHaveValue('Keep my edit');
    expect(candidate.postMessage).not.toHaveBeenCalled();
    unmount();
    expect(remove).toHaveBeenCalledWith('statechange', expect.any(Function));
  });
  it('does not mistake first installation for an update', async () => {
    const { registration, candidate, register } = setupWorker();
    Object.assign(registration, { active: null, installing: candidate });
    render(<OfflineSetup />);
    await waitFor(() => expect(register).toHaveBeenCalledOnce());
    act(() => {
      registration.waiting = candidate;
      candidate.state = 'installed';
      candidate.dispatchEvent(new Event('statechange'));
    });
    expect(screen.queryByText('Update ready')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('retains useful failure feedback if registration is unavailable', async () => {
    const { register } = setupWorker();
    register.mockRejectedValue(new Error('unavailable'));
    render(<OfflineSetup />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Local record saving is separate');
    expect(screen.queryByText('Update ready')).toBeNull();
  });
});

it('wires matching versioned PWA/Apple/favicon assets with unchanged application identity', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  expect([manifest.id, manifest.scope, manifest.start_url]).toEqual(['/', '/', '/']);
  expect(manifest.name).toBe('TCO Logbook');
  for (const size of [180, 192, 512]) {
    const png = readFileSync(`public/assets/pwa/icon-${size}.png`);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size]);
    if (size !== 180)
      expect(manifest.icons).toContainEqual({
        src: `/assets/pwa/icon-${size}.png?v=0.6.1`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'any',
      });
  }
  const html = readFileSync('index.html', 'utf8');
  expect(html).toContain('href="/airplane.svg?v=0.6.1"');
  expect(html).toContain('href="/assets/pwa/icon-180.png?v=0.6.1"');
});
