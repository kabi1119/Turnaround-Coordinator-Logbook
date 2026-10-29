import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { scanLogoPixels, logoFitting, measureLogo } from '../src/lib/normalizeLogo';
import { airlineLogoRendering } from '../src/data/airlineLogoRendering';
import AirlineLogo from '../src/components/AirlineLogo';
import AirlineCombobox from '../src/components/AirlineCombobox';
import AircraftDetails from '../src/features/AircraftDetails';
import Statistics from '../src/features/Statistics';
import App from '../src/App';
import { seedDatabase } from '../src/data/seed';
import { STORAGE_KEY } from '../src/lib/storage';
import { hkToday } from '../src/domain/model';

function pixels(width: number, height: number, opaque = false) {
  const data = new Uint8ClampedArray(width * height * 4);
  if (opaque) data.fill(255);
  return data;
}
function paint(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color = [80, 0, 30, 255],
) {
  for (let row = y; row < y + h; row++)
    for (let col = x; col < x + w; col++) data.set(color, (row * width + col) * 4);
}
function mockCanvas(data: Uint8ClampedArray, width: number, height: number) {
  const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data, width, height })) };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return context;
}
function load(image: HTMLImageElement, width = 100, height = 100) {
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width });
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height });
  fireEvent.load(image);
}

describe('measured logo artwork without asset edits', () => {
  it('measures all nonzero alpha, asymmetric padding and protects antialiased edge pixels', () => {
    const data = pixels(100, 80);
    paint(data, 100, 20, 30, 60, 15);
    paint(data, 100, 18, 29, 1, 1, [255, 255, 255, 1]);
    expect(scanLogoPixels(100, 80, data)).toMatchObject({
      x: 16,
      y: 27,
      width: 66,
      height: 20,
      method: 'alpha',
    });
  });
  it('normalizes opaque white-canvas PNGs but preserves white artwork and nonwhite backgrounds', () => {
    const data = pixels(100, 100, true);
    paint(data, 100, 10, 40, 80, 20);
    paint(data, 100, 30, 45, 5, 5, [255, 255, 255, 255]);
    const original = data.slice();
    expect(scanLogoPixels(100, 100, data)).toMatchObject({
      x: 8,
      y: 38,
      width: 84,
      height: 24,
      method: 'light-background',
    });
    expect(data).toEqual(original);
    expect(scanLogoPixels(100, 100, data, false)).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      method: 'alpha',
    });
    paint(data, 100, 0, 0, 100, 100, [10, 20, 30, 255]);
    expect(scanLogoPixels(100, 100, data)).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
  });
  it('returns safe empty results for invalid dimensions/transparent files and keeps edge-touching art in bounds', () => {
    expect(scanLogoPixels(0, 100, [])).toBeNull();
    expect(scanLogoPixels(2, 2, [])).toBeNull();
    expect(scanLogoPixels(10, 10, pixels(10, 10))).toBeNull();
    const data = pixels(10, 10);
    paint(data, 10, 0, 0, 10, 10);
    expect(scanLogoPixels(10, 10, data)).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
  });
  it('classifies actual content, permits bounded optical tuning and improves QR fill over its stale rectangle', () => {
    const qr = {
      sourceWidth: 600,
      sourceHeight: 600,
      x: 28,
      y: 220,
      width: 544,
      height: 160,
      method: 'light-background' as const,
    };
    expect(logoFitting(qr, airlineLogoRendering.QR)).toMatchObject({
      fit: 'wide-wordmark',
      fillWidth: 0.96,
    });
    expect(logoFitting({ ...qr, width: 160 })).toHaveProperty('fit', 'emblem');
    expect(logoFitting({ ...qr, width: 60 })).toHaveProperty('fit', 'tall');
    expect(logoFitting(qr, { fillWidth: 2, fillHeight: -1 })).toMatchObject({
      fillWidth: 0.98,
      fillHeight: 0.1,
    });
    // Old QR metadata was tall (552×521), squeezing a new horizontal logo into 44 px height.
    const before = Math.min((112 - 12) / 552, (56 - 12) / 521) * qr.width;
    const fit = logoFitting(qr, airlineLogoRendering.QR);
    const after = Math.min(
      (112 - 2) * fit.fillWidth,
      ((56 - 2) * fit.fillHeight * qr.width) / qr.height,
    );
    expect(after).toBeGreaterThan(before * 2);
    expect(after).toBeLessThan(112);
  });
  it('measures a loaded source once per natural size across reused frames', () => {
    const data = pixels(100, 100);
    paint(data, 100, 10, 40, 80, 20);
    const context = mockCanvas(data, 100, 100);
    const image = document.createElement('img');
    image.src = '/assets/airlines/cache-fixture.png';
    Object.defineProperty(image, 'naturalWidth', { value: 100 });
    Object.defineProperty(image, 'naturalHeight', { value: 100 });
    const first = measureLogo(image);
    expect(first).toMatchObject({ sourceWidth: 100, sourceHeight: 100, width: 84, height: 24 });
    expect(measureLogo(image)).toBe(first);
    expect(context.getImageData).toHaveBeenCalledOnce();
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0);
  });
});

