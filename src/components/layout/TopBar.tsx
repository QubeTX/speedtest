import { useClock } from '../../hooks/useClock';
import { useResponsive } from '../../hooks/useResponsive';
import type { CSSProperties } from 'react';

interface TopBarProps {
  label?: string;
  errorTag?: string;
}

export default function TopBar({ label, errorTag }: TopBarProps) {
  const time = useClock();
  const { isMobile } = useResponsive();

  const style: CSSProperties = {
    position: 'absolute',
    top: isMobile ? '1rem' : '1.5rem',
    left: isMobile ? '1.5rem' : '2rem',
    right: isMobile ? '1.5rem' : '2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.05em',
    zIndex: 15,
  };

  return (
    <div style={style}>
      {label ? (
        <span>{label}</span>
      ) : (
        <img
          src="https://shaughv.s3.us-east-1.amazonaws.com/brandmark/QUBETX/QubeTX-Logo.svg"
          alt="QubeTX"
          style={{ height: isMobile ? '14px' : '18px', opacity: 0.8 }}
        />
      )}
      {errorTag ? (
        <span
          style={{
            color: '#ff3b30',
            fontWeight: 700,
            animation: 'blink 1s step-end infinite',
          }}
        >
          {errorTag}
        </span>
      ) : (
        <span>{time}</span>
      )}
    </div>
  );
}
