import type { CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';
import { colors, borders } from '../../theme/tokens';

interface ProgressBarProps {
  /** Determinate fill percentage, 0-100. Ignored when `indeterminate` is true. */
  progress: number;
  visible: boolean;
  /**
   * Unknown-duration phases (no numeric progress to show yet) — renders a
   * looping shimmer sweep instead of a width-driven fill. Falls back to a
   * static diagonal stripe (no motion at all) under prefers-reduced-motion.
   */
  indeterminate?: boolean;
}

const trackBase: CSSProperties = {
  position: 'relative',
  height: '8px',
  width: '100%',
  border: `2px solid ${colors.ink}`,
  marginTop: '1.5rem',
  borderRadius: borders.radiusPill,
  overflow: 'hidden',
};

export default function ProgressBar({ progress, visible, indeterminate }: ProgressBarProps) {
  // Hook must run unconditionally (before the `visible` early-return) so hook
  // order stays stable across renders.
  const prefersReduced = useReducedMotion();

  if (!visible) return null;

  if (indeterminate) {
    const track: CSSProperties = { ...trackBase, backgroundColor: 'rgba(17, 17, 17, 0.06)' };

    if (prefersReduced) {
      // Static stripe: no sweep, no loop — just a steady "in progress" texture.
      return (
        <div style={track}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                `repeating-linear-gradient(45deg, ${colors.ink} 0, ${colors.ink} 4px, transparent 4px, transparent 9px)`,
              opacity: 0.35,
            }}
          />
        </div>
      );
    }

    return (
      <div style={track}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '55%',
            background: `linear-gradient(90deg, transparent, ${colors.ink}, transparent)`,
            animation: 'shimmer 1.4s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  const fill: CSSProperties = {
    height: '100%',
    backgroundColor: colors.ink,
    borderRadius: borders.radiusPill,
    width: `${Math.min(100, Math.max(0, progress))}%`,
    // index.css's reduced-motion reset only neutralizes `animation-*`, never
    // `transition-*`, so gate the width slide here: reduced-motion users get an
    // instant jump to each new fill length instead of a 260ms glide.
    transition: prefersReduced ? 'none' : 'width 260ms cubic-bezier(0.22, 1, 0.36, 1)',
  };

  return (
    <div style={trackBase}>
      <div style={fill} />
    </div>
  );
}
