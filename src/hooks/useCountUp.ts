// RAF-driven number count-up that writes `el.textContent` imperatively via a
// ref — no React re-render per frame (same "keep React out of the hot path"
// idiom as useReelDrive). Attach the returned ref to the element that should
// display the animated numeral; the hook owns its text content entirely, so
// don't also pass children/text to that element from React.

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/** Default duration for flagship readouts. */
export const COUNT_UP_DURATION_MS = 650;
/** Faster preset for secondary/smaller numerals. */
export const COUNT_UP_DURATION_FAST_MS = 400;

export interface UseCountUpOptions {
  /** Animation duration in ms. Default 650 (pass COUNT_UP_DURATION_FAST_MS for 400). */
  durationMs?: number;
  /** Decimal places for the default formatter. Default 0. */
  decimals?: number;
  /** Custom formatter (overrides `decimals`). Receives the live interpolated value. */
  format?: (value: number) => string;
  /** Force reduced motion. Omit to auto-detect via motion's useReducedMotion(). */
  reduced?: boolean;
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Animates the text content of the returned ref's element from its
 * last-displayed value toward `value` over `durationMs`, eased with
 * easeOutExpo. Reduced motion (auto-detected or forced) snaps instantly.
 *
 * If `value` changes again mid-flight, the next animation starts from
 * wherever the numeral was actually displayed (not the original start point),
 * so re-triggering never visually jumps backward.
 */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(
  value: number,
  options: UseCountUpOptions = {},
): React.RefObject<T> {
  const { durationMs = COUNT_UP_DURATION_MS, decimals = 0, format, reduced } = options;
  const autoReduced = useReducedMotion();
  const effectiveReduced = reduced ?? !!autoReduced;

  const elRef = useRef<T>(null);
  const displayRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const formatValue = (v: number) => (format ? format(v) : v.toFixed(decimals));
    const from = displayRef.current;
    const to = value;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (effectiveReduced || from === to) {
      displayRef.current = to;
      el.textContent = formatValue(to);
      return;
    }

    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutExpo(t);
      const current = from + (to - from) * eased;
      displayRef.current = current;
      el.textContent = formatValue(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // `decimals`/`format` are configuration, not animation drivers — deliberately
    // excluded so a formatter identity change mid-flight doesn't restart the tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, effectiveReduced, durationMs]);

  return elRef;
}
