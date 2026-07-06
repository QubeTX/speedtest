// Segmented LED VU meter (SpeedQX v4 design overhaul). A row of monochrome
// "ink" squares that light up left-to-right as throughput rises, sharing the
// exact log curve reel-geometry uses to map Mbps -> spin speed, so the reels
// and the meter always agree on "how fast does this feel." The top 1-2 lit
// segments flicker like a real LED meter's leading edge, and a peak marker
// holds briefly then decays slowly back down.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';
import { colors } from '../../theme/tokens';
import { MOTION, clamp01, omegaForMbps } from '../mechanism/reel-geometry';

interface VuMeterProps {
  /** Current instantaneous throughput driving the meter, Mbps. */
  mbps: number;
  /** Number of LED segments. Defaults to the canonical 16. */
  segments?: number;
  /** Force reduced motion. Omit to auto-detect via prefers-reduced-motion. */
  reduced?: boolean;
  /** Pass-through style for the outer wrapper (layout/placement only). */
  style?: CSSProperties;
}

const SEGMENT_COUNT_DEFAULT = 16;
/** Top N currently-lit segments flicker (spec: "top 1-2"). */
const FLICKER_SEGMENTS = 2;
/** Peak holds at its high-water mark this long before it starts falling. */
const PEAK_HOLD_MS = 600;
/** Peak decay rate, in fraction-of-full-scale per second — deliberately slow. */
const PEAK_DECAY_PER_SEC = 0.45;

/**
 * Normalized 0..1 level for `mbps`, reusing reel-geometry's log-scaled
 * velocity map (imported, not re-derived) so the meter and the reels agree.
 */
function levelFraction(mbps: number): number {
  const omega = omegaForMbps(mbps);
  return clamp01((omega - MOTION.omegaMin) / (MOTION.omegaMax - MOTION.omegaMin));
}

export default function VuMeter({
  mbps,
  segments = SEGMENT_COUNT_DEFAULT,
  reduced,
  style,
}: VuMeterProps) {
  const autoReduced = useReducedMotion();
  const effectiveReduced = reduced ?? !!autoReduced;

  const level = levelFraction(mbps);
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  const peakRef = useRef(level);
  const holdUntilRef = useRef(0);
  const [peak, setPeak] = useState(level);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Reduced motion: peak tracks the live level immediately, no hold/decay.
  useEffect(() => {
    if (!effectiveReduced) return;
    peakRef.current = level;
    setPeak(level);
  }, [effectiveReduced, level]);

  // Full motion: one persistent RAF loop (mirrors useReelDrive's pattern) that
  // wakes whenever the level rises above the current peak, and stops itself
  // once the peak has fully settled back down to the live level.
  useEffect(() => {
    if (effectiveReduced) return;

    const loop = (now: number) => {
      const dt = lastTimeRef.current == null ? 0 : (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      const cur = levelRef.current;
      let changed = false;

      if (cur >= peakRef.current) {
        if (peakRef.current !== cur) {
          peakRef.current = cur;
          changed = true;
        }
        holdUntilRef.current = now + PEAK_HOLD_MS;
      } else if (now >= holdUntilRef.current) {
        const next = Math.max(cur, peakRef.current - PEAK_DECAY_PER_SEC * dt);
        if (next !== peakRef.current) {
          peakRef.current = next;
          changed = true;
        }
      }

      if (changed) setPeak(peakRef.current);

      const settled = peakRef.current <= cur + 1e-4;
      if (!settled) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
        lastTimeRef.current = null;
      }
    };

    if (rafRef.current == null) {
      lastTimeRef.current = null;
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // Re-runs (waking the loop if it had stopped) whenever level changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, effectiveReduced]);

  const displayLevel = effectiveReduced ? level : Math.max(level, peak);
  const litCount = Math.round(clamp01(displayLevel) * segments);

  return (
    <div
      role="img"
      aria-label={`Throughput meter, ${Math.round(clamp01(level) * 100)} percent of scale`}
      style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', ...style }}
    >
      {Array.from({ length: segments }, (_, i) => {
        const lit = i < litCount;
        const flicker = lit && !effectiveReduced && i >= litCount - FLICKER_SEGMENTS;
        const segStyle: CSSProperties = {
          width: '6px',
          height: '14px',
          borderRadius: '1px',
          flexShrink: 0,
          backgroundColor: colors.ink,
          opacity: lit ? 1 : 0.12,
          transition: effectiveReduced ? 'none' : 'opacity 120ms ease',
          animation: flicker ? `vu-flicker 400ms ease-in-out ${(i % 3) * 90}ms infinite` : undefined,
        };
        return <div key={i} aria-hidden="true" style={segStyle} />;
      })}
      <style>{`@keyframes vu-flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>
    </div>
  );
}
