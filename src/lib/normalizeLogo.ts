export type LogoFit = 'wide-wordmark' | 'emblem' | 'tall';
export interface LogoBounds {
  sourceWidth: number;
  sourceHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  method: 'alpha' | 'light-background';
}
export interface LogoRendering {
  fit?: LogoFit;
  fillWidth?: number;
  fillHeight?: number;
  trimLightBackground?: boolean;
}

/** Scan the original pixels, never resample/edit them. Include every nonzero alpha.
 * Opaque white-canvas PNGs need a conservative second pass: alpha alone covers the
 * whole canvas. Only opt into it when all four corners are near-white and alpha's
 * rectangle covers the canvas. White artwork inside the resulting bounds remains intact.
 */
export function scanLogoPixels(
  width: number,
  height: number,
  pixels: ArrayLike<number>,
  trimLightBackground = true,
): LogoBounds | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    pixels.length !== width * height * 4
  )
    return null;
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  let fx0 = width,
    fy0 = height,
    fx1 = -1,
    fy1 = -1;
  const light = (i: number) => pixels[i] >= 247 && pixels[i + 1] >= 247 && pixels[i + 2] >= 247;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      if (!light(i)) {
        fx0 = Math.min(fx0, x);
        fy0 = Math.min(fy0, y);
        fx1 = Math.max(fx1, x);
        fy1 = Math.max(fy1, y);
      }
    }
  if (x1 < 0) return null;
  const corners = [0, (width - 1) * 4, (height - 1) * width * 4, (width * height - 1) * 4];
  const opaqueCanvas = x0 === 0 && y0 === 0 && x1 === width - 1 && y1 === height - 1;
  const useLight =
    trimLightBackground &&
    opaqueCanvas &&
    fx1 >= 0 &&
    corners.every((i) => pixels[i + 3] === 255 && light(i));
  if (useLight) {
    x0 = fx0;
    y0 = fy0;
    x1 = fx1;
    y1 = fy1;
  }
  // Small protective margin for antialiasing; CSS leaves additional breathing room.
  const pad = 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  return {
    sourceWidth: width,
    sourceHeight: height,
    x: x0,
    y: y0,
    width: x1 - x0 + 1,
    height: y1 - y0 + 1,
    method: useLight ? 'light-background' : 'alpha',
  };
}

export function logoFitting(bounds: LogoBounds, overrides: LogoRendering = {}) {
  const ratio = bounds.width / bounds.height;
  const fit = overrides.fit || (ratio >= 2 ? 'wide-wordmark' : ratio < 0.8 ? 'tall' : 'emblem');
  const defaults =
    fit === 'wide-wordmark' ? [0.92, 0.84] : fit === 'tall' ? [0.78, 0.88] : [0.8, 0.82];
  const safeFill = (v: number | undefined, fallback: number) =>
    v !== undefined && Number.isFinite(v) ? Math.min(0.98, Math.max(0.1, v)) : fallback;
  return {
    fit,
    fillWidth: safeFill(overrides.fillWidth, defaults[0]),
    fillHeight: safeFill(overrides.fillHeight, defaults[1]),
  };
}

// Session-only cache, shared across every instance/size. Reloading remeasures changed assets.
// Cache pixels neither in memory nor in localStorage; keep only the small bounds object.
const cache = new Map<string, LogoBounds | null>();
export function measureLogo(
  image: HTMLImageElement,
  trimLightBackground = true,
): LogoBounds | null {
  const width = image.naturalWidth,
    height = image.naturalHeight;
  if (!width || !height) return null;
  const key = `${image.currentSrc || image.src}|${width}x${height}|${trimLightBackground}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let bounds: LogoBounds | null = null;
  const canvas = document.createElement('canvas'); // Detached/offscreen, never displayed.
  try {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context) {
      context.drawImage(image, 0, 0);
      bounds = scanLogoPixels(
        width,
        height,
        context.getImageData(0, 0, width, height).data,
        trimLightBackground,
      );
    }
  } catch {
    // Unavailable/tainted canvas: preserve normal object-fit rendering, not a blank logo.
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
  cache.set(key, bounds);
  return bounds;
}
