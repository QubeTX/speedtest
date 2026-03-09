import { useState, useEffect } from 'react';
import { getBreakpoint, type Breakpoint } from '../theme/responsive';

interface ResponsiveState {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => compute());

  function compute(): ResponsiveState {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const bp = getBreakpoint(w);
    return {
      width: w,
      height: h,
      breakpoint: bp,
      isMobile: bp === 'mobile',
      isTablet: bp === 'tablet',
      isDesktop: bp === 'desktop',
      isLandscape: w > h,
    };
  }

  useEffect(() => {
    const onResize = () => setState(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return state;
}
