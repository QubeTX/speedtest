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
    cloudflare?: SpeedTestResult & { bandwidthSamples?: { download: number[]; upload: number[] } };
    ndt7?: SpeedTestResult & { bandwidthSamples?: { download: number[]; upload: number[] } };
  };
  isp?: string;
  dnsCheck?: DnsCheckResult;
  latencyStats?: LatencyStats;
  bufferbloat?: BufferbloatResult;
  stability?: StabilityMetric;
  providerDivergence?: {
    download: number;
    upload: number;
    significant: boolean;
  };
  aimScores?: AimScores;
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

export interface DnsProbeResult {
  domain: string;
  status: 'pass' | 'fail';
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  totalMs: number | null;
}

export interface DnsCheckResult {
  probes: DnsProbeResult[];
  allPassed: boolean;
  avgTotalMs: number | null;
  avgDnsMs: number | null;
  avgTcpMs: number | null;
  avgTlsMs: number | null;
  avgTtfbMs: number | null;
}

export interface LatencyStats {
  samples: number[];
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  stddev: number;
  jitter: number;
  jitterMad: number;
}

export type BufferbloatGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface BufferbloatResult {
  unloadedLatency: LatencyStats;
  downloadLoadedLatency: LatencyStats;
  uploadLoadedLatency: LatencyStats;
  grade: BufferbloatGrade;
  downloadRatio: number;
  uploadRatio: number;
}

export interface StabilityMetric {
  downloadCV: number;
  uploadCV: number;
  downloadStable: boolean;
  uploadStable: boolean;
}

export interface AimScoreEntry {
  points: number;
  classificationIdx: 0 | 1 | 2 | 3 | 4;
  classificationName: 'bad' | 'poor' | 'average' | 'good' | 'great';
}

export type AimScores = Record<string, AimScoreEntry>;

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
