import type { CSSProperties, ReactNode } from 'react';
import { colors, borders, typography } from '../../theme/tokens';
import { responsive } from '../../theme/responsive';
import { useResponsive } from '../../hooks/useResponsive';
import CrosshairCorners from '../layout/CrosshairCorners';
import ProgressBar from './ProgressBar';

interface DataRowProps {
  label: string;
  metaStatus?: string;
  value: string;
  unit: string;
  isActive?: boolean;
  showProgress?: boolean;
  progress?: number;
  isLast?: boolean;
  isSmall?: boolean; // smaller number for ping/jitter
  isGlitch?: boolean;
  glitchColor?: string;
  children?: ReactNode; // for breakdown text below value
  diagnostics?: ReactNode;
}

export default function DataRow({
  label,
  metaStatus,
  value,
  unit,
  isActive,
  showProgress,
  progress = 0,
  isLast,
  isSmall,
  isGlitch,
  glitchColor,
  children,
  diagnostics,
}: DataRowProps) {
  const { breakpoint } = useResponsive();
  const r = responsive[breakpoint];

  const rowStyle: CSSProperties = {
    flex: 1,
    borderBottom: isLast ? 'none' : borders.stroke,
    padding: r.dataRowPadding,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
    transition: 'background-color 0.3s ease',
    backgroundColor: isActive ? colors.paper : 'transparent',
  };

  const numberStyle: CSSProperties = isSmall
    ? { ...typography.numberMedium, fontSize: r.numberMedium }
    : { ...typography.numberLarge, fontSize: r.numberLarge };

  if (isGlitch) {
    numberStyle.color = glitchColor || colors.error;
  }

  return (
    <div style={rowStyle}>
      <CrosshairCorners />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
        <span style={typography.metaLabel}>{label}</span>
        {metaStatus && (
          <span style={{
            ...typography.metaValue,
            color: metaStatus === 'FAILED' || metaStatus === 'TIMEOUT' || metaStatus === 'OFFLINE'
              ? colors.error : colors.ink,
          }}>
            {metaStatus}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={numberStyle}>{value}</span>
        <span style={{ ...typography.unit, fontSize: r.unit }}>{unit}</span>
      </div>
      {children}
      <ProgressBar progress={progress} visible={!!showProgress} />
      {diagnostics}
    </div>
  );
}
