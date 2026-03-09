export type TestPhase = 'idle' | 'discovering' | 'latency' | 'download' | 'upload' | 'complete' | 'error';
export type ProviderMode = 'both' | 'cloudflare' | 'ndt7';
export type TestDuration = 'auto' | 15 | 30 | 60 | 120 | 300 | 600;
export type SpeedUnit = 'auto' | 'Mbps' | 'Kbps' | 'Gbps';

export interface SpeedTestProgress {
  phase: TestPhase;
  currentProvider: string;
  ping: number | null;
  jitter: number | null;
  downloadSpeed: number | null;
  uploadSpeed: number | null;
  packetLoss: number | null;
  downloadProgress: number;
  uploadProgress: number;
  serverName: string | null;
  error: string | null;
}

export interface SpeedTestResult {
  provider: string;
  ping: number;
  jitter: number;
  downloadSpeed: number;
  uploadSpeed: number;
  packetLoss: number | null;
  serverName: string;
  timestamp: number;
  providerResults?: {
    cloudflare?: SpeedTestResult;
    ndt7?: SpeedTestResult;
  };
  isp?: string;
}

export interface SpeedTestProvider {
  name: string;
  supportsPacketLoss: boolean;
  requiresConsent: boolean;
  start(onProgress: (p: SpeedTestProgress) => void, duration?: TestDuration): Promise<SpeedTestResult>;
  stop(): void;
}

export interface Settings {
  providerMode: ProviderMode;
  testDuration: TestDuration;
  dataPolicyAccepted: boolean;
  speedUnit: SpeedUnit;
  autoCopyResults: boolean;
  soundEffects: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  providerMode: 'both',
  testDuration: 30,
  dataPolicyAccepted: false,
  speedUnit: 'auto',
  autoCopyResults: false,
  soundEffects: false,
};

export function formatSpeed(mbps: number, unit: SpeedUnit): { value: string; unit: string } {
  if (unit === 'Kbps') return { value: (mbps * 1000).toFixed(0), unit: 'Kbps' };
  if (unit === 'Gbps') return { value: (mbps / 1000).toFixed(2), unit: 'Gbps' };
  if (unit === 'auto') {
    if (mbps >= 1000) return { value: (mbps / 1000).toFixed(2), unit: 'Gbps' };
    if (mbps < 1) return { value: (mbps * 1000).toFixed(0), unit: 'Kbps' };
  }
  return { value: mbps.toFixed(0), unit: 'Mbps' };
}

export function initialProgress(): SpeedTestProgress {
  return {
    phase: 'idle',
    currentProvider: '',
    ping: null,
    jitter: null,
    downloadSpeed: null,
    uploadSpeed: null,
    packetLoss: null,
    downloadProgress: 0,
    uploadProgress: 0,
    serverName: null,
    error: null,
  };
}
