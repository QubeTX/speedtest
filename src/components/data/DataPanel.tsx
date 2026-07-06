import type { CSSProperties, ReactNode } from 'react';
import type { TestPhase, SpeedTestProgress, SpeedTestResult, SpeedUnit, DnsCheckResult, BandwidthCi, AgreementBand } from '../../types/speedtest';
import { formatSpeed } from '../../types/speedtest';
import SplitRow, { ROW_PADDING } from './SplitRow';
import DataRow from './DataRow';
import DnsBar from './DnsBar';
import Tooltip from '../ui/Tooltip';
import VuMeter from './VuMeter';
import MeasurementQuality from './MeasurementQuality';
import ProviderBreakdown from './ProviderBreakdown';
import CRTOverlay from '../effects/CRTOverlay';
import { borders, textStyles, typeSizes } from '../../theme/tokens';
import { useCountUp } from '../../hooks/useCountUp';

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

/** Lock a speed formatter to the final value's unit so a live count-up never
 *  flips units (e.g. Mbps → Kbps) while ramping up from zero. */
function speedFormatter(finalMbps: number, unit: SpeedUnit): { unit: string; format: (n: number) => string } {
  const final = formatSpeed(finalMbps, unit);
  const lockedUnit = final.unit as SpeedUnit;
  return { unit: final.unit, format: (n) => formatSpeed(n, lockedUnit).value };
}

