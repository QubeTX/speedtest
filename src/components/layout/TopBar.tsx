import { useClock } from '../../hooks/useClock';
import { useIsWide } from '../../hooks/useResponsive';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';

interface TopBarProps {
  label?: string;
  errorTag?: string;
}

export default function TopBar({ label, errorTag }: TopBarProps) {
  const time = useClock();
  const isWide = useIsWide();
  const navigate = useNavigate();

  const style: CSSProperties = {
    position: 'absolute',
    top: isWide ? '1.5rem' : '1rem',
    left: isWide ? '2rem' : '1.5rem',
    right: isWide ? '2rem' : '1.5rem',
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
        <a
          href="https://qubetx.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="QubeTX — visit qubetx.com"
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          <img
            src="https://shaughv.s3.us-east-1.amazonaws.com/brandmark/QUBETX/QubeTX-Logo.svg"
            alt="QubeTX"
            style={{ height: isWide ? '18px' : '14px', opacity: 0.8 }}
          />
        </a>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
        <button
          onClick={() => navigate('/how-it-works')}
          aria-label="How it works"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.35,
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.35';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <img
            src="/question-mark.svg"
            alt="How it works"
            style={{ height: isWide ? '20px' : '16px' }}
          />
        </button>
      </div>
    </div>
  );
}
