// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.

// Canonical cassette-reel geometry + motion math (SpeedQX v5).
//
// Single source of truth for the reel drawing, shared across platforms (this is
// a byte-faithful port of the website's reel-geometry.ts — same numbers).
// Everything is expressed in a normalized viewBox of 100 × 100 so strokes scale
// for free; the renderer only picks a pixel `size`.
//
// Layering (back → front):
//   STATIC group:  flange ring · seat ring · tape-pack annulus · tape edge · stria
//   SPOOL group:   3 spokes · hub ring · 6 spline teeth · center hole   (rotates)
// Only the SPOOL group rotates. The tape-pack radius rides the low-frequency
// progress channel and is decoupled from rotation.

type TestPhase = 'idle' | 'discovering' | 'latency' | 'download' | 'upload' | 'complete' | 'error';

// ─── Geometry constants ─────────────────────────────────────────────────────

export const REEL = {
  /** Normalized coordinate space (0..VIEWBOX in both axes). */
  viewBox: 100,
  cx: 50,
  cy: 50,
  /** Outer flange ring. */
  flange: { r: 47, sw: 3.2 },
  /** Inner seat ring (faint). */
  seat: { r: 41, sw: 1.0, opacity: 0.25 },
  /** Area-conserving tape pack winds between rHub and rMax. */
  tape: { rHub: 16, rMax: 39 },
  spool: {
    /** Three bold rounded spokes at these angles (deg, SVG y-down). */
    spokeAnglesDeg: [90, 210, 330] as const,
    spokeInnerR: 15,
    spokeOuterR: 38,
    spokeSw: 5,
    hubRing: { r: 15, sw: 2.4 },
    /** Six spline teeth, evenly spaced, radial ticks near the hub. */
    teeth: { count: 6, innerR: 5.5, outerR: 9, sw: 2.2, stepDeg: 60 },
    centerHole: { r: 4.5, sw: 1.4 },
  },
} as const;

// ─── Small math helpers ─────────────────────────────────────────────────────

// The pure math helpers below carry the 'worklet' directive so they are
// callable from Reanimated UI-thread contexts (useAnimatedStyle/Props,
// useFrameCallback) as well as plain JS. Without it, calling one from a
// worklet aborts the app in release builds ("Tried to synchronously call a
// non-worklet function on the UI thread") — the crash class behind the
// 2.1.0 build-7 TestFlight crash (VuMeter called clamp01 in a worklet).
// The directive changes nothing about the shared numeric parity with the
// website's reel-geometry.ts.

export function clamp(x: number, lo: number, hi: number): number {
  'worklet';
  return x < lo ? lo : x > hi ? hi : x;
}

export function clamp01(x: number): number {
  'worklet';
  return clamp(x, 0, 1);
}

function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

export interface Point {
  x: number;
  y: number;
}

