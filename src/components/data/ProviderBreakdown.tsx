import { useState, type CSSProperties } from 'react';
import type { SpeedTestResult, SpeedUnit, ProviderRunResult, ProviderAvailability } from '../../types/speedtest';
import { formatSpeed } from '../../types/speedtest';
import { colors, borders, textStyles } from '../../theme/tokens';

interface ProviderBreakdownProps {
  result: SpeedTestResult;
  speedUnit: SpeedUnit;
}

function dotColor(a: ProviderAvailability): string {
  if (a === 'ran') return '#22c55e';
  if (a === 'failed') return colors.error;
  return 'rgba(17,17,17,0.2)'; // unavailable-platform
}

function speedCell(mbps: number | null, unit: SpeedUnit): string {
  if (mbps == null || !(mbps > 0)) return '—';
  return formatSpeed(mbps, unit).value;
}

export default function ProviderBreakdown({ result, speedUnit }: ProviderBreakdownProps) {
  const [open, setOpen] = useState(false);
  const providers = result.providers ?? [];
  if (providers.length === 0) return null;

  const ranCount = providers.filter((p) => p.availability === 'ran').length;
  const exclusions = result.mergeExclusions ?? [];

  const labelStyle: CSSProperties = { ...textStyles.microLabel, fontSize: '0.55rem', opacity: 0.55 };
  const detailStyle: CSSProperties = { ...textStyles.metricValue, fontSize: '0.6rem', opacity: 0.45 };

  const rowFor = (p: ProviderRunResult) => {
    const greyed = p.availability !== 'ran';
    const statusText = p.availability === 'failed'
      ? (p.error ? 'FAILED' : 'FAILED')
      : p.availability === 'unavailable-platform'
        ? 'CLI ONLY'
        : null;
    return (
      <div key={p.provider} style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: '0.5rem',
        opacity: greyed ? 0.4 : 1,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: dotColor(p.availability),
          border: p.availability === 'unavailable-platform' ? `1px solid rgba(17,17,17,0.3)` : 'none',
          flexShrink: 0,
        }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ ...textStyles.metricValue, fontSize: '0.72rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name}
          </span>
          {p.server && (
            <span style={{ ...detailStyle, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.server}
            </span>
          )}
        </span>
        <span style={{ ...textStyles.metricValue, fontSize: '0.68rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {statusText
            ? <span style={{ opacity: 0.7 }}>{statusText}</span>
            : <>DL {speedCell(p.downloadMbps, speedUnit)} / UL {speedCell(p.uploadMbps, speedUnit)}</>}
        </span>
      </div>
    );
  };

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
          <span style={{ ...textStyles.microLabel, fontSize: '0.6rem' }}>SOURCES</span>
          <span style={{ ...detailStyle, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}>&#9656;</span>
        </span>
        <span style={detailStyle}>{ranCount}/{providers.length} RAN</span>
      </button>
      <div style={{
        maxHeight: open ? '520px' : '0',
        overflow: 'hidden',
        opacity: open ? 1 : 0,
        transition: 'max-height 0.35s ease, opacity 0.3s ease',
      }}>
        <div style={{ padding: '0 clamp(1.5rem, 3vw, 3rem) 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {providers.map(rowFor)}
          {exclusions.length > 0 && (
            <div style={{ marginTop: '0.35rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(17,17,17,0.08)' }}>
              <span style={{ ...labelStyle, display: 'block', marginBottom: '0.2rem' }}>EXCLUDED FROM MERGE</span>
              <span style={{ ...detailStyle }}>
                {exclusions.map((e, i) => (
                  <span key={`${e.provider}-${e.direction}`}>
                    {i > 0 ? ' · ' : ''}{e.provider} ({e.direction}, {e.samples} sample{e.samples === 1 ? '' : 's'})
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
