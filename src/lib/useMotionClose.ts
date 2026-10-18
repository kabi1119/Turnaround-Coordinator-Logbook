import { useEffect, useRef, useState } from 'react';

/** Match --motion-out (180ms). No animation loop; retain the dialog/scroll lock until dismissal. */
export function useMotionClose(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);
  const action = useRef(onClose);
  useEffect(() => {
    action.current = onClose;
  }, [onClose]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = () => {
    if (pending.current) return;
    if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      action.current();
      return;
    }
    pending.current = true;
    setClosing(true);
    timer.current = setTimeout(() => {
      pending.current = false;
      setClosing(false);
      action.current();
    }, 180);
  };
  return { closing, close };
}
