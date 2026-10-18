import { useEffect, useRef, useState } from 'react';
import { modalScrollArea } from './modalInteraction';

/** In-memory return trail only; records and browser storage remain authoritative elsewhere. */
export function useRecordNavigation<T extends { type: string }>() {
  const [trail, setTrail] = useState<T[]>([]);
  const scrolls = useRef(new Map<string, number>());
  const current = trail.at(-1) || null;
  const key = current ? JSON.stringify(current) : '';
  const remember = () => {
    const dialog = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
    if (key && dialog) scrolls.current.set(key, modalScrollArea(dialog).scrollTop);
  };
  useEffect(() => {
    if (!key) return;
    const dialog = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
    if (dialog) modalScrollArea(dialog).scrollTop = scrolls.current.get(key) || 0;
  }, [key]);
  const open = (next: T | null) => {
    remember();
    setTrail((rows) => {
      if (!next) return [];
      // Add is a launcher, not a record to return to after a successful save.
      const base = rows.at(-1)?.type === 'add' ? rows.slice(0, -1) : rows;
      const index = base.findIndex((row) => JSON.stringify(row) === JSON.stringify(next));
      return index < 0 ? [...base, next] : base.slice(0, index + 1);
    });
  };
  const back = () => {
    remember();
    setTrail((rows) => rows.slice(0, -1));
  };
  return { current, previous: trail.at(-2) || null, open, back };
}