/** Polar → cartesian in the reel's normalized space (SVG y-down: 0°=+x, 90°=down). */
export function polar(r: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  return { x: REEL.cx + r * Math.cos(rad), y: REEL.cy + r * Math.sin(rad) };
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The three spool spokes as line segments (inner → outer radius). */
export function spokeSegments(): Segment[] {
  const { spokeAnglesDeg, spokeInnerR, spokeOuterR } = REEL.spool;
  return spokeAnglesDeg.map((deg) => {
    const a = polar(spokeInnerR, deg);
    const b = polar(spokeOuterR, deg);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
}

/** The six spline teeth as short radial line segments. */
export function splineTeethSegments(): Segment[] {
  const { count, innerR, outerR, stepDeg } = REEL.spool.teeth;
  const segs: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const deg = i * stepDeg;
    const a = polar(innerR, deg);
    const b = polar(outerR, deg);
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  return segs;
}

/**
 * Area-conserving tape-pack outer radius for a fill fraction f ∈ [0,1].
 * Winding a constant-thickness tape onto the hub grows the pack's AREA linearly,
 * so the radius follows √(rHub² + f·(rMax² − rHub²)) — not a linear radius ramp.
 */
export function rTape(fill: number): number {
  'worklet';
  const f = clamp01(fill);
  const { rHub, rMax } = REEL.tape;
  return Math.sqrt(rHub * rHub + f * (rMax * rMax - rHub * rHub));
}

// ─── Phase → tape fill mapping ──────────────────────────────────────────────

export interface TapeFills {
  /** Supply reel fill fraction (0..1). */
  supply: number;
  /** Take-up reel fill fraction (0..1). */
  takeup: number;
}

/** Resting state before a run: supply nearly full, take-up nearly empty. */
export const IDLE_FILLS: TapeFills = { supply: 0.85, takeup: 0.15 };

const FILL_HI = 0.85;
const FILL_LO = 0.15;

/**
 * Target tape fills for a phase. Download winds supply → take-up (by download
 * progress); upload REWINDS take-up → supply (by upload progress); complete
 * settles back to the resting (rewound) state. Returns `null` for the error
 * phase, meaning "freeze — hold the last fills" (the drive keeps current values).
 */
export function tapeFillsForPhase(
  phase: TestPhase,
  downloadProgress: number,
  uploadProgress: number,
): TapeFills | null {
  'worklet';
  switch (phase) {
    case 'download': {
      const d = clamp01(downloadProgress);
      return { supply: lerp(FILL_HI, FILL_LO, d), takeup: lerp(FILL_LO, FILL_HI, d) };
    }
    case 'upload': {
      const u = clamp01(uploadProgress);
      // Rewind: take-up drains back into supply.
      return { supply: lerp(FILL_LO, FILL_HI, u), takeup: lerp(FILL_HI, FILL_LO, u) };
    }
    case 'complete':
    case 'error':
      return null; // freeze
    case 'idle':
    case 'discovering':
    case 'latency':
    default:
      return { supply: FILL_HI, takeup: FILL_LO };
  }
}

// ─── Motion drive (angular velocity + inertia) ──────────────────────────────

export const MOTION = {
  omegaMin: 0,
  /** Maximum angular velocity, revolutions per second. */
  omegaMax: 1.15,
  /** Gentle idle spin during discovery/latency (no throughput yet). */
  omegaIdle: 0,
  /** log10 normalizer: log10(1 + mbps) / log10(logRef), saturating near 1 Gbps. */
  logRef: 1001,
  /** Inertia time constants — spin-up is snappier than spin-down (motor feel). */
  tauUpSec: 0.45,
  tauDownSec: 0.9,
} as const;

/**
 * Steady-state angular velocity (rev/s) for a throughput in Mbps, log-scaled
 * from a truthful standstill at 0 Mbps to 1.15 reference rev/s near 1 Gbps.
 *   Nonzero traffic starts at 0.08 reference rev/s; angular speed scales by reel radius.
 */
export function omegaForMbps(mbps: number): number {
  'worklet';
  if (!Number.isFinite(mbps) || mbps <= 0) return 0;
  const t = clamp(Math.log10(1 + Math.max(0, mbps)) / Math.log10(MOTION.logRef), 0, 1);
  return 0.08 + (MOTION.omegaMax - 0.08) * t;
}

/** Target angular-velocity magnitude (rev/s) for a phase + current throughput. */
export function reelOmega(phase: TestPhase, mbps: number): number {
  'worklet';
  switch (phase) {
    case 'download':
    case 'upload':
      return omegaForMbps(mbps);
    case 'discovering':
    case 'latency':
      return MOTION.omegaIdle;
    case 'idle':
    case 'complete':
    case 'error':
    default:
      return 0;
  }
}

/**
 * Rotation direction for a phase: +1 = clockwise (download wind / forward idle),
 * −1 = counter-clockwise (upload rewind), 0 = stopped.
 */
export function reelDirection(phase: TestPhase): -1 | 0 | 1 {
  'worklet';
  switch (phase) {
    case 'download':
    case 'discovering':
    case 'latency':
      return 1;
    case 'upload':
      return -1;
    case 'idle':
    case 'complete':
    case 'error':
    default:
      return 0;
  }
}

/** Signed steady-state angular velocity (rev/s): direction × magnitude. */
export function reelSignedOmega(phase: TestPhase, mbps: number): number {
  'worklet';
  return reelDirection(phase) * reelOmega(phase, mbps);
}
