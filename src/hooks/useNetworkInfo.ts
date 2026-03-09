import { useState, useEffect } from 'react';

interface NetworkInfo {
  type: string | null;        // wifi, cellular, ethernet, etc.
  effectiveType: string | null; // 4g, 3g, 2g, slow-2g
  downlink: number | null;    // Mbps estimate
  rtt: number | null;         // ms estimate
  available: boolean;
}

// Extend Navigator for Network Information API
interface NetworkInformation extends EventTarget {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

function getConnection(): NetworkInformation | undefined {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection;
}

export function useNetworkInfo(): NetworkInfo {
  const [info, setInfo] = useState<NetworkInfo>(() => read());

  function read(): NetworkInfo {
    const conn = getConnection();
    if (!conn) {
      return { type: null, effectiveType: null, downlink: null, rtt: null, available: false };
    }
    return {
      type: conn.type ?? null,
      effectiveType: conn.effectiveType ?? null,
      downlink: conn.downlink ?? null,
      rtt: conn.rtt ?? null,
      available: true,
    };
  }

  useEffect(() => {
    const conn = getConnection();
    if (!conn) return;
    const onChange = () => setInfo(read());
    conn.addEventListener('change', onChange);
    return () => conn.removeEventListener('change', onChange);
  }, []);

  return info;
}