export default function DataPanel({ phase, progress, result, speedUnit, dnsCheck }: DataPanelProps) {
  const isComplete = phase === 'complete';
  const isError = phase === 'error';

  // Headline numeric values (null → placeholder, no count-up).
  const pingNum = isComplete && result ? result.ping : progress.ping;
  const jitterNum = isComplete && result ? result.jitter : progress.jitter;
  const dlNum = isComplete && result ? result.downloadSpeed : progress.downloadSpeed;
  const ulNum = isComplete && result ? result.uploadSpeed : progress.uploadSpeed;

  // Count-up refs (hooks run unconditionally; refs bind only when numeric).
  const pingRef = useCountUp<HTMLSpanElement>(pingNum ?? 0, { format: (n) => n.toFixed(0) });
  const jitterRef = useCountUp<HTMLSpanElement>(jitterNum ?? 0, { format: (n) => n.toFixed(0) });

  const dlFmt = dlNum != null ? speedFormatter(dlNum, speedUnit) : null;
  const ulFmt = ulNum != null ? speedFormatter(ulNum, speedUnit) : null;

  const dlMeta = metaFor(phase, 'download', isComplete);
  const ulMeta = metaFor(phase, 'upload', isComplete);

  const latencyStats = isComplete && result?.latencyStats ? result.latencyStats : null;
  const bufferbloat = isComplete && result?.bufferbloat ? result.bufferbloat : null;

  const currentSpeed = phase === 'download'
    ? (progress.downloadSpeed ?? 0)
    : phase === 'upload'
      ? (progress.uploadSpeed ?? 0)
      : 0;

  const numMedium: CSSProperties = textStyles.instrumentNumber;
  const unitStyle: CSSProperties = { ...textStyles.unit, fontSize: typeSizes.unit };
  const breakdownStyle: CSSProperties = { ...textStyles.metricValue, fontSize: '0.62rem', opacity: 0.5, marginTop: '0.3rem' };
  const ciStyle: CSSProperties = { ...textStyles.metricValue, fontSize: '0.7rem', opacity: 0.5, marginTop: '0.35rem' };

  // ── Confidence interval (±X, or an honest clamped range when very wide) ──
  const dlCi = result?.capacityMbps?.downloadCi ?? result?.confidenceIntervals?.download;
  const ulCi = result?.capacityMbps?.uploadCi ?? result?.confidenceIntervals?.upload;

  const renderCi = (
    value: number | null,
    ci: BandwidthCi | undefined,
    fmt: { unit: string; format: (n: number) => string } | null,
    band: AgreementBand | undefined,
  ): ReactNode => {
    if (value == null || !ci || !fmt) return null;
    const lower = Math.max(0, ci.lower);
    const upper = Math.max(lower, ci.upper);
    const margin = (upper - lower) / 2;
    // Speed can't be negative, so a "±X" that implies a negative floor is
    // misleading. Very-low agreement (METHODOLOGY.md §6) or an interval wider
    // than the value itself → show the honest clamped range instead.
    const wide = band === 'very-low' || margin >= value;
    return (
      <div style={ciStyle}>
        <Tooltip tooltipKey="confidenceInterval">
          {wide
            ? <>95% CI {fmt.format(lower)}&ndash;{fmt.format(upper)} {fmt.unit}</>
            : <>&plusmn;{fmt.format(margin)} {fmt.unit} (95% CI)</>}
        </Tooltip>
      </div>
    );
  };

  if (isError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        <CRTOverlay />
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

  const latencyActive = phase === 'latency' || phase === 'discovering';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
      {/* Ping / Jitter */}
      <SplitRow isActive={latencyActive}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '1.5rem', marginBottom: '0.5rem' }}>
            <Tooltip tooltipKey="minRtt" variant="badge"><span style={textStyles.microLabel}>PING</span></Tooltip>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            {pingNum != null
              ? <span ref={pingRef} style={numMedium} />
              : <span style={numMedium}>--</span>}
            <span style={unitStyle}>ms</span>
          </div>
          {latencyStats && (
            <div style={breakdownStyle}>
              <Tooltip tooltipKey="p50" value={latencyStats.p50}>P50 {latencyStats.p50.toFixed(0)}</Tooltip>
              {' • '}
              <Tooltip tooltipKey="p95" value={latencyStats.p95}>P95 {latencyStats.p95.toFixed(0)}</Tooltip>
              {' • '}
              <Tooltip tooltipKey="p99" value={latencyStats.p99}>P99 {latencyStats.p99.toFixed(0)}</Tooltip>
            </div>
          )}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '1.5rem', marginBottom: '0.5rem' }}>
            <span style={textStyles.microLabel}>JITTER</span>
            <Tooltip tooltipKey="pdv" variant="badge">
              <span style={{ ...textStyles.microLabel, opacity: 0.4, fontSize: '0.5rem' }}>PDV</span>
            </Tooltip>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            {jitterNum != null
              ? <span ref={jitterRef} style={numMedium} />
              : <span style={numMedium}>--</span>}
            <span style={unitStyle}>ms</span>
          </div>
          {latencyStats && (
            <div style={breakdownStyle}>
              <Tooltip tooltipKey="samples" value={latencyStats.samples.length}>{latencyStats.samples.length} samples</Tooltip>
              {' • '}
              <Tooltip tooltipKey="stddev" value={latencyStats.stddev}>&sigma; {latencyStats.stddev.toFixed(1)}</Tooltip>
              {typeof latencyStats.jitterRfc3550 === 'number' && (
                <>
                  {' • '}
                  <Tooltip tooltipKey="rfc3550">RFC3550 {latencyStats.jitterRfc3550.toFixed(1)}</Tooltip>
                </>
              )}
            </div>
          )}
        </div>
      </SplitRow>

      {/* Download */}
      <DataRow
        label="DOWNLOAD SPEED"
        metaStatus={dlMeta}
        value={dlFmt && dlNum != null ? dlFmt.format(dlNum) : '---'}
        unit={dlFmt?.unit ?? 'Mbps'}
        numericValue={dlNum ?? undefined}
        format={dlFmt?.format}
        isActive={phase === 'download'}
        showProgress={phase === 'download'}
        progress={progress.downloadProgress}
      >
        {phase === 'download' && (
          <VuMeter mbps={currentSpeed} style={{ marginTop: '0.6rem' }} />
        )}
        {isComplete && renderCi(dlNum, dlCi, dlFmt, result?.agreement?.band)}
      </DataRow>

      {/* Upload */}
      <DataRow
        label="UPLOAD SPEED"
        metaStatus={ulMeta}
        value={ulFmt && ulNum != null ? ulFmt.format(ulNum) : '---'}
        unit={ulFmt?.unit ?? 'Mbps'}
        numericValue={ulNum ?? undefined}
        format={ulFmt?.format}
        isActive={phase === 'upload'}
        showProgress={phase === 'upload'}
        progress={progress.uploadProgress}
        isLast={!isComplete}
      >
        {phase === 'upload' && (
          <VuMeter mbps={currentSpeed} style={{ marginTop: '0.6rem' }} />
        )}
        {isComplete && renderCi(ulNum, ulCi, ulFmt, result?.uploadAgreement?.band)}
      </DataRow>

      {/* Accuracy row — Responsiveness (RPM) + Bufferbloat (delta-ms) */}
      {isComplete && result && ((typeof result.rpm === 'number' && result.rpm > 0) || bufferbloat) && (
        <div style={{
          flex: 'none',
          borderBottom: borders.stroke,
          padding: ROW_PADDING,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
        }}>
          <div>
            <Tooltip tooltipKey="rpm" variant="badge">
              <span style={{ ...textStyles.microLabel, fontSize: '0.55rem', display: 'block', marginBottom: '0.25rem', opacity: 0.7 }}>RESPONSIVENESS</span>
            </Tooltip>
            {typeof result.rpm === 'number' && result.rpm > 0 ? (
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span style={{ ...textStyles.metricValue, fontSize: '1rem' }}>{result.rpm.toFixed(0)}</span>
                <span style={{ ...textStyles.unit, fontSize: '0.7rem' }}>RPM</span>
              </span>
            ) : <span style={{ ...textStyles.metricValue, fontSize: '1rem', opacity: 0.4 }}>—</span>}
          </div>
          <div>
            <Tooltip tooltipKey="bufferbloatDelta" variant="badge" value={bufferbloat?.deltaMs}>
              <span style={{ ...textStyles.microLabel, fontSize: '0.55rem', display: 'block', marginBottom: '0.25rem', opacity: 0.7 }}>BUFFERBLOAT</span>
            </Tooltip>
            {bufferbloat ? (
              <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                <span style={{ ...textStyles.metricValue, fontSize: '1rem' }}>{bufferbloat.grade}</span>
                {typeof bufferbloat.deltaMs === 'number' && (
                  <span style={{ ...textStyles.metricValue, fontSize: '0.65rem', opacity: 0.45 }}>+{bufferbloat.deltaMs.toFixed(0)} ms</span>
                )}
              </span>
            ) : <span style={{ ...textStyles.metricValue, fontSize: '1rem', opacity: 0.4 }}>—</span>}
          </div>
        </div>
      )}

      {/* L1 — Measurement quality (consensus, agreement, stability, packet loss, methodology) */}
      {isComplete && result && <MeasurementQuality result={result} speedUnit={speedUnit} />}

      {/* L2 — Per-provider breakdown */}
      {isComplete && result && <ProviderBreakdown result={result} speedUnit={speedUnit} />}

      {/* DNS Connectivity */}
      <DnsBar dnsCheck={dnsCheck} phase={phase} />
    </div>
  );
}
