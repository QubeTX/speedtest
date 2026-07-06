import type { CSSProperties } from 'react';

export interface CRTOverlayProps {
  /** Stacking order for the overlay. Default 5 (the original single call site). */
  zIndex?: number;
  /** Optional className for the wrapper div (e.g. consumer-side positioning). */
  className?: string;
  /** Style overrides/additions — merged over the base overlay style. Useful for
   *  e.g. `borderRadius` when clipping to a rounded parent. */
  style?: CSSProperties;
}

/**
 * Canonical CRT scanline overlay — a single absolutely-positioned div painted
 * entirely with a CSS gradient (horizontal scanlines + a faint RGB fringe).
 * No JS animation loop, no per-frame work: it's static background art that
 * costs nothing at runtime. Parent must be `position: relative` (or similar)
 * for `inset: 0` to cover the intended area.
 *
 * This is the single source of truth for the scanline effect (the v4 design
 * plan calls out "de-dup CRT overlay" explicitly). Other call sites should
 * import this component rather than re-declaring the gradient inline —
 * inline copies drift: DataPanel's error-state branch currently inlines a
 * copy whose third color stop is `rgba(0,255,0,...)` instead of blue.
 */
export default function CRTOverlay({ zIndex = 5, className, style }: CRTOverlayProps) {
  const overlayStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.05) 50%), linear-gradient(90deg, rgba(255,0,0,0.02), rgba(0,255,0,0.01), rgba(0,0,255,0.02))',
    backgroundSize: '100% 4px, 3px 100%',
    pointerEvents: 'none',
    zIndex,
    ...style,
  };

  return <div className={className} style={overlayStyle} aria-hidden="true" />;
}
