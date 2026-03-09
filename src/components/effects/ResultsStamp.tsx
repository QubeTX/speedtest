import type { CSSProperties } from 'react';
import { colors } from '../../theme/tokens';
import { useResponsive } from '../../hooks/useResponsive';

interface ResultsStampProps {
  visible: boolean;
}

export default function ResultsStamp({ visible }: ResultsStampProps) {
  const { isMobile } = useResponsive();

  if (!visible) return null;

  const style: CSSProperties = {
    position: 'absolute',
    top: '35%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-12deg)',
    border: `${isMobile ? '5px' : '8px'} solid ${colors.ink}`,
    padding: isMobile ? '0.5rem 1rem' : '1rem 2rem',
    fontWeight: 800,
    fontSize: isMobile ? '1.8rem' : '2.5rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    pointerEvents: 'none',
    zIndex: 20,
    background: colors.bgDevice,
    mixBlendMode: 'multiply',
    whiteSpace: 'nowrap',
    animation: 'stamp-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
  };

  return <div style={style}>TEST COMPLETE</div>;
}
