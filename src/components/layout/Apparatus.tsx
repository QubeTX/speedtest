import type { CSSProperties, ReactNode } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { colors, borders } from '../../theme/tokens';

interface ApparatusProps {
  left: ReactNode;
  right: ReactNode;
}

export default function Apparatus({ left, right }: ApparatusProps) {
  const { isDesktop, isMobile } = useResponsive();

  const style: CSSProperties = {
    width: '100%',
    maxWidth: isDesktop ? '1200px' : '600px',
    maxHeight: isDesktop ? 'calc(100dvh - 2rem)' : undefined,
    backgroundColor: colors.bgDevice,
    border: borders.stroke,
    borderRadius: borders.radiusBox,
    display: 'grid',
    gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
    overflow: isDesktop ? 'hidden' : 'visible',
    position: 'relative',
    boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
  };

  return (
    <div style={style}>
      {isDesktop && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: '3px',
            backgroundColor: colors.ink,
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}
        />
      )}
      <div
        style={{
          padding: isMobile ? '0.75rem 1.5rem' : isDesktop ? '3rem' : '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          minHeight: isMobile ? 'auto' : isDesktop ? 'auto' : '400px',
        }}
      >
        {left}
      </div>
      <div
        style={{
          backgroundColor: colors.bgScreen,
          display: 'flex',
          flexDirection: 'column',
          borderTop: isDesktop ? 'none' : borders.stroke,
        }}
      >
        {right}
      </div>
    </div>
  );
}
