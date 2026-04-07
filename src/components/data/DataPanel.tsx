import type { TestPhase, SpeedTestProgress, SpeedTestResult, SpeedUnit, DnsCheckResult, BufferbloatGrade, AimScoreEntry } from '../../types/speedtest';
import { formatSpeed } from '../../types/speedtest';
import SplitRow from './SplitRow';
import DataRow from './DataRow';
import DnsBar from './DnsBar';
import PretextBlock from '../ui/PretextBlock';
import Tooltip from '../ui/Tooltip';
import { typography, borders } from '../../theme/tokens';
import { responsive } from '../../theme/responsive';
import { useResponsive } from '../../hooks/useResponsive';

interface DataPanelProps {
  phase: TestPhase;
  progress: SpeedTestProgress;
  result: SpeedTestResult | null;
  speedUnit: SpeedUnit;
  dnsCheck: DnsCheckResult | null;
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

export default function DataPanel({ phase, progress, result, speedUnit, dnsCheck }: DataPanelProps) {
  const { breakpoint, isMobile, isSmallDesktop } = useResponsive();
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

  // New accuracy metrics
  const latencyStats = isComplete && result?.latencyStats ? result.latencyStats : null;
  const bufferbloat = isComplete && result?.bufferbloat ? result.bufferbloat : null;
  const stability = isComplete && result?.stability ? result.stability : null;
  const divergence = isComplete && result?.providerDivergence ? result.providerDivergence : null;
  const aimScores = isComplete && result?.aimScores ? result.aimScores : null;

  const breakdownStyle = {
    fontSize: '0.7rem',
    opacity: 0.5,
    marginTop: '0.25rem',
    letterSpacing: '0.05em',
  };

  const badgeBase: React.CSSProperties = {
    display: 'inline-block',
    fontSize: '0.55rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    marginLeft: '0.5rem',
    verticalAlign: 'middle',
  };

  const avgBadge = breakdown ? (
    <Tooltip tooltipKey="avg" variant="badge">
      <span style={{ ...badgeBase, backgroundColor: '#111111', color: '#ffffff' }}>
        AVG
      </span>
    </Tooltip>
  ) : null;

  function bufferbloatColor(grade: BufferbloatGrade): string {
    switch (grade) {
      case 'A': return '#22c55e';
      case 'B': return '#84cc16';
      case 'C': return '#eab308';
      case 'D': return '#f97316';
      case 'F': return '#ef4444';
    }
  }

  if (isError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
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
        <DnsBar dnsCheck={dnsCheck} phase={phase} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
      {/* Ping / Jitter */}
      <SplitRow isActive={phase === 'latency' || phase === 'discovering'}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={typography.metaLabel}>PING</span>
          </div>
          <PretextBlock
            entryId={`speed-medium-${breakpoint}`}
            style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}
          >
            <span style={{ ...typography.numberMedium, fontSize: r.numberMedium }}>{pingVal}</span>
            <span style={{ ...typography.unit, fontSize: r.unit }}>ms</span>
          </PretextBlock>
          {latencyStats && (
            <div style={breakdownStyle}>
              <Tooltip tooltipKey="p50" value={latencyStats.p50}>P50: {latencyStats.p50.toFixed(0)}</Tooltip>
              {' \u2022 '}
              <Tooltip tooltipKey="p95" value={latencyStats.p95}>P95: {latencyStats.p95.toFixed(0)}</Tooltip>
              {' \u2022 '}
              <Tooltip tooltipKey="p99" value={latencyStats.p99}>P99: {latencyStats.p99.toFixed(0)}</Tooltip>
            </div>
          )}
          {!latencyStats && breakdown && cfResult && ndtResult && (
            <div style={breakdownStyle}>
              <Tooltip tooltipKey="cf">CF: {cfResult.ping.toFixed(0)}</Tooltip>
              {' \u2022 '}
              <Tooltip tooltipKey="ndt">NDT: {ndtResult.ping.toFixed(0)}</Tooltip>
            </div>
          )}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={typography.metaLabel}>JITTER</span>
            <Tooltip tooltipKey="rfc3550" variant="badge">
              <span style={{ ...typography.metaLabel, opacity: 0.4, fontSize: '0.5rem' }}>RFC 3550</span>
            </Tooltip>
          </div>
          <PretextBlock
            entryId={`speed-medium-${breakpoint}`}
            style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}
          >
            <span style={{ ...typography.numberMedium, fontSize: r.numberMedium }}>{jitterVal}</span>
            <span style={{ ...typography.unit, fontSize: r.unit }}>ms</span>
          </PretextBlock>
          {latencyStats && (
            <div style={breakdownStyle}>
              <Tooltip tooltipKey="samples" value={latencyStats.samples.length}>{latencyStats.samples.length} samples</Tooltip>
              {' \u2022 '}
              <Tooltip tooltipKey="stddev" value={latencyStats.stddev}>stddev: {latencyStats.stddev.toFixed(1)}</Tooltip>
            </div>
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
            <Tooltip tooltipKey="cf">CF: {formatSpeed(cfResult.downloadSpeed, speedUnit).value}</Tooltip>
            {' \u2022 '}
            <Tooltip tooltipKey="ndt">NDT: {formatSpeed(ndtResult.downloadSpeed, speedUnit).value}</Tooltip>
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
            <Tooltip tooltipKey="cf">CF: {formatSpeed(cfResult.uploadSpeed, speedUnit).value}</Tooltip>
            {' \u2022 '}
            <Tooltip tooltipKey="ndt">NDT: {formatSpeed(ndtResult.uploadSpeed, speedUnit).value}</Tooltip>
          </div>
        )}
      </DataRow>

