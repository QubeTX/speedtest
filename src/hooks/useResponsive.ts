import { useState, useEffect } from 'react';
import { WIDE_BREAKPOINT } from '../theme/responsive';

/**
 * Single-breakpoint responsive hook. Returns `true` when the viewport is wide
 * enough (>= 900px) for the two-panel ("wide") layout, `false` for the stacked
 * mobile/narrow layout. Replaces the old four-tier `useResponsive()` — all
 * finer-grained sizing is now fluid clamp() type/geometry, so a boolean
 * structural switch is all the layout needs.
 */
export function useIsWide(): boolean {
  const [isWide, setIsWide] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= WIDE_BREAKPOINT : true,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`);
    const onChange = () => setIsWide(mql.matches);
    onChange();
    // Safari <14 lacks addEventListener on MediaQueryList; guard for it.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return isWide;
}
