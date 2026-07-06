import { useRef, type CSSProperties } from 'react';
import { useNetworkInfo } from '../../hooks/useNetworkInfo';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { usePretext } from '../../providers/PretextProvider';
import type { NetworkMetadata } from '../../types/speedtest';

interface SysInfoProps {
  serverName?: string | null;
  isp?: string | null;
  networkMetadata?: NetworkMetadata | null;
  isError?: boolean;
  errorDetails?: string[];
}

export default function SysInfo({ serverName, isp, networkMetadata, isError, errorDetails }: SysInfoProps) {
  const network = useNetworkInfo();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const { isReady, getLayout } = usePretext();

  // Reserve height for worst-case SysInfo content to prevent layout jumps
  let minHeight: number | undefined;
  if (isReady && containerWidth !== null) {
    const result = getLayout('sysinfo-worst', containerWidth);
    if (result) minHeight = result.height;
  }

  const style: CSSProperties = {
    width: '100%',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    opacity: 0.6,
    lineHeight: 1.6,
    paddingTop: '0.5rem',
    minHeight,
  };

  if (isError && errorDetails) {
    return (
      <div ref={containerRef} style={{ ...style, opacity: 0.8, color: '#ff3b30' }}>
        {errorDetails.map((line, i) => (
          <span key={i}>{line}<br /></span>
        ))}
      </div>
    );
  }

  // Connection line: physical type only (WIFI/CELLULAR — factual, Android).
  // The Network Information API's downlink/rtt/effectiveType are deliberately
  // NOT shown: Chrome privacy-caps downlink at 10 Mbps and quantizes rtt, so
  // they read as bogus "speeds" next to our real measurements.
  const connectionLines: string[] = [];
  if (network.available && network.type) {
    connectionLines.push(network.type.toUpperCase());
  }

  return (
    <div ref={containerRef} style={style}>
      {serverName && <>SERVER: {serverName}<br /></>}
      {isp && <>ISP: {isp}<br /></>}
      {!isp && networkMetadata?.ispFull && <>ISP: {networkMetadata.ispFull}<br /></>}
      {networkMetadata?.ip && <>IP: {networkMetadata.ip} · IPv{networkMetadata.ipVersion ?? '?'}<br /></>}
      {networkMetadata?.city && (
        <>{[networkMetadata.city, networkMetadata.region, networkMetadata.country].filter(Boolean).join(', ')}<br /></>
      )}
      {networkMetadata?.coloCity && networkMetadata?.colo && (
        <>EDGE: {networkMetadata.coloCity} ({networkMetadata.colo})<br /></>
      )}
      {connectionLines.map((line, i) => <span key={i}>{line}<br /></span>)}
      <a
        href="https://qubetx.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted rgba(17,17,17,0.35)', cursor: 'pointer' }}
      >
        BUILT BY QUBETX
      </a>
    </div>
  );
}
