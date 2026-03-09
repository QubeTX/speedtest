import { useState, type CSSProperties, type ReactNode } from 'react';
import { colors, borders } from '../../theme/tokens';

interface ActionButtonProps {
  onClick: () => void;
  children: ReactNode;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
}

export default function ActionButton({ onClick, children, variant = 'primary', disabled }: ActionButtonProps) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  const isPrimary = variant === 'primary';

  const style: CSSProperties = {
    width: '240px',
    height: '60px',
    backgroundColor: isPrimary
      ? (hover ? '#333' : colors.ink)
      : (hover ? colors.ink : 'transparent'),
    color: isPrimary
      ? colors.paper
      : (hover ? colors.paper : colors.ink),
    border: isPrimary ? 'none' : borders.stroke,
    borderRadius: borders.radiusPill,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: '1rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    transition: 'transform 0.1s ease, background-color 0.2s, color 0.2s',
    transform: active ? 'scale(0.96)' : 'scale(1)',
    opacity: disabled ? 0.5 : 1,
    touchAction: 'manipulation',
    textTransform: 'uppercase',
  };

  return (
    <button
      style={style}
      onClick={() => { if (!disabled) onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => { if (!disabled) setActive(true); }}
      onMouseUp={() => setActive(false)}
      onTouchStart={() => { if (!disabled) setActive(true); }}
      onTouchEnd={() => setActive(false)}
    >
      {children}
    </button>
  );
}
