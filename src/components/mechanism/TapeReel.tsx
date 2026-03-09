import type { CSSProperties } from 'react';
import { colors, borders } from '../../theme/tokens';

interface TapeReelProps {
  spinning: boolean;
  spinDuration?: number; // seconds, lower = faster
  size?: number;
}

export default function TapeReel({ spinning, spinDuration = 0.4, size = 142 }: TapeReelProps) {
  const hubSize = Math.round(size * 0.28);

  const reelStyle: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    border: borders.stroke,
    borderRadius: '50%',
    backgroundColor: colors.bgScreen,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  };

  const hubStyle: CSSProperties = {
    width: `${hubSize}px`,
    height: `${hubSize}px`,
    backgroundColor: colors.ink,
    borderRadius: '50%',
    position: 'relative',
    animation: spinning ? `spin ${spinDuration}s linear infinite` : 'none',
  };

  // Spoke lines inside hub for visible rotation
  const spokeStyle = (deg: number): CSSProperties => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '3px',
    height: `${hubSize - 8}px`,
    backgroundColor: colors.bgScreen,
    transform: `translate(-50%, -50%) rotate(${deg}deg)`,
    opacity: 0.4,
  });

  return (
    <div style={reelStyle}>
      <div style={hubStyle}>
        <div style={spokeStyle(0)} />
        <div style={spokeStyle(60)} />
        <div style={spokeStyle(120)} />
      </div>
    </div>
  );
}
