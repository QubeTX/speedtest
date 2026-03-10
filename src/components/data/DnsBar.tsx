import { useState, type CSSProperties } from 'react';
import type { TestPhase, DnsCheckResult } from '../../types/speedtest';
import { colors, borders, typography } from '../../theme/tokens';
import { responsive } from '../../theme/responsive';
import { useResponsive } from '../../hooks/useResponsive';

interface DnsBarProps {
  dnsCheck: DnsCheckResult | null;
  phase: TestPhase;
}

const TOTAL_DOMAINS = 8;

export default function DnsBar({ dnsCheck, phase }: DnsBarProps) {
  const [showDetail, setShowDetail] = useState(false);
  const { breakpoint, isMobile } = useResponsive();
  const r = responsive[breakpoint];

  const isIdle = phase === 'idle';

  // Don't render when idle and no data
  if (isIdle && !dnsCheck) return null;
  // Don't render at all in idle state (reset clears dnsCheck)
  if (isIdle) return null;

  const probes = dnsCheck?.probes ?? [];
  const passedCount = probes.filter(p => p.status === 'pass').length;
  const probesDone = probes.length;
  const isScanning = probesDone < TOTAL_DOMAINS && phase !== 'complete' && phase !== 'error';

  const dotSize = isMobile ? 6 : 8;
  const fontSize = isMobile ? '0.55rem' : '0.65rem';

  // Build summary text
  let summaryText = 'SCANNING...';
  if (probesDone > 0 && !isScanning) {
    summaryText = `${passedCount}/${probesDone} REACHABLE`;
    if (dnsCheck?.avgTotalMs !== null && dnsCheck?.avgTotalMs !== undefined) {
      summaryText += ` \u2022 ${dnsCheck.avgTotalMs}ms`;
    }
  } else if (probesDone > 0) {
    summaryText = `${probesDone}/${TOTAL_DOMAINS} CHECKED...`;
  }

  const barStyle: CSSProperties = {
    flex: 'none',
    borderTop: borders.stroke,
    padding: isMobile ? '0.5rem 1.5rem' : '0.6rem 3rem',
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '0.5rem' : '0.75rem',
    cursor: probesDone > 0 ? 'pointer' : 'default',
    transition: 'background-color 0.2s ease',
    position: 'relative',
  };

  const dotsContainerStyle: CSSProperties = {
    display: 'flex',
    gap: isMobile ? '3px' : '4px',
    alignItems: 'center',
  };

  const labelStyle: CSSProperties = {
    ...typography.metaLabel,
    fontSize,
    flex: 'none',
  };

  const summaryStyle: CSSProperties = {
    fontSize,
    fontWeight: 500,
    letterSpacing: '0.05em',
    color: colors.ink,
    opacity: 0.7,
    fontVariantNumeric: 'tabular-nums',
  };

  // Build dots
  const dots = [];
  for (let i = 0; i < TOTAL_DOMAINS; i++) {
    const probe = probes[i];
    let dotColor = 'rgba(0,0,0,0.12)'; // empty/pending
    if (probe) {
      dotColor = probe.status === 'pass' ? '#22c55e' : colors.error;
    }
    const isPulsing = !probe && isScanning;

    dots.push(
      <div
        key={i}
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: dotColor,
          transition: 'background-color 0.3s ease',
          animation: isPulsing ? 'pulse-scale 1.5s ease infinite' : undefined,
        }}
      />,
    );
  }

  // Detail overlay
  const detailOverlay = showDetail && probesDone > 0 ? (
    <div
      onClick={(e) => { e.stopPropagation(); setShowDetail(false); }}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: borders.stroke,
        padding: isMobile ? '0.75rem 1.5rem' : '1rem 3rem',
        zIndex: 20,
        animation: 'fade-in 0.2s ease',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{
        ...typography.metaLabel,
        fontSize: isMobile ? '0.5rem' : '0.55rem',
        marginBottom: '0.5rem',
        opacity: 0.5,
      }}>
        CONNECTIVITY DIAGNOSTICS
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? '0.2rem' : '0.25rem 2rem',
      }}>
        {probes.map((probe) => (
          <div
            key={probe.domain}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: isMobile ? '0.6rem' : '0.65rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: probe.status === 'pass' ? '#22c55e' : colors.error,
              flexShrink: 0,
            }} />
            <span style={{
              letterSpacing: '0.05em',
              fontWeight: 500,
              flex: 1,
            }}>
              {probe.domain}
            </span>
            <span style={{
              opacity: 0.6,
              fontWeight: 500,
              color: probe.status === 'fail' ? colors.error : colors.ink,
            }}>
              {probe.status === 'pass' ? `${probe.totalMs}ms` : 'FAIL'}
            </span>
          </div>
        ))}
      </div>

      {dnsCheck && (
        <div style={{
          marginTop: '0.5rem',
          paddingTop: '0.4rem',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          fontSize: isMobile ? '0.5rem' : '0.55rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          opacity: 0.5,
        }}>
          {passedCount}/{probes.length} PASSED
          {dnsCheck.avgTotalMs !== null && ` \u2022 AVG ${dnsCheck.avgTotalMs}ms`}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      style={barStyle}
      onClick={() => probesDone > 0 && setShowDetail(prev => !prev)}
      onMouseEnter={(e) => {
        if (probesDone > 0) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {detailOverlay}
      <span style={labelStyle}>DNS</span>
      <div style={dotsContainerStyle}>{dots}</div>
      <span style={summaryStyle}>{summaryText}</span>
    </div>
  );
}
