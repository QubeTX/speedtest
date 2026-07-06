import type { CSSProperties } from 'react';
import { colors } from '../../theme/tokens';

/**
 * Active-phase edge bar. A thin ink rule on the left edge of a data row that
 * springs in (scaleY 0 → 1) while its phase is active, pairing with the row's
 * transparent → paper background wash to light up the currently-measuring row.
 * Reduced motion is honored globally (index.css clamps the transition duration).
 */
export default function ActiveEdge({ active }: { active: boolean }) {
  const style: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px',
    backgroundColor: colors.ink,
    transform: active ? 'scaleY(1)' : 'scaleY(0)',
    transformOrigin: 'center',
    transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
    pointerEvents: 'none',
    zIndex: 3,
  };
  return <div aria-hidden="true" style={style} />;
}
