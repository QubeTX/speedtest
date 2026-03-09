import type { CSSProperties, ReactNode } from 'react';
import { colors, borders } from '../../theme/tokens';
import { responsive } from '../../theme/responsive';
import { useResponsive } from '../../hooks/useResponsive';
import CrosshairCorners from '../layout/CrosshairCorners';

interface SplitRowProps {
  isActive?: boolean;
  children: ReactNode;
}

export default function SplitRow({ isActive, children }: SplitRowProps) {
  const { breakpoint } = useResponsive();
  const r = responsive[breakpoint];

  const style: CSSProperties = {
    flex: 1,
    borderBottom: borders.stroke,
    padding: r.dataRowPadding,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
    position: 'relative',
    alignItems: 'center',
    transition: 'background-color 0.3s ease',
    backgroundColor: isActive ? colors.paper : 'transparent',
  };

  return (
    <div style={style}>
      <CrosshairCorners />
      {children}
    </div>
  );
}
