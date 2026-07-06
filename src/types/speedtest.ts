export type TestPhase = 'idle' | 'discovering' | 'latency' | 'download' | 'upload' | 'complete' | 'error';

/**
 * Single-provider selection modes (retained for settings back-compat and
 * debugging). The v4 orchestrator is driven by {@link TestProfile} instead;
 * `'both'` maps to the N-provider {@link AggregatedProvider}. The extra
 * per-provider keys make the factory able to construct any single provider in
 * isolation.
 */
export type ProviderMode =
  | 'both'
  | 'cloudflare'
  | 'ndt7'
  | 'msak'
  | 'librespeed'
  | 'fastcom'
  | 'cachefly'
  | 'vultr';

/**
 * v4 test mode (METHODOLOGY.md §3):
 * - `'fast'` — Cloudflare + NDT7 + MSAK with confidence-sequence early stop.
 * - `'full'` — every platform-available provider, fixed durations, no early stop.
 * Accuracy-first default is `'full'`.
 */
export type TestProfile = 'fast' | 'full';

/** Producer platform stamped into the result payload (METHODOLOGY.md §1). */
export type ResultPlatform = 'web' | 'app' | 'cli';

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
  /** Headline ping — min-RTT (physical path floor) in v4. */
  ping: number;
  /** Headline jitter — PDV (P95−P50 of RTT) in v4. */
  jitter: number;
  /** Headline download — the v4 CAPACITY estimate (Mbps). */
  downloadSpeed: number;
  /** Headline upload — the v4 CAPACITY estimate (Mbps). */
  uploadSpeed: number;
  packetLoss: number | null;
  serverName: string;
  timestamp: number;
  /**
   * @deprecated v4 uses the {@link SpeedTestResult.providers} array. Retained
   * for one release as a populated alias so existing UI keeps rendering the
   * Cloudflare/NDT7 breakdown while the design layer migrates.
   */
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
  jitterBreakdown?: JitterBreakdown;
  downloadEstimate?: BandwidthEstimate;
  uploadEstimate?: BandwidthEstimate;
  networkMetadata?: NetworkMetadata;

  // ── v4 payload schema (METHODOLOGY.md §9) ─────────────────────────────────
  /** Methodology stamp, e.g. `"4.0"` (see `methodology-version.ts`). */
  methodologyVersion?: string;
  /** Producer platform: `'web'` for this repo. */
  platform?: ResultPlatform;
  /** Test mode that produced this result. */
  providerSet?: TestProfile;
  /** Headline CAPACITY ± CI — the speed the saturating tests agree on. */
  capacityMbps?: DirectionalMbpsWithCi;
  /** Secondary CONSENSUS ± CI — the conservative all-providers number. */
  consensusMbps?: DirectionalMbpsWithCi;
  /** Provider agreement (I² band) for the download direction (headline). */
  agreement?: AgreementInfo;
  /** Provider agreement for the upload direction (secondary). */
  uploadAgreement?: AgreementInfo;
  /** Responsiveness (approx): 60000 / P50(loaded RTT). */
  rpm?: number;
  /** Per-provider breakdown, registry-ordered; includes failed & platform-unavailable. */
  providers?: ProviderRunResult[];
  /** Providers with < MIN_MERGE_SAMPLES cleaned samples in a direction. */
  mergeExclusions?: MergeExclusionEntry[];
  /** Headline (capacity) confidence intervals, confidenceLevel 0.95. */
  confidenceIntervals?: ConfidenceIntervals;
  /** Single-stream (NDT7) vs multi-stream flow-count disclosure (METHODOLOGY.md §6). */
  flowDisclosure?: FlowDisclosure;

  // ── Shared raw provider extras (previously attached via `as any`) ──────────
  /** Raw, time-ordered per-tick Mbps samples for orchestrator reprocessing. */
  bandwidthSamples?: { download: number[]; upload: number[] };
  downloadBytes?: number;
  uploadBytes?: number;
  downloadDurationS?: number;
  uploadDurationS?: number;
  /** Hodges–Lehmann vs trimean instability cross-check (METHODOLOGY.md §5 step 6). */
  unstableFlag?: { download: boolean; upload: boolean };
  hodgesLehmann?: { download: number; upload: number };
  /** Vultr-only: winning PoP code and its selection RTT (L3 drill-down). */
  vultrPop?: string;
  selectionRttMs?: number;
}

export interface SpeedTestProvider {
  name: string;
  supportsPacketLoss: boolean;
  requiresConsent: boolean;
  /** False for download-only providers (Vultr, CacheFly). Absent ⇒ treated as true. */
  uploadSupported?: boolean;
  start(onProgress: (p: SpeedTestProgress) => void, duration?: TestDuration): Promise<SpeedTestResult>;
  stop(): void;
}

