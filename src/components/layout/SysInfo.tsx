import type { CSSProperties } from 'react';
import { useNetworkInfo } from '../../hooks/useNetworkInfo';

interface SysInfoProps {
  serverName?: string | null;
  isp?: string | null;
  isError?: boolean;
  errorDetails?: string[];
}

export default function SysInfo({ serverName, isp, isError, errorDetails }: SysInfoProps) {
  const network = useNetworkInfo();

  const style: CSSProperties = {
    width: '100%',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    opacity: 0.6,
    lineHeight: 1.6,
    paddingTop: '0.5rem',
  };

  if (isError && errorDetails) {
    return (
      <div style={{ ...style, opacity: 0.8, color: '#ff3b30' }}>
        {errorDetails.map((line, i) => (
          <span key={i}>{line}<br /></span>
        ))}
      </div>
    );
  }

  // Build connection lines with clear labels
  const connectionLines: string[] = [];
  if (network.available) {
    if (network.type) {
      // Physical type is available (Android) — show it, plus effective type for context
      connectionLines.push(network.type.toUpperCase());
      if (network.effectiveType) {
        connectionLines.push(`SPEED CLASS: ${network.effectiveType.toUpperCase()}`);
      }
    } else if (network.downlink !== null || network.rtt !== null) {
      // Desktop Chrome — no physical type, show bandwidth/RTT instead
      const parts: string[] = [];
      if (network.downlink !== null) parts.push(`${network.downlink} Mbps`);
      if (network.rtt !== null) parts.push(`${network.rtt} ms RTT`);
      connectionLines.push(parts.join(' • '));
    }
  }

  return (
    <div style={style}>
      {serverName && <>SERVER: {serverName}<br /></>}
      {isp && <>ISP: {isp}<br /></>}
      {connectionLines.map((line, i) => <span key={i}>{line}<br /></span>)}
      BUILT BY QUBETX
    </div>
  );
}
