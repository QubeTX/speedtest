import { useEffect, useRef, useState } from 'react';
import type { TestPhase } from '../types/speedtest';
import {
  IDLE_FILLS,
  MOTION,
  REEL,
  reelSignedOmega,
  tapeFillsForPhase,
} from '../components/mechanism/reel-geometry';

export interface UseReelDriveParams {
  phase: TestPhase;
  /** Current instantaneous throughput (Mbps) driving spin speed. */
  mbps: number;
  /** Download progress 0..1 (winds supply → take-up). */
  dlProgress: number;
  /** Upload progress 0..1 (rewinds take-up → supply). */
  ulProgress: number;
  /** Force reduced motion. Omit to auto-detect via prefers-reduced-motion. */
  reduced?: boolean;
}

export interface ReelDriveHandles {
  /** Attach to the supply reel's spool <g> (forwarded ref of TapeReel). */
  supplyRef: React.MutableRefObject<SVGGElement | null>;
  /** Attach to the take-up reel's spool <g>. */
  takeupRef: React.MutableRefObject<SVGGElement | null>;
  /** Smoothed supply tape-fill 0..1 (feed to TapeReel `tapeFill`). */
  supplyFill: number;
  /** Smoothed take-up tape-fill 0..1. */
  takeupFill: number;
  /** Effective reduced-motion state (pass through to TapeReel `reduced`). */
  reduced: boolean;
}

const FILL_TAU_SEC = 0.2; // ~200ms ease toward progress targets
const DT_CLAMP_SEC = 0.05; // guard against post-stall dt spikes
const OMEGA_EPS = 1e-4;
const FILL_EPS = 1e-4;
const COMMIT_EPS = 6e-4; // min fill delta before a React re-render

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    onChange();
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return reduced;
}

/**
 * Single requestAnimationFrame integrator driving both cassette reels.
 *
 * Rotation is written imperatively to the two spool <g> elements every frame
 * (React stays out of the 60fps path): a signed angular velocity eases toward
 * the phase/throughput target with asymmetric inertia (fast spin-up τ=0.45s,
 * slow spin-down τ=0.9s), and the accumulated angle is applied to both reels.
 * Direction follows the phase — download winds clockwise, upload rewinds
 * counter-clockwise.
 *
 * The tape-fill radii ride a separate low-frequency channel: they ease ~200ms
 * toward the phase targets and surface as React state, so radius changes are
 * decoupled from rotation.
 *
 * The loop pauses while the document is hidden and, under prefers-reduced-motion
 * (auto-detected or forced via `reduced`), freezes rotation entirely while still
 * animating tape radius.
 */
