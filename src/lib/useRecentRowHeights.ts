import { useLayoutEffect, useRef } from 'react';

/** Grid establishes content-driven sizes; equal minima remove fractional-track rounding. */
export function useRecentRowHeights(enabled: boolean, revision: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !enabled || typeof ResizeObserver === 'undefined') return;
    const desktop = window.matchMedia('(min-width: 1200px)');
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.removeProperty('--recent-row-min');
        if (!desktop.matches) return;
        const rows = [...root.querySelectorAll<HTMLElement>('.home-recent .aircraft-card')];
        if (rows.length !== 4) return;
        const height = Math.max(...rows.map((row) => row.getBoundingClientRect().height));
        root.style.setProperty('--recent-row-min', `${height}px`);
      });
    };
    const observer = new ResizeObserver(fit);
    // Watch natural contents as well as the grid, so shortening text can shrink rows again.
    [
      root,
      ...root.querySelectorAll(
        '.home-metrics, .home-unfinished, .journal-teaser, .aircraft-content',
      ),
    ].forEach((element) => observer.observe(element));
    desktop.addEventListener('change', fit);
    fit();
    return () => {
      observer.disconnect();
      desktop.removeEventListener('change', fit);
      cancelAnimationFrame(frame);
      root.style.removeProperty('--recent-row-min');
    };
  }, [enabled, revision]);
  return ref;
}
