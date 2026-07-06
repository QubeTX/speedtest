import { forwardRef, useLayoutEffect, useRef } from 'react';
import { colors } from '../../theme/tokens';
import {
  REEL,
  rTape,
  spokeSegments,
  splineTeethSegments,
} from './reel-geometry';

interface TapeReelProps {
  /** Rendered pixel size (square). */
  size?: number;
  /**
   * Spool rotation in degrees. This is the DECLARATIVE fallback used for static
   * render, tests, and reduced motion. At runtime the drive hook (useReelDrive)
   * writes the spool's `transform` imperatively via the forwarded ref every
   * frame — keeping React out of the 60fps path — so when a ref is attached,
   * pass a stable `angleDeg` (e.g. 0) and let the hook take over.
   */
  angleDeg?: number;
  /** Tape-pack fill fraction 0..1 (drives the wound-tape outer radius). */
  tapeFill?: number;
  /** Reduced-motion hint: drops `will-change: transform` (no motion planning). */
  reduced?: boolean;
}

// Precomputed static segment geometry (identical for every reel instance).
const SPOKES = spokeSegments();
const TEETH = splineTeethSegments();

function setRef<T>(ref: React.ForwardedRef<T>, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
}

/**
 * Pure SVG cassette reel. Renders a STATIC group (flange, seat, tape-pack
 * annulus, tape edge, stria) plus a SPOOL group (spokes, hub ring, spline teeth,
 * center hole) that rotates. Contains no animation logic — it renders the state
 * it's handed; motion comes from useReelDrive.
 */
const TapeReel = forwardRef<SVGGElement, TapeReelProps>(function TapeReel(
  { size = 142, angleDeg = 0, tapeFill = 0.5, reduced = false },
  forwardedRef,
) {
  const spoolRef = useRef<SVGGElement | null>(null);

  // Reflect angleDeg → the spool transform imperatively (not via JSX) so React
  // never clobbers the drive hook's per-frame writes on this same element.
  useLayoutEffect(() => {
    const el = spoolRef.current;
    if (el) el.setAttribute('transform', `rotate(${angleDeg} ${REEL.cx} ${REEL.cy})`);
  }, [angleDeg]);

  const attachSpool = (el: SVGGElement | null) => {
    spoolRef.current = el;
    setRef(forwardedRef, el);
  };

  const rHub = REEL.tape.rHub;
  const rOuter = rTape(tapeFill);
  const packMid = (rHub + rOuter) / 2;
  const packWidth = Math.max(0, rOuter - rHub);
  const striaA = 115; // fixed seam angle (static — does not rotate)
  const striaInner = rHub + 0.5;
  const striaOuter = Math.max(striaInner, rOuter - 0.5);
  const striaSin = Math.sin((striaA * Math.PI) / 180);
  const striaCos = Math.cos((striaA * Math.PI) / 180);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${REEL.viewBox} ${REEL.viewBox}`}
      role="presentation"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
    >
      {/* ── STATIC group ─────────────────────────────────────────── */}
      {/* Reel face + flange ring */}
      <circle
        cx={REEL.cx}
        cy={REEL.cy}
        r={REEL.flange.r}
        fill={colors.bgScreen}
        stroke={colors.ink}
        strokeWidth={REEL.flange.sw}
      />
      {/* Seat ring (faint) */}
      <circle
        cx={REEL.cx}
        cy={REEL.cy}
        r={REEL.seat.r}
        fill="none"
        stroke={colors.ink}
        strokeWidth={REEL.seat.sw}
        opacity={REEL.seat.opacity}
      />
      {/* Tape pack — annulus drawn as a thick stroked circle at the pack midline */}
      {packWidth > 0.01 && (
        <circle
          cx={REEL.cx}
          cy={REEL.cy}
          r={packMid}
          fill="none"
          stroke={colors.ink}
          strokeWidth={packWidth}
          opacity={0.9}
        />
      )}
      {/* Tape edge — outer wound edge */}
      <circle
        cx={REEL.cx}
        cy={REEL.cy}
        r={rOuter}
        fill="none"
        stroke={colors.ink}
        strokeWidth={0.8}
      />
      {/* One stria — a single light seam across the pack (static) */}
      {striaOuter > striaInner && (
        <line
          x1={REEL.cx + striaInner * striaCos}
          y1={REEL.cy + striaInner * striaSin}
          x2={REEL.cx + striaOuter * striaCos}
          y2={REEL.cy + striaOuter * striaSin}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={0.7}
        />
      )}

      {/* ── SPOOL group (the only thing that rotates) ────────────── */}
      <g
        ref={attachSpool}
        style={{ willChange: reduced ? 'auto' : 'transform' }}
      >
        {/* Spokes */}
        {SPOKES.map((s, i) => (
          <line
            key={`spoke-${i}`}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={colors.bgScreen}
            strokeWidth={REEL.spool.spokeSw}
            strokeLinecap="round"
          />
        ))}
        {/* Hub ring */}
        <circle
          cx={REEL.cx}
          cy={REEL.cy}
          r={REEL.spool.hubRing.r}
          fill="none"
          stroke={colors.ink}
          strokeWidth={REEL.spool.hubRing.sw}
        />
        {/* Spline teeth */}
        {TEETH.map((t, i) => (
          <line
            key={`tooth-${i}`}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={colors.ink}
            strokeWidth={REEL.spool.teeth.sw}
            strokeLinecap="round"
          />
        ))}
        {/* Center hole */}
        <circle
          cx={REEL.cx}
          cy={REEL.cy}
          r={REEL.spool.centerHole.r}
          fill={colors.bgScreen}
          stroke={colors.ink}
          strokeWidth={REEL.spool.centerHole.sw}
        />
      </g>
    </svg>
  );
});

export default TapeReel;