export function useReelDrive(params: UseReelDriveParams): ReelDriveHandles {
  const autoReduced = usePrefersReducedMotion();
  const effectiveReduced = params.reduced ?? autoReduced;

  const supplyRef = useRef<SVGGElement | null>(null);
  const takeupRef = useRef<SVGGElement | null>(null);

  const [fills, setFills] = useState<{ supply: number; takeup: number }>(() => ({
    supply: IDLE_FILLS.supply,
    takeup: IDLE_FILLS.takeup,
  }));

  // Live values read by the RAF closure without re-subscribing.
  const paramsRef = useRef(params);
  const reducedRef = useRef(effectiveReduced);
  const velRef = useRef(0); // signed angular velocity, rev/s
  const angleRef = useRef(0); // accumulated degrees
  const supplyFillRef = useRef(IDLE_FILLS.supply);
  const takeupFillRef = useRef(IDLE_FILLS.takeup);
  const committedRef = useRef({ supply: IDLE_FILLS.supply, takeup: IDLE_FILLS.takeup });
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastTimeRef = useRef<number | null>(null);
  const ensureRunningRef = useRef<() => void>(() => {});

  // Mount-only: install the RAF loop, the run controller, and the visibility
  // pause. Kept separate from the param-poke effect below so a changing `mbps`
  // (every progress tick) doesn't churn the loop or re-bind the listener.
  useEffect(() => {
    const writeTransform = (el: SVGGElement | null, angle: number) => {
      if (el) el.setAttribute('transform', `rotate(${angle.toFixed(3)} ${REEL.cx} ${REEL.cy})`);
    };

    const commitFills = (force = false) => {
      const s = supplyFillRef.current;
      const t = takeupFillRef.current;
      if (
        force ||
        Math.abs(s - committedRef.current.supply) > COMMIT_EPS ||
        Math.abs(t - committedRef.current.takeup) > COMMIT_EPS
      ) {
        committedRef.current = { supply: s, takeup: t };
        setFills({ supply: s, takeup: t });
      }
    };

    const loop = (nowMs: number) => {
      const p = paramsRef.current;
      const reduced = reducedRef.current;

      let dt = 0;
      if (lastTimeRef.current != null) dt = (nowMs - lastTimeRef.current) / 1000;
      lastTimeRef.current = nowMs;
      const firstFrame = dt === 0;
      if (dt > DT_CLAMP_SEC) dt = DT_CLAMP_SEC;

      // ── Rotation (skipped under reduced motion) ──
      let rotating = false;
      if (!reduced && dt > 0) {
        const target = reelSignedOmega(p.phase, p.mbps);
        const accelerating = Math.abs(target) > Math.abs(velRef.current);
        const tau = accelerating ? MOTION.tauUpSec : MOTION.tauDownSec;
        const alpha = 1 - Math.exp(-dt / tau);
        velRef.current += (target - velRef.current) * alpha;
        if (Math.abs(velRef.current) < OMEGA_EPS && Math.abs(target) < OMEGA_EPS) {
          velRef.current = 0;
        } else {
          angleRef.current = (angleRef.current + velRef.current * 360 * dt) % 360;
          writeTransform(supplyRef.current, angleRef.current);
          writeTransform(takeupRef.current, angleRef.current);
          rotating = true;
        }
      }

      // ── Tape fill (allowed under reduced motion) ──
      let filling = false;
      if (dt > 0) {
        const target = tapeFillsForPhase(p.phase, p.dlProgress, p.ulProgress);
        if (target) {
          const af = 1 - Math.exp(-dt / FILL_TAU_SEC);
          supplyFillRef.current += (target.supply - supplyFillRef.current) * af;
          takeupFillRef.current += (target.takeup - takeupFillRef.current) * af;
          const settled =
            Math.abs(target.supply - supplyFillRef.current) <= FILL_EPS &&
            Math.abs(target.takeup - takeupFillRef.current) <= FILL_EPS;
          if (settled) {
            supplyFillRef.current = target.supply;
            takeupFillRef.current = target.takeup;
          } else {
            filling = true;
          }
          commitFills(settled);
        }
      }

      if (firstFrame || rotating || filling) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        runningRef.current = false;
        rafRef.current = null;
        commitFills(true);
      }
    };

    const ensureRunning = () => {
      if (runningRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      runningRef.current = true;
      lastTimeRef.current = null;
      rafRef.current = requestAnimationFrame(loop);
    };
    ensureRunningRef.current = ensureRunning;

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        runningRef.current = false;
        lastTimeRef.current = null;
      } else {
        ensureRunning();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    ensureRunning();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      runningRef.current = false;
    };
  }, []);

  // Poke the loop awake whenever the driving params change (cheap; the loop
  // itself reads the latest values from paramsRef/reducedRef each frame).
  useEffect(() => {
    paramsRef.current = {
      phase: params.phase,
      mbps: params.mbps,
      dlProgress: params.dlProgress,
      ulProgress: params.ulProgress,
    };
    reducedRef.current = effectiveReduced;
    ensureRunningRef.current();
  }, [params.phase, params.mbps, params.dlProgress, params.ulProgress, effectiveReduced]);

  return {
    supplyRef,
    takeupRef,
    supplyFill: fills.supply,
    takeupFill: fills.takeup,
    reduced: effectiveReduced,
  };
}