      {/* Accuracy Metrics Bar — AIM scores, bufferbloat, stability, divergence */}
      {isComplete && (aimScores || bufferbloat || stability || divergence?.significant) && (
        <div style={{
          flex: 'none',
          borderBottom: borders.stroke,
          padding: isMobile ? '0.5rem 1.5rem' : isSmallDesktop ? '0.6rem 2rem' : '0.6rem 3rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          {aimScores && Object.entries(aimScores).map(([key, score]) => (
            <span key={key} style={{
              ...badgeBase,
              marginLeft: 0,
              backgroundColor: score.classificationIdx >= 3 ? '#22c55e'
                : score.classificationIdx >= 2 ? '#eab308'
                : '#ef4444',
              color: '#fff',
              fontSize: '0.55rem',
            }}>
              {key.toUpperCase()}: {score.classificationName.toUpperCase()}
            </span>
          ))}
          {bufferbloat && (
            <Tooltip tooltipKey="bufferbloat" variant="badge" value={Math.max(bufferbloat.downloadRatio, bufferbloat.uploadRatio)}>
              <span style={{
                ...badgeBase,
                marginLeft: 0,
                backgroundColor: bufferbloatColor(bufferbloat.grade),
                color: '#fff',
                fontSize: '0.6rem',
              }}>
                BUFFERBLOAT: {bufferbloat.grade}
              </span>
            </Tooltip>
          )}
          {bufferbloat && (
            <Tooltip tooltipKey="bufferbloatRatio" value={Math.max(bufferbloat.downloadRatio, bufferbloat.uploadRatio)}>
              <span style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: '0.05em' }}>
                DL {bufferbloat.downloadRatio.toFixed(1)}x / UL {bufferbloat.uploadRatio.toFixed(1)}x
              </span>
            </Tooltip>
          )}
          {stability && (
            <Tooltip tooltipKey="stable" variant="badge">
              <span style={{
                ...badgeBase,
                marginLeft: 0,
                backgroundColor: stability.downloadStable && stability.uploadStable ? '#22c55e' : '#eab308',
                color: '#fff',
                fontSize: '0.6rem',
              }}>
                {stability.downloadStable && stability.uploadStable ? 'STABLE' : 'VARIABLE'}
              </span>
            </Tooltip>
          )}
          {stability && (
            <Tooltip tooltipKey="cv" value={Math.max(stability.downloadCV, stability.uploadCV) * 100}>
              <span style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: '0.05em' }}>
                CV: DL {(stability.downloadCV * 100).toFixed(0)}% / UL {(stability.uploadCV * 100).toFixed(0)}%
              </span>
            </Tooltip>
          )}
          {divergence?.significant && (
            <Tooltip tooltipKey="divergence" variant="badge" value={Math.max(divergence.download, divergence.upload) * 100}>
              <span style={{
                ...badgeBase,
                marginLeft: 0,
                backgroundColor: '#f97316',
                color: '#fff',
                fontSize: '0.6rem',
              }}>
                DIVERGENCE
              </span>
            </Tooltip>
          )}
          {divergence?.significant && (
            <Tooltip tooltipKey="divergence" value={Math.max(divergence.download, divergence.upload) * 100}>
              <span style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: '0.05em' }}>
                DL {(divergence.download * 100).toFixed(0)}% / UL {(divergence.upload * 100).toFixed(0)}%
              </span>
            </Tooltip>
          )}
        </div>
      )}

      {/* DNS Connectivity */}
      <DnsBar dnsCheck={dnsCheck} phase={phase} />
    </div>
  );
}
