import { responsive, type Breakpoint } from '../theme/responsive';
import { typography } from '../theme/tokens';

export interface TextEntryConfig {
  text: string;
  fontWeight: number;
  /** rem value as a string, e.g. '3.5rem' */
  fontSizeRem: string;
  lineHeight: number;
}

/** Font family matching tokens.ts typography.fontFamily */
const FONT_FAMILY = "'Guton', -apple-system, BlinkMacSystemFont, sans-serif";

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
 * All text entries to be measured by pretext.
 *
 * For dynamic values (speed numbers), we use worst-case representative strings.
 * Since the site uses fontVariantNumeric: 'tabular-nums', all digits are equal
 * width. "8888" covers the widest 4-digit speed value. Decimals like "888.88"
 * would be wider but speed display typically shows whole numbers or 1-2 decimals
 * at most; "8888" is a safe reservation.
 */

function speedEntries(): Record<string, TextEntryConfig> {
  const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'smallDesktop', 'desktop'];
  const entries: Record<string, TextEntryConfig> = {};

  for (const bp of breakpoints) {
    const r = responsive[bp];

    // Large numbers (download/upload speed)
    entries[`speed-large-${bp}`] = {
      text: '8888',
      fontWeight: typography.numberLarge.fontWeight,
      fontSizeRem: r.numberLarge,
      lineHeight: typography.numberLarge.lineHeight,
    };

    // Medium numbers (ping/jitter)
    entries[`speed-medium-${bp}`] = {
      text: '8888',
      fontWeight: typography.numberMedium.fontWeight,
      fontSizeRem: r.numberMedium,
      lineHeight: typography.numberMedium.lineHeight,
    };
  }

  return entries;
}

function sysinfoEntry(): Record<string, TextEntryConfig> {
  // Worst-case SysInfo: 4 lines of metadata text
  const worstCase = [
    'SERVER: CLOUDFLARE-SPEEDTEST-SFO',
    'ISP: COMCAST CABLE COMMUNICATIONS',
    '100 MBPS \u2022 50 MS RTT',
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
      text: '8/8 REACHABLE \u2022 888ms',
      fontWeight: 500,
      fontSizeRem: '0.65rem',
      lineHeight: 1.5,
    },
  };
}

/** Complete registry of all text entries */
export const textRegistry: Record<string, TextEntryConfig> = {
  ...speedEntries(),
  ...sysinfoEntry(),
  ...statusEntries(),
  ...dnsEntry(),
};
