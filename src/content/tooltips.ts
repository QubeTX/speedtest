export interface TooltipRange {
  /** Values below this threshold match this range (checked in order, first match wins) */
  max: number;
  label: string;
}

export interface TooltipEntry {
  title: string;
  /** Core explanation — always shown */
  description: string;
  /** Optional value-based ranges. When a value is provided, only the matching range is shown. */
  ranges?: TooltipRange[];
  /** Unit suffix for the value display (e.g. "ms", "%", "x") */
  unit?: string;
}

export const tooltips: Record<string, TooltipEntry> = {
  p50: {
    title: 'Median Latency (P50)',
    description: 'Your typical ping \u2014 the number half your samples fall below. This is what you actually feel when browsing.',
    unit: 'ms',
    ranges: [
      { max: 20, label: 'Excellent \u2014 near-instant response.' },
      { max: 50, label: 'Good \u2014 smooth for most activities.' },
      { max: 100, label: 'Fair \u2014 some lag on real-time apps.' },
      { max: Infinity, label: 'High \u2014 noticeable delay on most interactions.' },
    ],
  },
  p95: {
    title: '95th Percentile (P95)',
    description: 'Tail latency \u2014 95% of your pings were faster than this. When this is high, roughly 1 in 20 interactions will feel sluggish.',
    unit: 'ms',
    ranges: [
      { max: 30, label: 'Excellent \u2014 even your slow pings are fast.' },
      { max: 80, label: 'Good \u2014 occasional hiccups unlikely to be noticed.' },
      { max: 150, label: 'Fair \u2014 video calls may stutter occasionally.' },
      { max: Infinity, label: 'High \u2014 expect periodic lag spikes.' },
    ],
  },
  p99: {
    title: '99th Percentile (P99)',
    description: 'Worst-case latency you\'ll realistically hit. Critical for competitive gaming where a single spike means a missed input.',
    unit: 'ms',
    ranges: [
      { max: 50, label: 'Excellent \u2014 rock-solid even at the extremes.' },
      { max: 120, label: 'Good \u2014 rare spikes, unlikely to be disruptive.' },
      { max: 250, label: 'Fair \u2014 occasional bad moments under load.' },
      { max: Infinity, label: 'High \u2014 expect noticeable spike events.' },
    ],
  },
  rfc3550: {
    title: 'RFC 3550',
    description: 'The industry-standard algorithm for measuring jitter, defined in RFC 3550. The same formula used by VoIP phones, Zoom, and video conferencing systems to gauge connection smoothness.',
  },
  samples: {
    title: 'Samples',
    description: 'The number of individual latency measurements taken. More samples means more statistically reliable results. We send 100 pings with 3 warmup pings discarded.',
  },
  stddev: {
    title: 'Standard Deviation',
    description: 'How spread out your latency measurements are from the average. Lower means your connection is more consistent.',
    unit: 'ms',
    ranges: [
      { max: 5, label: 'Excellent \u2014 very consistent connection.' },
      { max: 15, label: 'Typical \u2014 normal amount of variation.' },
      { max: 30, label: 'Elevated \u2014 some instability in your connection.' },
      { max: Infinity, label: 'High \u2014 connection quality varies significantly.' },
    ],
  },
  cf: {
    title: 'Cloudflare (CF)',
    description: 'Result from Cloudflare\'s speed test engine. Uses multiple HTTPS requests with progressively larger payloads to measure your throughput across varying load conditions.',
  },
  ndt: {
    title: 'M-Lab NDT7 (NDT)',
    description: 'Result from M-Lab\'s NDT7 test \u2014 a single long-lived WebSocket stream that measures raw TCP throughput. Gives a complementary perspective to multi-request tests.',
  },
  avg: {
    title: 'Weighted Average',
    description: 'Blends both test providers for a more accurate final result. Bandwidth uses 60% Cloudflare / 40% NDT7. Latency uses the inverse (40% / 60%) since NDT7 has kernel-level TCP metrics.',
  },
  bufferbloat: {
    title: 'Bufferbloat',
    description: 'When your router\'s buffer is too large, packets queue up and latency spikes under heavy load \u2014 even though bandwidth looks fine.',
    ranges: [
      { max: 1.5, label: 'Grade A \u2014 minimal buffering, likely using smart queue management.' },
      { max: 3, label: 'Grade B \u2014 some buffering under load, acceptable for most uses.' },
      { max: 5, label: 'Grade C \u2014 noticeable under load. VoIP and video calls may degrade.' },
      { max: 10, label: 'Grade D \u2014 significant bufferbloat. Real-time apps suffer.' },
      { max: Infinity, label: 'Grade F \u2014 severe bufferbloat. Fast on paper, miserable in practice.' },
    ],
  },
  bufferbloatRatio: {
    title: 'Load Ratio',
    description: 'How much your latency increases when the connection is under full load. 1.0x means no increase (ideal).',
    unit: 'x',
    ranges: [
      { max: 1.5, label: 'Excellent \u2014 latency barely budges under load.' },
      { max: 3, label: 'Acceptable \u2014 some increase, but manageable.' },
      { max: 5, label: 'Noticeable \u2014 latency climbs significantly during transfers.' },
      { max: Infinity, label: 'Severe \u2014 latency multiplies dramatically under load.' },
    ],
  },
  stable: {
    title: 'Connection Stability',
    description: 'Whether your speed stays consistent throughout the test. "Stable" means predictable performance. "Variable" means speed swings that could disrupt streaming or large downloads.',
  },
  cv: {
    title: 'Coefficient of Variation (CV)',
    description: 'How much your speed fluctuates during the test, expressed as a percentage of the average.',
    unit: '%',
    ranges: [
      { max: 10, label: 'Rock-steady \u2014 fiber-like consistency.' },
      { max: 15, label: 'Good \u2014 minor fluctuations, stable for all uses.' },
      { max: 20, label: 'Fair \u2014 some variation, possible shared medium or mild congestion.' },
      { max: 40, label: 'Variable \u2014 noticeable swings. Wireless interference or peak-hour congestion.' },
      { max: Infinity, label: 'Highly unstable \u2014 likely packet loss, severe congestion, or throttling.' },
    ],
  },
  divergence: {
    title: 'Provider Divergence',
    description: 'How much Cloudflare and NDT7 results disagree with each other.',
    unit: '%',
    ranges: [
      { max: 15, label: 'Normal \u2014 providers are in close agreement.' },
      { max: 30, label: 'Moderate \u2014 some difference, but within expected variance.' },
      { max: Infinity, label: 'Significant \u2014 may indicate ISP throttling, routing asymmetry, or server-side congestion.' },
    ],
  },
  dns: {
    title: 'DNS Lookup',
    description: 'Time for your DNS resolver to translate a domain name into an IP address.',
    unit: 'ms',
    ranges: [
      { max: 10, label: 'Excellent \u2014 very fast resolver.' },
      { max: 30, label: 'Normal \u2014 typical for most DNS providers.' },
      { max: 50, label: 'Slow \u2014 consider switching to a faster public DNS.' },
      { max: Infinity, label: 'Very slow \u2014 your DNS resolver is a bottleneck.' },
    ],
  },
  tcp: {
    title: 'TCP Connect',
    description: 'Time to establish a TCP connection to the remote server. Reflects physical distance and network path quality.',
    unit: 'ms',
    ranges: [
      { max: 20, label: 'Excellent \u2014 very close or well-routed server.' },
      { max: 50, label: 'Typical \u2014 normal for most connections.' },
      { max: Infinity, label: 'Elevated \u2014 long distance or congested path.' },
    ],
  },
  tls: {
    title: 'TLS Handshake',
    description: 'Time to negotiate HTTPS encryption (the secure handshake before data flows).',
    unit: 'ms',
    ranges: [
      { max: 30, label: 'Fast \u2014 efficient TLS negotiation.' },
      { max: 100, label: 'Normal \u2014 typical handshake time.' },
      { max: Infinity, label: 'Slow \u2014 may indicate an overloaded server or long round-trip.' },
    ],
  },
  ttfb: {
    title: 'Time to First Byte (TTFB)',
    description: 'How quickly the server begins sending data after the connection is established.',
    unit: 'ms',
    ranges: [
      { max: 100, label: 'Good \u2014 server is responding quickly.' },
      { max: 300, label: 'Acceptable \u2014 some server processing delay.' },
      { max: Infinity, label: 'Slow \u2014 likely server-side processing bottleneck.' },
    ],
  },
  jitterIdle: {
    title: 'Idle Jitter',
    description: 'Jitter measured on an unloaded connection \u2014 your baseline variability before any bandwidth test runs.',
    unit: 'ms',
    ranges: [
      { max: 2, label: 'Excellent \u2014 rock-steady idle connection.' },
      { max: 5, label: 'Good \u2014 minor variation, normal for most connections.' },
      { max: 15, label: 'Fair \u2014 some instability even without load.' },
      { max: Infinity, label: 'High \u2014 unstable connection at baseline.' },
    ],
  },
  jitterDownload: {
    title: 'Download Jitter',
    description: 'Jitter measured while download is active. Higher than idle jitter indicates your connection buffers are filling up under load.',
    unit: 'ms',
    ranges: [
      { max: 5, label: 'Excellent \u2014 stable even under download load.' },
      { max: 15, label: 'Good \u2014 some variation under load, typical.' },
      { max: 30, label: 'Fair \u2014 noticeable buffering during downloads.' },
      { max: Infinity, label: 'High \u2014 significant buffering, may affect streaming.' },
    ],
  },
  jitterUpload: {
    title: 'Upload Jitter',
    description: 'Jitter measured while upload is active. Critical for voice and video call quality \u2014 upload jitter directly affects outgoing audio/video smoothness.',
    unit: 'ms',
    ranges: [
      { max: 5, label: 'Excellent \u2014 great for video calls.' },
      { max: 15, label: 'Good \u2014 calls should be smooth.' },
      { max: 30, label: 'Fair \u2014 may cause occasional voice artifacts.' },
      { max: Infinity, label: 'High \u2014 video calls will likely stutter.' },
    ],
  },
  ipAddress: {
    title: 'IP Address',
    description: 'Your public IP address as seen by the test server. This is the address the internet uses to reach your connection.',
  },
  ispInfo: {
    title: 'ISP / Network',
    description: 'Your Internet Service Provider and their Autonomous System Number (ASN). The ASN identifies your ISP\'s network in the global routing system.',
  },
  edgeServer: {
    title: 'Edge Server',
    description: 'The Cloudflare data center handling your test. Closer data centers mean lower latency. The IATA code identifies the nearest airport to the server.',
  },
  confidenceInterval: {
    title: '95% Confidence Interval',
    description: 'Computed via bootstrap resampling (1,000 iterations). Your actual speed likely falls within this range. A narrow range means high measurement confidence.',
    unit: 'Mbps',
  },
  dynamicWeights: {
    title: 'Dynamic Provider Weights',
    description: 'Provider weights are computed from measurement consistency using inverse-variance weighting. The provider with more consistent (lower-variance) results gets more influence on the final number.',
  },
  winsorized: {
    title: 'Winsorized Validation',
    description: 'A second independent calculation cross-checks the primary result. Instead of removing outliers (IQR filtering), Winsorization caps them at the 5th/95th percentile. If the two methods disagree by more than 15%, they are averaged for robustness.',
  },
};

/**
 * Find the matching range label for a given value.
 * Returns undefined if no ranges defined or value not provided.
 */
export function getRangeLabel(key: string, value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const entry = tooltips[key];
  if (!entry?.ranges) return undefined;
  for (const range of entry.ranges) {
    if (value < range.max) return range.label;
  }
  return undefined;
}
