import type { CSSProperties } from 'react';
import { colors, borders } from '../../theme/tokens';

interface ProgressBarProps {
  progress: number; // 0-100
  visible: boolean;
}

export default function ProgressBar({ progress, visible }: ProgressBarProps) {
  if (!visible) return null;

  const container: CSSProperties = {
    height: '8px',
    width: '100%',
    border: `2px solid ${colors.ink}`,
    marginTop: '1.5rem',
    borderRadius: borders.radiusPill,
    overflow: 'hidden',
  };

  const fill: CSSProperties = {
    height: '100%',
    backgroundColor: colors.ink,
    transition: 'width 0.1s linear',
    width: `${Math.min(100, Math.max(0, progress))}%`,
  };

  return (
    <div style={container}>
      <div style={fill} />
    </div>
  );
}
