import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { colors, borders, fontWeights } from '../../theme/tokens';
import { useReelDrive } from '../../hooks/useReelDrive';
import TapeReel from './TapeReel';
import type { TestPhase } from '../../types/speedtest';

interface TapeMechanismProps {
  phase: TestPhase;
  /** Instantaneous throughput (Mbps) — modulates reel spin speed. */
  currentSpeed?: number;
  /** Download progress, 0-100 (same scale as SpeedTestProgress). Feeds the
   *  supply -> take-up tape-fill wind via useReelDrive. */
  downloadProgress?: number;
  /** Upload progress, 0-100. Feeds the take-up -> supply tape-fill rewind. */
  uploadProgress?: number;
  onPress: () => void;
  disabled?: boolean;
}

/** Fluid reel diameter — exact per the v4 design spec. Deck width/height are
 *  derived from this via calc() so the whole mechanism scales genuinely
 *  (no transform: scale() wrapper, no JS-measured breakpoint switch). */
const REEL_SIZE_CSS = 'clamp(96px, 40vw, 154px)';
const DECK_WIDTH_CSS = `calc(${REEL_SIZE_CSS} + 32px)`;
const DECK_HEIGHT_CSS = `calc(2 * ${REEL_SIZE_CSS} + 64px)`;

/** Scoped styles this component owns outright (fluid reel sizing overrides
 *  TapeReel's numeric SVG width/height attributes; presentation attributes
 *  sit below any author stylesheet rule, so no !important is needed). Also
 *  hosts the spool-up kick keyframe and a light press affordance — kept here
 *  rather than in index.css since that file belongs to the foundation pass. */
const MECHANISM_STYLE = `
  .mechanism-reel svg { width: ${REEL_SIZE_CSS}; height: ${REEL_SIZE_CSS}; }
  @keyframes mechanism-kick {
    0% { transform: scale(1); }
    50% { transform: scale(1.015); }
    100% { transform: scale(1); }
  }
  .mechanism-btn:active:not(:disabled) { transform: scale(0.985); }
`;

function ariaLabelForPhase(phase: TestPhase): string {
  switch (phase) {
    case 'idle': return 'Start speed test';
    case 'discovering': return 'Connecting to test server';
    case 'latency': return 'Measuring latency';
    case 'download': return 'Testing download speed';
    case 'upload': return 'Testing upload speed';
    case 'complete': return 'Test complete — press to reset';
    case 'error': return 'Test failed — press to reset';
    default: return 'Speed test';
  }
}

export default function TapeMechanism({
  phase,
  currentSpeed = 0,
  downloadProgress = 0,
  uploadProgress = 0,
  onPress,
  disabled,
}: TapeMechanismProps) {
  const isIdle = phase === 'idle';
  const isComplete = phase === 'complete';
  const isError = phase === 'error';
  const isTesting = !isIdle && !isComplete && !isError;

  // Top reel = supply (starts full, feeds out on download). Bottom reel =
  // take-up (starts empty, fills on download; rewinds on upload). Rotation
  // direction/speed and the fill targets all come from reel-geometry via the
  // drive hook — this component just wires phase + live measurements in.
  const { supplyRef, takeupRef, supplyFill, takeupFill, reduced } = useReelDrive({
    phase,
    mbps: currentSpeed,
    dlProgress: downloadProgress / 100,
    ulProgress: uploadProgress / 100,
  });

  // Spool-up kick: a brief scale pulse the instant a run begins (idle/
  // complete/error -> discovering/latency). The CSS keyframe is auto-clamped
  // to ~instant under prefers-reduced-motion by index.css's sitewide rule;
  // `reduced` (already computed by useReelDrive) additionally skips even
  // triggering it.
  const [kicking, setKicking] = useState(false);
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const wasAtRest = prev === 'idle' || prev === 'complete' || prev === 'error';
    const nowStarting = phase === 'discovering' || phase === 'latency';
    // wasAtRest/nowStarting are disjoint phase sets, so reaching here already
    // implies prev !== phase — no extra inequality check needed.
    if (wasAtRest && nowStarting && !reduced) setKicking(true);
    prevPhaseRef.current = phase;
  }, [phase, reduced]);

  const showPlay = isIdle;
  const showAlert = isError;

  const buttonStyle: CSSProperties = {
    width: DECK_WIDTH_CSS,
    height: DECK_HEIGHT_CSS,
    border: borders.stroke,
    borderRadius: borders.radiusPill,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    cursor: disabled ? 'default' : 'pointer',
    transition: 'transform 0.12s ease',
    animation: kicking ? 'mechanism-kick 260ms cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
    background: isError
      ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,59,48,0.05) 10px, rgba(255,59,48,0.05) 20px)'
      : 'transparent',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <>
      <style>{MECHANISM_STYLE}</style>
      <button
        type="button"
        className="mechanism-btn"
        aria-label={ariaLabelForPhase(phase)}
        aria-busy={isTesting}
        disabled={disabled}
        onClick={onPress}
        onAnimationEnd={(e) => {
          if (e.animationName === 'mechanism-kick') setKicking(false);
        }}
        style={buttonStyle}
      >
        {/* Inner vertical rails */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '25%',
            bottom: '25%',
            left: '11%',
            right: '11%',
            borderLeft: borders.stroke,
            borderRight: borders.stroke,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Play icon with frosted glass background — idle only */}
        {showPlay && (
          <div
            aria-hidden="true"
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
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontWeight: fontWeights.extrabold,
              fontSize: '3rem',
              color: colors.error,
              zIndex: 5,
            }}
          >
            !
          </div>
        )}

        {/* Supply reel (top) */}
        <div className="mechanism-reel" style={{ position: 'relative', zIndex: 2 }}>
          <TapeReel ref={supplyRef} size={154} tapeFill={supplyFill} reduced={reduced} />
        </div>

        {/* Take-up reel (bottom) */}
        <div className="mechanism-reel" style={{ position: 'relative', zIndex: 2 }}>
          <TapeReel ref={takeupRef} size={154} tapeFill={takeupFill} reduced={reduced} />
        </div>
      </button>
    </>
  );
}
