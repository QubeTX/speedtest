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

export const typography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  numberLarge: {
    fontSize: '7rem',
    fontWeight: 500,
    lineHeight: 0.8,
    letterSpacing: '-0.04em',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  numberMedium: {
    fontSize: '4rem',
    fontWeight: 500,
    lineHeight: 0.8,
    letterSpacing: '-0.04em',
    fontVariantNumeric: 'tabular-nums' as const,
  },
  unit: {
    fontSize: '1.5rem',
    fontWeight: 500,
  },
  metaLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    fontWeight: 600,
    color: '#111111',
  },
  metaValue: {
    fontSize: '0.85rem',
    fontWeight: 500,
  },
} as const;

export const spacing = {
  panelPadding: '3rem',
  dataRowPadding: '2rem 3rem',
  topBarInset: '1.5rem',
} as const;
