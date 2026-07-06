import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'motion/react';
import { colors, borders, textStyles } from '../../theme/tokens';

interface ActionButtonProps {
  onClick: () => void;
  children: ReactNode;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
}

/** Shared spring for both the hover lift and the tap press. */
const BUTTON_SPRING = { type: 'spring', stiffness: 400, damping: 25 } as const;

export default function ActionButton({ onClick, children, variant = 'primary', disabled }: ActionButtonProps) {
  const isPrimary = variant === 'primary';

  const style: CSSProperties = {
    width: '240px',
    height: '60px',
    backgroundColor: isPrimary ? colors.ink : 'transparent',
    color: isPrimary ? colors.paper : colors.ink,
    border: isPrimary ? 'none' : borders.stroke,
    borderRadius: borders.radiusPill,
    ...textStyles.button,
    fontSize: '1rem',
    textTransform: 'uppercase',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    opacity: disabled ? 0.5 : 1,
    touchAction: 'manipulation',
  };

  // Primary: darken on hover. Outline: invert to filled ink (matches the
  // previous hover treatment), both now layered with the new lift.
  const hoverAnimation = disabled
    ? undefined
    : isPrimary
      ? { y: -1, backgroundColor: '#333333' }
      : { y: -1, backgroundColor: colors.ink, color: colors.paper };

  return (
    <motion.button
      type="button"
      className="action-btn"
      style={style}
      onClick={onClick}
      disabled={disabled}
      whileHover={hoverAnimation}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={BUTTON_SPRING}
    >
      {children}
    </motion.button>
  );
}
