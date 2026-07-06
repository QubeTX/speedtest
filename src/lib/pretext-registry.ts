import { fontFamilies, typography } from '../theme/tokens';

export interface TextEntryConfig {
  text: string;
  fontWeight: number;
  /** rem value as a string, e.g. '3.5rem' */
  fontSizeRem: string;
  lineHeight: number;
}

/**
 * Font family matching the text these entries measure. Everything registered
 * here (SysInfo meta, status strings, DNS lines, tooltip metrics) renders in
 * the instrument voice (IBM Plex Mono) under the v4 type system — imported
 * from tokens so measurement can never drift from rendering again.
 */
const FONT_FAMILY = fontFamilies.instrument;

/**
 * Resolve a rem string to px given the root font size.
 */
export function remToPx(rem: string, rootFontSize: number): number {
  return parseFloat(rem) * rootFontSize;
}

/**
 * Build a CSS font shorthand string for canvas measureText.
 * Must exactly match the computed CSS font on the measured elements.
 */
export function buildFontShorthand(weight: number, sizePx: number): string {
  return `${weight} ${sizePx}px ${FONT_FAMILY}`;
}

/**
 * Text entries pretext measures to reserve worst-case minHeight and prevent
 * layout shift. The v4 design overhaul made the hero/metric numerals fluid
 * (clamp()) AND single-line + always-present (placeholder → value at identical
 * metrics), so those rows can't shift — they no longer need a measured entry.
 * What remains here is genuinely-wrapping multi-line text (SysInfo, tooltips,
 * status/DNS strings) where reflow risk is real.
 */

function sysinfoEntry(): Record<string, TextEntryConfig> {
  // Worst-case SysInfo: 4 lines of metadata text
  const worstCase = [
    'SERVER: CLOUDFLARE-SPEEDTEST-SFO',
    'ISP: COMCAST CABLE COMMUNICATIONS',
    '100 MBPS • 50 MS RTT',
    'BUILT BY QUBETX',
  ].join('\n');

  return {
    'sysinfo-worst': {
      text: worstCase,
      fontWeight: typography.metaLabel.fontWeight,
      fontSizeRem: '0.65rem',
      lineHeight: 1.6,
    },
  };
}

function statusEntries(): Record<string, TextEntryConfig> {
  return {
    'status-text-mobile': {
      text: 'MEASURING LATENCY',
      fontWeight: 500,
      fontSizeRem: '1rem',
      lineHeight: 1.5,
    },
    'status-text-desktop': {
      text: 'MEASURING LATENCY',
      fontWeight: 500,
      fontSizeRem: '1.25rem',
      lineHeight: 1.5,
    },
    'provider-label': {
      text: 'VIA SWITCHING TO M-LAB NDT7',
      fontWeight: 400,
      fontSizeRem: '0.7rem',
      lineHeight: 1.5,
    },
  };
}

function dnsEntry(): Record<string, TextEntryConfig> {
  return {
    'dns-summary': {
      text: '8/8 REACHABLE • 888ms',
      fontWeight: 500,
      fontSizeRem: '0.65rem',
      lineHeight: 1.5,
    },
  };
}

function tooltipEntries(): Record<string, TextEntryConfig> {
  // Worst-case tooltip: longest description + range label from tooltips.ts
  const worstCase = [
    'The industry-standard algorithm for measuring jitter, defined in RFC 3550.',
    'The same formula used by VoIP phones, Zoom, and video conferencing systems',
    'to gauge connection smoothness.',
    'Grade F — severe bufferbloat. Fast on paper, miserable in practice.',
  ].join(' ');

  // Single structural breakpoint (v4): wide vs narrow tooltip body sizes,
  // matching Tooltip.tsx's collapsed size map.
  return {
    'tooltip-body-wide': { text: worstCase, fontWeight: 400, fontSizeRem: '0.8rem', lineHeight: 1.55 },
    'tooltip-body-narrow': { text: worstCase, fontWeight: 400, fontSizeRem: '0.65rem', lineHeight: 1.55 },
  };
}

/** Complete registry of all text entries */
export const textRegistry: Record<string, TextEntryConfig> = {
  ...sysinfoEntry(),
  ...statusEntries(),
  ...dnsEntry(),
  ...tooltipEntries(),
};
