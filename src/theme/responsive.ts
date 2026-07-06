// Single structural breakpoint (SpeedQX v4 design overhaul).
//
// The old four-tier matrix (mobile/tablet/smallDesktop/desktop) plus per-tier
// `mechanismScale`/type sizes is gone — it produced a non-monotonic size ramp
// and the scale(0.65) blur on the cassette. Layout now branches on ONE
// structural breakpoint (stacked vs. two-up at 900px); all type/geometry sizing
// is fluid via clamp() CSS custom properties (see index.css / tokens.ts).

/** Width (px) at/above which the layout goes two-up ("wide"). */
export const WIDE_BREAKPOINT = 900;

/** True when the viewport is wide enough for the two-panel layout. */
export function isWideWidth(width: number): boolean {
  return width >= WIDE_BREAKPOINT;
}
