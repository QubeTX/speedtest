import type { TestPhase, SpeedTestProgress, SpeedTestResult, SpeedUnit } from '../../types/speedtest';
import { formatSpeed } from '../../types/speedtest';
import SplitRow from './SplitRow';
import DataRow from './DataRow';
import { typography } from '../../theme/tokens';
import { responsive } from '../../theme/responsive';
import { useResponsive } from '../../hooks/useResponsive';

interface DataPanelProps {
  phase: TestPhase;
  progress: SpeedTestProgress;
  result: SpeedTestResult | null;
  speedUnit: SpeedUnit;
}

function metaFor(phase: TestPhase, rowPhase: 'latency' | 'download' | 'upload', complete: boolean): string {
  if (phase === 'error') return '';
  if (complete) return 'FINAL';
  if (phase === 'idle') return 'IDLE';
  if (phase === rowPhase || (rowPhase === 'latency' && phase === 'latency')) return 'ACTIVE';
  if (phase === 'discovering') return 'WAITING';
  const order = ['latency', 'download', 'upload'];
  const current = order.indexOf(phase);
  const row = order.indexOf(rowPhase);
  if (current > row) return 'COMPLETE';
  return 'WAITING';
}

export default function DataPanel({ phase, progress, result, speedUnit }: DataPanelProps) {
  const { breakpoint } = useResponsive();
  const r = responsive[breakpoint];
  const isComplete = phase === 'complete';
  const isError = phase === 'error';

  // Display values
  const pingVal = isComplete && result
    ? result.ping.toFixed(0)
    : progress.ping !== null ? progress.ping.toFixed(0) : '--';

  const jitterVal = isComplete && result
    ? result.jitter.toFixed(0)
    : progress.jitter !== null ? progress.jitter.toFixed(0) : '--';

  const dlRaw = isComplete && result ? result.downloadSpeed : progress.downloadSpeed;
  const ulRaw = isComplete && result ? result.uploadSpeed : progress.uploadSpeed;
  const dl = dlRaw !== null ? formatSpeed(dlRaw, speedUnit) : { value: '---', unit: 'Mbps' };
  const ul = ulRaw !== null ? formatSpeed(ulRaw, speedUnit) : { value: '---', unit: 'Mbps' };

  const dlMeta = metaFor(phase, 'download', isComplete);
  const ulMeta = metaFor(phase, 'upload', isComplete);

  // Aggregated breakdown
  const breakdown = isComplete && result?.providerResults ? result.providerResults : null;
  const cfResult = breakdown?.cloudflare;
  const ndtResult = breakdown?.ndt7;

  const breakdownStyle = {
    fontSize: '0.7rem',
    opacity: 0.5,
    marginTop: '0.5rem',
    letterSpacing: '0.05em',
  };

  const avgBadge = breakdown ? (
    <span style={{
      display: 'inline-block',
      fontSize: '0.55rem',
      fontWeight: 700,
      letterSpacing: '0.1em',
      backgroundColor: '#111111',
      color: '#ffffff',
      padding: '0.15rem 0.4rem',
      borderRadius: '4px',
      marginLeft: '0.5rem',
      verticalAlign: 'middle',
    }}>
      AVG
    </span>
  ) : null;

  if (isError) {
    return (
      <>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.05) 50%), linear-gradient(90deg, rgba(255,0,0,0.02), rgba(0,255,0,0.01), rgba(0,0,255,0.02))', backgroundSize: '100% 4px, 3px 100%', pointerEvents: 'none', zIndex: 5 }} />
        <DataRow label="LATENCY_BUFFER" metaStatus="FAILED" value="NO SIGNAL" unit="" isGlitch />
        <DataRow label="RX_DOWNLINK" metaStatus="TIMEOUT" value="NO SIGNAL" unit="" isGlitch
          diagnostics={
            <div style={{ marginTop: '1rem', fontSize: '0.75rem', lineHeight: 1.6, borderTop: '1px solid #111', paddingTop: '0.75rem', fontFamily: 'monospace' }}>
              [SYSTEM_DIAGNOSTICS]<br />
              &gt; {progress.error || 'Connection failed'}<br />
              &gt; Check network connectivity
            </div>
          }
        />
        <DataRow label="TX_UPLINK" metaStatus="OFFLINE" value="NO SIGNAL" unit="" isLast isGlitch />
      </>
    );
  }

  return (
    <>
      {/* Ping / Jitter */}
      <SplitRow isActive={phase === 'latency' || phase === 'discovering'}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={typography.metaLabel}>PING</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ ...typography.numberMedium, fontSize: r.numberMedium }}>{pingVal}</span>
            <span style={{ ...typography.unit, fontSize: r.unit }}>ms</span>
          </div>
          {breakdown && cfResult && ndtResult && (
            <div style={breakdownStyle}>CF: {cfResult.ping.toFixed(0)} • NDT: {ndtResult.ping.toFixed(0)}</div>
          )}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={typography.metaLabel}>JITTER</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ ...typography.numberMedium, fontSize: r.numberMedium }}>{jitterVal}</span>
            <span style={{ ...typography.unit, fontSize: r.unit }}>ms</span>
          </div>
          {breakdown && cfResult && (
            <div style={breakdownStyle}>CF: {cfResult.jitter.toFixed(0)}</div>
          )}
        </div>
      </SplitRow>

      {/* Download */}
      <DataRow
        label="DOWNLOAD SPEED"
        labelSuffix={avgBadge}
        metaStatus={dlMeta}
        value={dl.value}
        unit={dl.unit}
        isActive={phase === 'download'}
        showProgress={phase === 'download'}
        progress={progress.downloadProgress}
      >
        {breakdown && cfResult && ndtResult && (
          <div style={breakdownStyle}>
            CF: {formatSpeed(cfResult.downloadSpeed, speedUnit).value} • NDT: {formatSpeed(ndtResult.downloadSpeed, speedUnit).value}
          </div>
        )}
      </DataRow>

      {/* Upload */}
      <DataRow
        label="UPLOAD SPEED"
        labelSuffix={avgBadge}
        metaStatus={ulMeta}
        value={ul.value}
        unit={ul.unit}
        isActive={phase === 'upload'}
        showProgress={phase === 'upload'}
        progress={progress.uploadProgress}
        isLast
      >
        {breakdown && cfResult && ndtResult && (
          <div style={breakdownStyle}>
            CF: {formatSpeed(cfResult.uploadSpeed, speedUnit).value} • NDT: {formatSpeed(ndtResult.uploadSpeed, speedUnit).value}
          </div>
        )}
      </DataRow>
    </>
  );
}
