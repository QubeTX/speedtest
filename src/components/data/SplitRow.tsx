import type { CSSProperties, ReactNode } from 'react';
import { colors, borders } from '../../theme/tokens';
import { useIsWide } from '../../hooks/useResponsive';
import CrosshairCorners from '../layout/CrosshairCorners';
import ActiveEdge from './ActiveEdge';

interface SplitRowProps {
  isActive?: boolean;
  children: ReactNode;
}

/** Shared fluid data-row padding (v4: single breakpoint, clamp() sizing). */
export const ROW_PADDING = 'clamp(1.25rem, 2.5vw, 2rem) clamp(1.5rem, 3vw, 3rem)';

export default function SplitRow({ isActive, children }: SplitRowProps) {
  const isWide = useIsWide();

  const style: CSSProperties = {
    flex: 1,
    borderBottom: borders.stroke,
    padding: ROW_PADDING,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: isWide ? '2rem' : '1rem',
    position: 'relative',
    alignItems: 'center',
    transition: 'background-color 0.3s ease',
    backgroundColor: isActive ? colors.paper : 'transparent',
  };

  return (
    <div style={style}>
      <ActiveEdge active={!!isActive} />
      <CrosshairCorners />
      {children}
    </div>
  );
}