// ── v4 cross-provider schema types (METHODOLOGY.md §6 / §9) ─────────────────

/** Provider participation in a given platform/run. */
export type ProviderAvailability = 'ran' | 'unavailable-platform' | 'failed';

/** I² heterogeneity band (mirrors the merge core's `AgreementBand`). */
export type AgreementBand = 'high' | 'moderate' | 'low' | 'very-low' | 'insufficient';

export interface AgreementInfo {
  /** Between-provider I² (null when k < 2). */
  i2: number | null;
  band: AgreementBand;
}

export interface BandwidthCi {
  lower: number;
  upper: number;
}

/** A directional headline number with per-direction 95% CIs. */
export interface DirectionalMbpsWithCi {
  download: number;
  upload: number;
  downloadCi: BandwidthCi;
  uploadCi: BandwidthCi;
}

export interface ConfidenceIntervals {
  download: BandwidthCi;
  upload: BandwidthCi;
  confidenceLevel: number;
}

/** One entry in the L2 per-provider breakdown (METHODOLOGY.md §9 `providers[]`). */
export interface ProviderRunResult {
  /** Lowercase registry key (looks up capability priors), e.g. `'cloudflare'`. */
  provider: string;
  /** Human-readable label, e.g. `'Cloudflare'`. */
  name: string;
  server: string | null;
  availability: ProviderAvailability;
  pingMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  /** Cleaned sample counts per direction. */
  samples: { download: number; upload: number };
  bytes: { download: number; upload: number };
  error?: string;
}

export interface MergeExclusionEntry {
  provider: string;
  direction: 'download' | 'upload';
  samples: number;
}

export interface FlowDisclosure {
  /** Single-stream (NDT7) download figure, if present. */
  singleStreamDownloadMbps: number | null;
  /** Best multi-stream/aggregate download figure, if present. */
  multiStreamDownloadMbps: number | null;
  /** True when the two diverge materially (> 30%). */
  divergent: boolean;
}

export interface Settings {
  providerMode: ProviderMode;
  /**
   * v4 test mode. Accuracy-first default is `'full'`; the FAST action selects
   * `'fast'` at start time (see METHODOLOGY.md §3).
   */
  testProfile: TestProfile;
  testDuration: TestDuration;
  dataPolicyAccepted: boolean;
  speedUnit: SpeedUnit;
  autoCopyResults: boolean;
  soundEffects: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  providerMode: 'both',
  testProfile: 'full',
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
  /** Legacy RFC 3550 EWMA jitter (kept as the working `jitter` scalar). */
  jitter: number;
  jitterMad: number;
  /** Canonical v4 jitter — PDV = P95(RTT) − P50(RTT). */
  pdv?: number;
  /** Explicit RFC 3550 EWMA value (compatibility field; equals `jitter`). */
  jitterRfc3550?: number;
}

/** v4 widens the grade set to include `A+` (delta-ms grading, METHODOLOGY.md §7). */
export type BufferbloatGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface BufferbloatResult {
  unloadedLatency: LatencyStats;
  downloadLoadedLatency: LatencyStats;
  uploadLoadedLatency: LatencyStats;
  grade: BufferbloatGrade;
  /** Legacy v3 secondary ratios (loaded/idle), retained for existing UI. */
  downloadRatio: number;
  uploadRatio: number;
  // ── v4 delta-ms fields (METHODOLOGY.md §7 / §9) ──────────────────────────
  /** Canonical: P95(loaded RTT) − P50(idle RTT), ms. */
  deltaMs?: number;
  /** Secondary: P95(loaded) / P50(idle). */
  ratio?: number;
  /** P50 idle RTT, ms. */
  unloadedLatencyMs?: number;
  /** P95 loaded RTT per direction, ms. */
  loadedLatencyMs?: { download: number; upload: number };
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

export interface JitterBreakdown {
  idle: number;            // Jitter from unloaded latency phase
  duringDownload: number;  // Jitter during download (loaded)
  duringUpload: number;    // Jitter during upload (loaded)
}

export interface BandwidthEstimate {
  value: number;           // Point estimate (Mbps)
  ci95Lower: number;       // 95% CI lower bound
  ci95Upper: number;       // 95% CI upper bound
  ciMargin: number;        // ± margin
  method: string;          // e.g. "inverse-variance + trimean"
  sampleCount: number;     // Number of samples used
}

export interface NetworkMetadata {
  ip: string | null;
  ipVersion: 4 | 6 | null;
  isp: string | null;
  asn: number | null;
  ispFull: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  colo: string | null;
  coloCity: string | null;
  tlsVersion: string | null;
  httpVersion: string | null;
  tcpRtt: number | null;
  tcpMinRtt: number | null;
  fetchedAt: number;
}

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
