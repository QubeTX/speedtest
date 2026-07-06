import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { colors, textStyles } from '../../theme/tokens';

interface ResultsStampProps {
  visible: boolean;
}

/** easeOutBack — matches the bounce already used by the index.css `stamp-in`
 *  keyframe elsewhere, kept as a plain bezier array so motion can drive it. */
const EASE_OUT_BACK: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

export default function ResultsStamp({ visible }: ResultsStampProps) {
  // Hook runs unconditionally, before the early return, to keep hook order stable.
  const reduced = useReducedMotion();

  if (!visible) return null;

  const style: CSSProperties = {
    position: 'absolute',
    top: '38%',
    left: '50%',
    ...textStyles.stamp,
    border: `clamp(4px, 1.2vw, 8px) solid ${colors.ink}`,
    padding: 'clamp(0.4rem, 1.6vw, 1rem) clamp(0.8rem, 3.2vw, 2rem)',
    fontSize: 'clamp(1.6rem, 6vw, 2.5rem)',
    pointerEvents: 'none',
    zIndex: 20,
    // Solid paper plate: the previous translucent bgDevice + multiply blend
    // literally darkened over the dark tape pack, making the stamp hard to
    // read exactly where it landed. An opaque plate reads everywhere.
    background: colors.paper,
    boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
    whiteSpace: 'nowrap',
  };

  return (
    <motion.div
      style={style}
      aria-hidden="true"
      initial={{ opacity: 0, scale: reduced ? 1 : 1.25, x: '-50%', y: '-50%', rotate: -12 }}
      animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%', rotate: -8 }}
      transition={
        reduced
          ? { duration: 0.2, ease: 'easeOut' }
          : { duration: 0.42, ease: EASE_OUT_BACK }
      }
    >
      TEST COMPLETE
    </motion.div>
  );
}