describe('shared logo normalization in application contexts', () => {
  it.each(['sm', 'md', 'lg'] as const)(
    'applies uniform-scale source geometry in a fixed %s frame',
    (size) => {
      const data = pixels(100, 100, true);
      paint(data, 100, 10, 40, 80, 20);
      mockCanvas(data, 100, 100);
      const { container } = render(<AirlineLogo airline="QR" size={size} />);
      load(container.querySelector('img')!);
      const frame = container.querySelector('.airline-logo') as HTMLElement;
      expect(frame).toHaveAttribute('data-logo-fit', 'wide-wordmark');
      expect(frame).toHaveAttribute('data-logo-measurement', 'light-background');
      const ratio = Number(frame.style.getPropertyValue('--visible-ratio'));
      const width = parseFloat(frame.style.getPropertyValue('--image-width'));
      const height = parseFloat(frame.style.getPropertyValue('--image-height'));
      expect((width * ratio) / height).toBeCloseTo(1); // Original 100×100 source remains square under any frame size.
      expect(container.querySelector('.airline-logo-normalized')).toBeInTheDocument();
    },
  );
  it('keeps image error/code fallback and source changes working after normalization', () => {
    const { container, rerender } = render(<AirlineLogo airline="CX" />);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByRole('img', { name: 'Cathay Pacific (CX)' })).toHaveTextContent('CX');
    expect(container.querySelector('img')).toBeNull();
    rerender(<AirlineLogo airline="LD" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/assets/airlines/LD.png');
    rerender(<AirlineLogo airline="HX" />);
    expect(container.querySelector('img')).toBeNull();
  });
  it('retains contain rendering if offscreen measurement is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('Canvas unavailable');
    });
    const { container } = render(<AirlineLogo airline="RJ" />);
    load(container.querySelector('img')!, 101, 101);
    expect(container.querySelector('img')).toBeInTheDocument();
    expect(container.querySelector('.is-normalized')).toBeNull();
  });
  it.each(['home', 'detail', 'dropdown', 'statistics'])(
    'normalizes QR through the existing %s logo consumer',
    (context) => {
      const db = seedDatabase(),
        data = pixels(100, 100, true);
      paint(data, 100, 10, 40, 80, 20);
      mockCanvas(data, 100, 100);
      if (context === 'home') {
        db.aircraft.find((a) => a.airline === 'Qatar Airways')!.date = hkToday();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        render(<App />);
      }
      if (context === 'detail')
        render(
          <AircraftDetails a={db.aircraft.find((a) => a.airline === 'Qatar Airways')!} db={db} />,
        );
      if (context === 'statistics') render(<Statistics db={db} onReport={() => {}} />);
      if (context === 'dropdown') {
        render(<AirlineCombobox value="QR" onChange={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Show airline options' }));
      }
      const images = [
        ...document.querySelectorAll<HTMLImageElement>('img[src="/assets/airlines/QR.png"]'),
      ];
      expect(images.length).toBeGreaterThan(0);
      for (const image of images) {
        load(image);
        expect(image.closest('.airline-logo')).toHaveAttribute('data-logo-fit', 'wide-wordmark');
      }
      if (context === 'dropdown')
        expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(24);
    },
  );
});
