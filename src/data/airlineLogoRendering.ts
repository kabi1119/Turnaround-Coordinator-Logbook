import type { LogoRendering } from '../lib/normalizeLogo';

/** Display-only optical tuning. Identity and legal/provenance metadata stay separate.
 * Bounds are always measured from the loaded file; no per-airline rectangle is fixed here.
 * Other airlines use aspect-based defaults; add an override only after visual review.
 */
export const airlineLogoRendering: Readonly<Record<string, LogoRendering>> = {
  QR: { fit: 'wide-wordmark', fillWidth: 0.96, fillHeight: 0.86 },
  PX: { fit: 'emblem', fillHeight: 0.9 },
};
