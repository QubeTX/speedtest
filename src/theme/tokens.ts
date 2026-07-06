export const colors = {
  bgCanvas: '#f4f4f4',
  bgDevice: '#e9e9e9',
  bgScreen: '#dbdbdb',
  ink: '#111111',
  paper: '#ffffff',
  error: '#ff3b30',
  errorFaint: 'rgba(255, 59, 48, 0.05)',
} as const;

export const borders = {
  stroke: '3px solid #111111',
  strokeThin: '2px solid #111111',
  radiusPill: '999px',
  radiusBox: '16px',
} as const;

// ─── Type system (SpeedQX Methodology v4 design overhaul) ───────────────────
//
// Two voices:
//   • DISPLAY  — Makira Sans Serif. Hero numerals, headings, buttons, the stamp.
//   • INSTRUMENT — IBM Plex Mono. Units, metric values, percentile ladders,
//                  micro-labels, timestamps. Inherently monospaced → tabular.
//
// IMPORTANT (verified 2026-07 with fontTools on Makira-Medium.woff2):
//   Makira has NO tabular-figure support — its default digits are PROPORTIONAL
//   (10 distinct advance widths) and it ships NO `tnum`/`lnum` OpenType feature
//   (GSUB tags present: aalt case frac liga locl ordn salt sups). So
//   `font-variant-numeric: tabular-nums` is a NO-OP on Makira. We keep it on the
//   hero token anyway (per spec — it still helps the Guton/system fallback while
//   the webfont loads) but it does NOT make Makira digits equal-width.
//   → For ANIMATING numerals (live count-ups / odometers) prefer the INSTRUMENT
//     voice (`textStyles.instrumentNumber`, IBM Plex Mono — genuinely monospaced,
//     zero horizontal jitter). Reserve the Makira `hero` token for the single
//     flagship readout where the display voice matters most; if its digits jitter
//     while animating, swap that one readout to the instrument numeral too.

export const fontFamilies = {
  /** Makira — display voice. Guton kept in the stack as a metrics-close fallback
   *  during the migration; system sans as the final fallback. */
  display: "'Makira', 'Guton', -apple-system, BlinkMacSystemFont, sans-serif",
  /** IBM Plex Mono — instrument voice. Monospaced → tabular by construction. */
  instrument: "'IBM Plex Mono', ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace",
  /** Guton — legacy body voice, retained during the Makira roll-out. */
  body: "'Guton', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800, // Makira only (Plex Mono tops out at bold/700)
  black: 900, // Makira only
} as const;

/** Fluid sizes — mirror the CSS custom properties declared in index.css so JS
 *  and CSS stay in lockstep. Values are the clamp() ramps, not raw rems. */
export const typeSizes = {
  hero: 'var(--type-hero)', // clamp(3rem, 12vw, 6.5rem)
  numberMd: 'var(--type-number-md)', // clamp(2.25rem, 8vw, 3.75rem)
  unit: 'var(--type-unit)', // clamp(0.85rem, 3.2vw, 1.4rem)
} as const;

/** Role tokens (plan "table T"). Spread into inline `style={}`. */
export const textStyles = {
  /** Flagship display numeral — Makira Medium. Negative tracking is allowed
   *  here (display voice only). tabular-nums retained for the fallback stack. */
  hero: {
    fontFamily: fontFamilies.display,
    fontWeight: fontWeights.medium,
    fontSize: typeSizes.hero,
    lineHeight: 0.85,
    letterSpacing: '-0.028em',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  /** Secondary metric numeral — INSTRUMENT voice (Plex Mono). Genuinely
   *  monospaced, so safe to animate. NEVER negative-tracked. */
  instrumentNumber: {
    fontFamily: fontFamilies.instrument,
    fontWeight: fontWeights.semibold,
    fontSize: typeSizes.numberMd,
    lineHeight: 0.9,
    letterSpacing: '0',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  /** Units ("Mbps", "ms") — instrument voice, gentle positive tracking. */
  unit: {
    fontFamily: fontFamilies.instrument,
    fontWeight: fontWeights.medium,
    fontSize: typeSizes.unit,
    letterSpacing: '0.02em',
  },
  /** Uppercase micro-label — instrument voice, +0.08–0.14em tracking band. */
  microLabel: {
    fontFamily: fontFamilies.instrument,
    fontSize: '0.65rem',
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: colors.ink,
  },
  /** Inline metric value (dense readouts, percentile ladders). */
  metricValue: {
    fontFamily: fontFamilies.instrument,
    fontSize: '0.85rem',
    fontWeight: fontWeights.medium,
    letterSpacing: '0.01em',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  /** Headings — display voice. */
  heading: {
    fontFamily: fontFamilies.display,
    fontWeight: fontWeights.semibold,
    letterSpacing: '-0.012em',
  },
  /** Buttons — display voice, mild positive tracking for legibility. */
  button: {
    fontFamily: fontFamilies.display,
    fontWeight: fontWeights.semibold,
    letterSpacing: '0.02em',
  },
  /** "TEST COMPLETE" stamp — display voice, heavy. */
  stamp: {
    fontFamily: fontFamilies.display,
    fontWeight: fontWeights.extrabold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
} as const;

// ─── Backward-compatible facade ─────────────────────────────────────────────
// Existing consumers import `typography.{fontFamily,numberLarge,numberMedium,
// unit,metaLabel,metaValue}`. Keep those keys (same shape) but re-voiced onto
// the new type system so the tree keeps compiling while callers migrate to
// `textStyles`. `numberLarge` → Makira hero; `numberMedium` → Plex instrument
// numeral; labels/values → instrument voice.
export const typography = {
  fontFamily: fontFamilies.display,
  numberLarge: textStyles.hero,
  numberMedium: textStyles.instrumentNumber,
  unit: textStyles.unit,
  metaLabel: textStyles.microLabel,
  metaValue: textStyles.metricValue,
} as const;

export const spacing = {
  panelPadding: '3rem',
  dataRowPadding: '2rem 3rem',
  topBarInset: '1.5rem',
} as const;
