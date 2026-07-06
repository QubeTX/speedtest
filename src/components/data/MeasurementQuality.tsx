import { useState, type CSSProperties } from 'react';
import type { SpeedTestResult, SpeedUnit, AgreementBand } from '../../types/speedtest';
import { formatSpeed } from '../../types/speedtest';
import { colors, borders, textStyles } from '../../theme/tokens';
import Tooltip from '../ui/Tooltip';

interface MeasurementQualityProps {
  result: SpeedTestResult;
  speedUnit: SpeedUnit;
}

const BAND_LABEL: Record<AgreementBand, string> = {
  high: 'HIGH',
  moderate: 'MODERATE',
  low: 'LOW',
  'very-low': 'VERY LOW',
  insufficient: 'N/A',
};

/** Low / very-low agreement is the caution case → filled ink pill stands out
 *  in the monochrome palette; the rest read as calm outlined pills. */
function bandChipStyle(band: AgreementBand): CSSProperties {
  const caution = band === 'low' || band === 'very-low';
  return {
    ...textStyles.microLabel,
    fontSize: '0.5rem',
    letterSpacing: '0.1em',
    padding: '0.12rem 0.4rem',
    borderRadius: borders.radiusPill,
    border: `1.5px solid ${colors.ink}`,
    backgroundColor: caution ? colors.ink : 'transparent',
    color: caution ? colors.paper : colors.ink,
    opacity: band === 'insufficient' ? 0.4 : 1,
    whiteSpace: 'nowrap',
  };
}

const chipStyle: CSSProperties = {
  ...textStyles.microLabel,
  fontSize: '0.5rem',
  letterSpacing: '0.12em',
  padding: '0.12rem 0.4rem',
  borderRadius: '4px',
  border: `1px solid rgba(17,17,17,0.25)`,
  opacity: 0.65,
  whiteSpace: 'nowrap',
};

export default function MeasurementQuality({ result, speedUnit }: MeasurementQualityProps) {
  const [open, setOpen] = useState(false);

  const consensus = result.consensusMbps;
  const agreement = result.agreement;
  const stability = result.stability;
  const methodology = result.methodologyVersion ? `SQX-${result.methodologyVersion}` : null;
  const band = agreement?.band ?? 'insufficient';

  const labelStyle: CSSProperties = { ...textStyles.microLabel, fontSize: '0.55rem', opacity: 0.55 };
  const valueStyle: CSSProperties = { ...textStyles.metricValue, fontSize: '0.75rem' };
  const detailStyle: CSSProperties = { ...textStyles.metricValue, fontSize: '0.6rem', opacity: 0.45 };

  const rows: { key: string; label: string; node: React.ReactNode }[] = [];

  if (consensus) {
    rows.push({
      key: 'consensus',
      label: 'CONSENSUS',
      node: (
        <Tooltip tooltipKey="consensus">
          <span style={valueStyle}>
            DL {formatSpeed(consensus.download, speedUnit).value} / UL {formatSpeed(consensus.upload, speedUnit).value}
          </span>
        </Tooltip>
      ),
    });
  }
  if (agreement) {
    rows.push({
      key: 'agreement',
      label: 'AGREEMENT',
      node: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tooltip tooltipKey="agreement" variant="badge" value={agreement.i2 != null ? agreement.i2 * 100 : undefined}>
            <span style={bandChipStyle(band)}>{BAND_LABEL[band]}</span>
          </Tooltip>
          {agreement.i2 != null && <span style={detailStyle}>I² {(agreement.i2 * 100).toFixed(0)}%</span>}
        </span>
      ),
    });
  }
  if (stability) {
    rows.push({
      key: 'stability',
      label: 'STABILITY',
      node: (
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
          <Tooltip tooltipKey="stable" variant="badge">
            <span style={valueStyle}>{stability.downloadStable && stability.uploadStable ? 'STABLE' : 'VARIABLE'}</span>
          </Tooltip>
          <Tooltip tooltipKey="cv" value={Math.max(stability.downloadCV, stability.uploadCV) * 100}>
            <span style={detailStyle}>DL {(stability.downloadCV * 100).toFixed(0)}% / UL {(stability.uploadCV * 100).toFixed(0)}%</span>
          </Tooltip>
        </span>
      ),
    });
  }
  if (result.packetLoss != null) {
    rows.push({
      key: 'packetLoss',
      label: 'PACKET LOSS',
      node: (
        <Tooltip tooltipKey="packetLoss" value={result.packetLoss}>
          <span style={valueStyle}>{result.packetLoss.toFixed(1)}%</span>
        </Tooltip>
      ),
    });
  }

  if (rows.length === 0 && !methodology) return null;

  return (
    <div style={{ flex: 'none', borderBottom: borders.stroke }}>
      <button
        type="button"
        className="focus-ring"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          all: 'unset',
          boxSizing: 'border-box',
          width: '100%',
          cursor: 'pointer',
          padding: '0.7rem clamp(1.5rem, 3vw, 3rem)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ ...textStyles.microLabel, fontSize: '0.6rem' }}>MEASUREMENT QUALITY</span>
          <span style={{ ...detailStyle, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}>&#9656;</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={bandChipStyle(band)}>{BAND_LABEL[band]}</span>
          {methodology && (
            <Tooltip tooltipKey="methodologyVersion" variant="badge">
              <span style={chipStyle}>{methodology}</span>
            </Tooltip>
          )}
        </span>
      </button>
      <div style={{
        maxHeight: open ? '260px' : '0',
        overflow: 'hidden',
        opacity: open ? 1 : 0,
        transition: 'max-height 0.3s ease, opacity 0.3s ease',
      }}>
        <div style={{
          padding: '0 clamp(1.5rem, 3vw, 3rem) 0.8rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
              <span style={labelStyle}>{r.label}</span>
              <span style={{ textAlign: 'right' }}>{r.node}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
