import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

/**
 * Measures container width synchronously on mount and window resize.
 * Uses the Pretext demo pattern: no ResizeObserver (causes infinite
 * text vibration when combined with shrinkwrap max-width).
 */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Temporarily clear max-width to get unconstrained available width.
    // No visual flash -- browser doesn't paint mid-JS execution.
    const saved = el.style.maxWidth;
    el.style.maxWidth = 'none';
    const w = el.clientWidth;
    el.style.maxWidth = saved;
    setWidth((prev) => (prev === w ? prev : w));
  }, [ref]);

  useEffect(() => {
    measure();

    const handleResize = () => {
      if (rafRef.current != null) return; // coalesce: one RAF per cycle
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        measure();
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [measure]);

  return width;
}
