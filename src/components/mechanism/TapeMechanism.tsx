import type { CSSProperties } from 'react';
import { useState } from 'react';
import { colors, borders } from '../../theme/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { responsive } from '../../theme/responsive';
import TapeReel from './TapeReel';
import type { TestPhase } from '../../types/speedtest';

interface TapeMechanismProps {
  phase: TestPhase;
  currentSpeed?: number; // Mbps, used to modulate spin speed
  onPress: () => void;
  disabled?: boolean;
}

export default function TapeMechanism({ phase, currentSpeed = 0, onPress, disabled }: TapeMechanismProps) {
  const [pressed, setPressed] = useState(false);
  const { breakpoint } = useResponsive();
  const scale = responsive[breakpoint].mechanismScale;

  const isIdle = phase === 'idle';
  const isComplete = phase === 'complete';
  const isError = phase === 'error';
  const isTesting = !isIdle && !isComplete && !isError;
  const isDownload = phase === 'download';
  const isUpload = phase === 'upload';
  const isLatency = phase === 'latency' || phase === 'discovering';

  // Spin duration based on speed (faster speed = faster spin)
  const baseDuration = 0.4;
  const speedFactor = currentSpeed > 0
    ? Math.max(0.15, baseDuration - (currentSpeed / 1000) * 0.25)
    : baseDuration;

  const topSpinning = isDownload || isUpload || isLatency;
  const bottomSpinning = isDownload || isUpload || isLatency;
  const topDuration = isDownload ? speedFactor : isUpload ? speedFactor * 1.3 : 1.2;
  const bottomDuration = isUpload ? speedFactor : isDownload ? speedFactor * 1.3 : 1.2;

  const showPlay = isIdle;
  const showAlert = isError;

  const coreStyle: CSSProperties = {
    width: '180px',
    height: '320px',
    border: borders.stroke,
    borderRadius: borders.radiusPill,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    cursor: disabled ? 'default' : 'pointer',
    transition: 'transform 0.1s ease',
    transform: `scale(${scale}${pressed ? ' * 0.98' : ''})`,
    transformOrigin: 'top center',
    background: isError
      ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,59,48,0.05) 10px, rgba(255,59,48,0.05) 20px)'
      : 'transparent',
    touchAction: 'manipulation',
    userSelect: 'none',
  };

  // Correct scale with press
  if (pressed && !disabled) {
    coreStyle.transform = `scale(${scale * 0.98})`;
  } else {
    coreStyle.transform = `scale(${scale})`;
  }

  const handleDown = () => { if (!disabled) setPressed(true); };
  const handleUp = () => setPressed(false);

  const core = (
    <div
      style={coreStyle}
      onClick={() => { if (!disabled) onPress(); }}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchStart={handleDown}
      onTouchEnd={handleUp}
    >
      {/* Inner vertical rails */}
      <div
        style={{
          position: 'absolute',
          top: '80px',
          bottom: '80px',
          left: '20px',
          right: '20px',
          borderLeft: borders.stroke,
          borderRight: borders.stroke,
          zIndex: 1,
        }}
      />

      {/* Play icon with frosted glass background */}
      {showPlay && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            transition: 'opacity 0.2s',
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: '15px solid transparent',
              borderBottom: '15px solid transparent',
              borderLeft: `24px solid ${colors.ink}`,
              marginLeft: '4px',
            }}
          />
        </div>
      )}

      {/* Error alert indicator */}
      {showAlert && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontWeight: 800,
            fontSize: '3rem',
            color: colors.error,
            zIndex: 5,
          }}
        >
          !
        </div>
      )}

      {/* Top Reel */}
      <TapeReel spinning={topSpinning} spinDuration={topDuration} />

      {/* Bottom Reel */}
      <TapeReel spinning={bottomSpinning} spinDuration={bottomDuration} />
    </div>
  );

  if (scale < 1) {
    return (
      <div style={{
        height: `${320 * scale}px`,
        display: 'flex',
        justifyContent: 'center',
        overflow: 'visible',
      }}>
        {core}
      </div>
    );
  }

  return core;
}
