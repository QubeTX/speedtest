import type { CSSProperties } from 'react';
import { useNetworkInfo } from '../../hooks/useNetworkInfo';
import { useResponsive } from '../../hooks/useResponsive';

interface SysInfoProps {
  serverName?: string | null;
  isp?: string | null;
  isError?: boolean;
  errorDetails?: string[];
}

export default function SysInfo({ serverName, isp, isError, errorDetails }: SysInfoProps) {
  const network = useNetworkInfo();
  const { isMobile } = useResponsive();

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

  const connectionLabel = network.available
    ? [network.type, network.effectiveType].filter(Boolean).join(' • ').toUpperCase()
    : null;

  return (
    <div style={style}>
      {serverName && <>SERVER: {serverName}<br /></>}
      {isp && <>ISP: {isp}<br /></>}
      {connectionLabel && <>{connectionLabel}<br /></>}
      BUILT BY QUBETX
    </div>
  );
}
