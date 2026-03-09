export const breakpoints = {
  mobile: 600,
  tablet: 900,
} as const;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function getBreakpoint(width: number): Breakpoint {
  if (width < breakpoints.mobile) return 'mobile';
  if (width < breakpoints.tablet) return 'tablet';
  return 'desktop';
}

export const responsive = {
  mobile: {
    mechanismScale: 0.65,
    numberLarge: '3.5rem',
    numberMedium: '2.5rem',
    unit: '1rem',
    panelPadding: '1.5rem',
    dataRowPadding: '1rem 1.5rem',
  },
  tablet: {
    mechanismScale: 0.85,
    numberLarge: '5rem',
    numberMedium: '3rem',
    unit: '1.25rem',
    panelPadding: '2rem',
    dataRowPadding: '1.5rem 2rem',
  },
  desktop: {
    mechanismScale: 1,
    numberLarge: '7rem',
    numberMedium: '4rem',
    unit: '1.5rem',
    panelPadding: '3rem',
    dataRowPadding: '2rem 3rem',
  },
} as const;
