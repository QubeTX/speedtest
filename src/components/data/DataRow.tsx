import type { CSSProperties, ReactNode } from 'react';
import { colors, borders, textStyles, typeSizes } from '../../theme/tokens';
import CrosshairCorners from '../layout/CrosshairCorners';
import ProgressBar from './ProgressBar';
import ActiveEdge from './ActiveEdge';
import { ROW_PADDING } from './SplitRow';
import { useCountUp } from '../../hooks/useCountUp';

interface DataRowProps {
  label: string;
  labelSuffix?: ReactNode;
  metaStatus?: string;
  /** Fallback / placeholder / error string shown when no numeric value is set. */
  value: string;
  unit: string;
  /** Numeric target for the count-up numeral. When finite, it animates (and
   *  `value` is ignored); otherwise `value` renders verbatim. */
  numericValue?: number;
  /** Formatter for the count-up numeral (defaults to `String(rounded)`). */
  format?: (n: number) => string;
  isActive?: boolean;
  showProgress?: boolean;
  /** Unknown-duration progress (no percent yet) → shimmer instead of a fill. */
  indeterminate?: boolean;
  progress?: number;
  isLast?: boolean;
  isSmall?: boolean; // smaller number for ping/jitter
  isGlitch?: boolean;
  glitchColor?: string;
  children?: ReactNode; // for breakdown text / meter below value
  diagnostics?: ReactNode;
}

export default function DataRow({
  label,
  labelSuffix,
  metaStatus,
  value,
  unit,
  numericValue,
  format,
  isActive,
  showProgress,
  indeterminate,
  progress = 0,
  isLast,
  isSmall,
  isGlitch,
  glitchColor,
  children,
  diagnostics,
}: DataRowProps) {
  const useCount = typeof numericValue === 'number' && Number.isFinite(numericValue);
  // Hook runs unconditionally (stable order); the ref only binds when counting.
  const countRef = useCountUp<HTMLSpanElement>(useCount ? (numericValue as number) : 0, {
    format: format ?? ((n) => String(Math.round(n))),
  });

  const rowStyle: CSSProperties = {
    flex: 1,
    borderBottom: isLast ? 'none' : borders.stroke,
    padding: ROW_PADDING,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
    transition: 'background-color 0.3s ease',
    backgroundColor: isActive ? colors.paper : 'transparent',
  };

  // All readouts use the instrument voice (IBM Plex Mono — genuinely monospaced,
  // so count-ups don't jitter). Large = hero scale; small = ping/jitter scale.
  const numberStyle: CSSProperties = isSmall
    ? { ...textStyles.instrumentNumber }
    : { ...textStyles.instrumentNumber, fontSize: typeSizes.hero, lineHeight: 0.85 };

  if (isGlitch) {
    numberStyle.color = glitchColor || colors.error;
  }

  return (
    <div style={rowStyle}>
      <ActiveEdge active={!!isActive} />
      <CrosshairCorners />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
        <span style={textStyles.microLabel}>{label}{labelSuffix}</span>
        {metaStatus && (
          <span style={{
            ...textStyles.metricValue,
            color: metaStatus === 'FAILED' || metaStatus === 'TIMEOUT' || metaStatus === 'OFFLINE'
              ? colors.error : colors.ink,
          }}>
            {metaStatus}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        {useCount
          ? <span ref={countRef} style={numberStyle} />
          : <span style={numberStyle}>{value}</span>}
        <span style={{ ...textStyles.unit, fontSize: typeSizes.unit }}>{unit}</span>
      </div>
      {children}
      <ProgressBar progress={progress} visible={!!showProgress} indeterminate={indeterminate} />
      {diagnostics}
    </div>
  );
}
