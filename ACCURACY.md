# Technical Accuracy Report

## QubeTX Speed Test — Measurement Methodology & Architecture

This document provides a comprehensive technical breakdown of how the QubeTX Speed Test measures internet connection quality, the algorithms and standards used, the accuracy techniques employed, and how each metric is calculated.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Speed Test Providers](#speed-test-providers)
3. [Latency Measurement](#latency-measurement)
4. [Bandwidth Measurement](#bandwidth-measurement)
5. [Statistical Methods](#statistical-methods)
6. [Bufferbloat Detection](#bufferbloat-detection)
7. [Connection Stability Analysis](#connection-stability-analysis)
8. [DNS Diagnostics](#dns-diagnostics)
9. [Provider Aggregation](#provider-aggregation)
10. [Standards & References](#standards--references)

---

## Architecture Overview

The QubeTX Speed Test is a browser-based network measurement tool built with React and TypeScript, designed for technician-grade accuracy. It uses a **multi-provider, multi-phase** architecture:

```
Test Flow:
  1. Dedicated Latency Engine (100 HTTP pings)
  2. DNS Diagnostics (12-domain parallel probe, background)
  3. Cloudflare Speed Test (full duration)
     - Latency phase (configurable packet count)
     - Download phase (progressive chunk sizes, 100KB → 250MB)
     - Upload phase (progressive chunk sizes, 100KB → 50MB)
     - Packet loss phase (UDP via TURN)
     - Concurrent loaded latency probes during DL/UL
  4. M-Lab NDT7 (full duration)
     - Download phase (WebSocket streaming)
     - Upload phase (WebSocket streaming)
     - TCP info extraction (MinRTT, SmoothedRTT)
  5. Statistical aggregation & analysis
```

### Key Design Decisions

- **Accuracy over speed**: Each provider gets the full user-configured test duration (not halved). A 60-second test runs 60s of Cloudflare + 60s of NDT7.
- **Independent latency engine**: 100 dedicated ping samples before bandwidth tests, not dependent on any provider's built-in latency measurement.
- **Raw sample collection**: Both providers expose raw bandwidth measurement points for post-processing with the statistics pipeline.
- **Confidence-weighted aggregation**: Provider results are merged using methodology-appropriate weights, not simple averaging.

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19, TypeScript, Vite |
| Cloudflare Provider | `@cloudflare/speedtest` v1.7.0 |
| NDT7 Provider | `@m-lab/ndt7` v0.1.4 |
| Latency Engine | Custom HTTP RTT with `PerformanceResourceTiming` API |
| DNS Diagnostics | `fetch()` + `PerformanceResourceTiming` API |
| Statistics | Custom module (`statistics.ts`) — trimean, IQR, RFC 3550 jitter |
| Text Layout | `@chenglou/pretext` for layout-shift prevention |

---

## Speed Test Providers

### Cloudflare (`@cloudflare/speedtest`)

Cloudflare's speed test engine measures throughput by making HTTP requests to Cloudflare's global edge network (`speed.cloudflare.com`). It uses the [PerformanceResourceTiming API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming) to extract precise timing.

**Measurement Sequence (default at 30s duration):**

| Phase | Payload | Count | Purpose |
|-------|---------|-------|---------|
| Latency | 0 bytes | 20 | Unloaded RTT baseline |
| Download | 100 KB | 1 | Connection warm-up (bypasses min duration check) |
| Download | 100 KB | 8 | Small file throughput |
| Download | 1 MB | 6 | Medium file throughput |
| Download | 10 MB | 4 | Large file throughput |
| Download | 100 MB | 3 | Very large file (saturates fast connections) |
| Download | 250 MB | 2 | Ultra-large (1Gbps+ connections) |
| Upload | 100 KB | 8 | Small upload throughput |
| Upload | 1 MB | 6 | Medium upload throughput |
| Upload | 10 MB | 4 | Large upload throughput |
| Upload | 50 MB | 3 | Very large upload (saturates fast uplinks) |
| Packet Loss | 1000 UDP | - | Via TURN server (WebRTC) |

**Configuration Tuning for Accuracy:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `bandwidthPercentile` | 0.5 (median) | More representative than the default 0.9 (90th percentile), which is optimistic |
| `latencyPercentile` | 0.5 (median) | Standard practice for latency reporting |
| `bandwidthMinRequestDuration` | 50 ms | Raised from 10ms — very short requests have disproportionate HTTP overhead |
| `loadedLatencyThrottle` | 200 ms | Reduced from 400ms — more frequent loaded latency sampling for bufferbloat detection |
| `loadedLatencyMaxPoints` | 50 | Increased from 20 — more data points for loaded latency analysis |
| `measureDownloadLoadedLatency` | true | Enables concurrent latency probes during download |
| `measureUploadLoadedLatency` | true | Enables concurrent latency probes during upload |

**Bandwidth Calculation:**
Each HTTP request's throughput is calculated as:
```
bps = transferSize (bits) / (requestDuration - serverProcessingTime)
```
The `transferSize` comes from `PerformanceResourceTiming.transferSize`, and server processing time is extracted from the `Server-Timing` response header (or a 10ms default estimate).

The engine applies a **ramp-up methodology**: it starts with small files and moves to progressively larger ones. Once a measurement set reaches the `bandwidthFinishRequestDuration` threshold (1000ms), further sets with larger files in the same direction may be skipped.

### M-Lab NDT7

The Network Diagnostic Tool version 7 (NDT7) is an open-source, single-stream TCP throughput test operated by [Measurement Lab (M-Lab)](https://www.measurementlab.net/). It uses WebSocket over TLS for both download and upload measurements.

**Key Characteristics:**
- **Single TCP connection**: Unlike Cloudflare's multi-request approach, NDT7 uses a single persistent WebSocket connection. This provides a conservative but realistic view of single-flow TCP performance.
- **Server selection**: Automatic geographic selection via M-Lab's Locate API (`locate.measurementlab.net`).
- **Streaming measurements**: Continuous callbacks report `MeanClientMbps` (client-side) and `TCPInfo` (server-side kernel metrics) at regular intervals.
- **TCP kernel metrics**: When available, NDT7 extracts `MinRTT` and `SmoothedRTT` directly from the kernel's TCP information block — these are the most accurate latency values available, as they bypass application-layer overhead.

**Why Both Providers?**

| Metric | Cloudflare Advantage | NDT7 Advantage |
|--------|---------------------|----------------|
| Bandwidth | Multi-connection saturates pipe better | Single-stream reveals TCP bottlenecks |
| Latency | More unloaded samples (configurable) | Kernel-level TCPInfo.MinRTT |
| Packet Loss | UDP-based measurement via TURN | N/A (not measured) |
| Server Location | Cloudflare edge (nearest PoP) | M-Lab (nearest NDT server) |
| Methodology | HTTP/HTTPS over CDN | WebSocket over TLS |

Using both provides cross-validation. If results agree, confidence is high. If they diverge significantly (>30%), it suggests throttling, QoS policies, or routing asymmetries — which is itself diagnostically valuable.

---

## Latency Measurement

### Dedicated Latency Engine

Before any bandwidth testing begins, a standalone latency engine collects **100 HTTP RTT samples** against Cloudflare's edge:

```
Endpoint: https://speed.cloudflare.com/__down?bytes=0
Method: fetch() with cache-busting query parameters
Timing: PerformanceResourceTiming.responseStart - requestStart
Fallback: performance.now() delta if Resource Timing unavailable
```

**Warm-up Protocol:**
- 3 initial pings are sent and **discarded** to establish the TCP connection (DNS resolution, TCP handshake, TLS negotiation)
- This ensures measurement samples only capture network RTT, not connection setup overhead

**Timing Precision:**
The engine prefers `PerformanceResourceTiming` over raw `performance.now()` deltas because:
- `responseStart - requestStart` excludes DNS, TCP, and TLS time on reused connections
- It provides sub-millisecond precision
- It's immune to JavaScript event loop delays that affect `performance.now()` deltas

**Output Metrics:**

| Metric | Calculation | Purpose |
|--------|-------------|---------|
| P50 (median) | 50th percentile of sorted samples | Headline "ping" value — most representative |
| P75 | 75th percentile | Upper quartile behavior |
| P95 | 95th percentile | Tail latency — affects real-time applications |
| P99 | 99th percentile | Worst-case latency — critical for gaming/VoIP |
| Min | Lowest sample | Best-case network RTT |
| Max | Highest sample | Worst observed latency |
| Mean | Arithmetic mean | Average (susceptible to outliers) |
| Stddev | Sample standard deviation | Latency variance |
| Jitter (RFC 3550) | Exponentially weighted moving average | See below |
| Jitter (MAD) | Mean absolute deviation of consecutive samples | Legacy comparison metric |

### Jitter Calculation — RFC 3550

The primary jitter metric follows [RFC 3550 (RTP)](https://www.rfc-editor.org/rfc/rfc3550#section-6.4.1), the standard used by VoIP, video conferencing, and real-time media systems:

```
J[i] = J[i-1] + (|D(i-1,i)| - J[i-1]) / 16
```

Where:
- `J[i]` is the jitter estimate after the i-th sample
- `D(i-1,i) = (R[i] - R[i-1])` is the difference between consecutive RTT samples
- The factor `1/16` provides exponential smoothing — recent variations are weighted more heavily
- This produces a **stable, converging estimate** that reflects ongoing network conditions rather than reacting to single spikes

The **MAD (Mean Absolute Deviation)** jitter is also computed for comparison:
```
MAD = sum(|samples[i] - samples[i-1]|) / (N - 1)
```

### Provider-Specific Latency

In addition to the dedicated engine:
- **Cloudflare**: Reports unloaded latency from dedicated latency packets, plus loaded latency measured concurrently during download/upload phases
- **NDT7**: Extracts `TCPInfo.MinRTT` from the Linux kernel's TCP information block (in microseconds, converted to milliseconds) — this is the most accurate network-layer RTT available in a browser context

---

## Bandwidth Measurement

### Raw Data Collection

Both providers expose per-measurement bandwidth data points:

**Cloudflare:** Each HTTP request yields a `BandwidthPoint`:
```ts
{ bytes, bps, duration, ping, measTime, serverTime, transferSize }
```
All points are collected and converted to Mbps for post-processing.

**NDT7:** Each streaming `downloadMeasurement` / `uploadMeasurement` callback reports:
```ts
{ MeanClientMbps }  // Client-side moving average
```
These are collected as raw bandwidth samples.

### Accuracy Pipeline

Raw bandwidth samples from both providers are processed through a three-stage accuracy pipeline (implemented in `statistics.ts`):

#### Stage 1: Slow-Start Discard (30%)

TCP connections begin with a [slow-start phase](https://www.rfc-editor.org/rfc/rfc5681#section-3.1) where the congestion window grows exponentially. During this ramp-up, measured throughput is significantly below the connection's actual capacity.

**Solution:** Discard the first 30% of bandwidth samples in each measurement direction. This eliminates TCP slow-start contamination while preserving enough data for accurate computation.

```
Input:  [12, 45, 89, 120, 150, 155, 148, 152, 151, 149] Mbps
After:  [150, 155, 148, 152, 151, 149] Mbps (first 3 discarded)
```

#### Stage 2: IQR Outlier Filtering

After slow-start discard, statistical outliers are removed using the **Interquartile Range (IQR) method**:

```
Q1 = 25th percentile
Q3 = 75th percentile
IQR = Q3 - Q1
Lower bound = Q1 - 1.5 * IQR
Upper bound = Q3 + 1.5 * IQR
```

Samples outside [lower bound, upper bound] are discarded. This removes:
- Transient congestion dips
- Measurement artifacts from JavaScript garbage collection
- Network bursts that don't represent sustained throughput

#### Stage 3: Modified Trimean

The final bandwidth value is computed using the **modified trimean**, following [Ookla's Speed Score methodology](https://www.ookla.com/resources/guides/speedtest-methodology):

```
Modified Trimean = (P10 + 8 * P50 + P90) / 10
```

Where P10, P50, P90 are the 10th, 50th, and 90th percentiles of the filtered samples.

**Why trimean over simple mean?**
- The **median (P50)** receives 80% of the weight, making the result robust against outliers
- The **10th percentile** pulls the estimate down slightly to account for worst-case conditions
- The **90th percentile** accounts for burst capability
- This produces a value that represents "what the user typically experiences"

**Comparison of aggregation methods on the same data:**

| Method | Result | Notes |
|--------|--------|-------|
| Simple Mean | 148.3 Mbps | Susceptible to outliers |
| Median | 150.0 Mbps | Ignores distribution shape |
| 90th Percentile | 155.0 Mbps | Optimistic |
| Trimean | 150.0 Mbps | Balanced, robust |
| Modified Trimean | 149.5 Mbps | Heavily median-weighted, slight pessimism |

### Adaptive Payload Sizing

The test uses progressively larger payloads (100KB through 250MB) to handle connections ranging from 1 Mbps to 10+ Gbps:

- **Slow connections (< 10 Mbps)**: The 100KB and 1MB requests will reach the `bandwidthFinishRequestDuration` threshold (1000ms), and larger payloads are automatically skipped
- **Fast connections (100 Mbps - 1 Gbps)**: 10MB payloads provide accurate sustained measurement
- **Very fast connections (1 Gbps+)**: 100MB and 250MB payloads ensure the pipe is fully saturated, preventing underestimation

---

## Statistical Methods

All statistical functions are implemented in `src/services/statistics.ts`:

### Percentile Calculation
Uses **linear interpolation** between adjacent sorted values:
```ts
function percentile(sorted: number[], p: number): number {
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
```

### Trimean Variants
- **Classic Trimean**: `(Q1 + 2*median + Q3) / 4` — standard Tukey trimean
- **Modified Trimean**: `(P10 + 8*P50 + P90) / 10` — Ookla-style, heavily median-weighted

### Outlier Detection
**IQR method** with configurable multiplier (default 1.5):
- Values below `Q1 - 1.5*IQR` or above `Q3 + 1.5*IQR` are removed
- This is the standard Tukey fence method, widely used in statistical analysis

### Confidence-Weighted Merge
For combining measurements from two providers:
```ts
function weightedMerge(a: number, b: number, weightA: number): number {
  if (a > 0 && b > 0) return a * weightA + b * (1 - weightA);
  return a > 0 ? a : b;  // Fallback to available value
}
```

---

## Bufferbloat Detection

[Bufferbloat](https://www.bufferbloat.net/) occurs when excessive buffering in network equipment causes high latency under load. It's one of the most common causes of poor internet quality that standard speed tests miss.

### Methodology

The test measures latency in two conditions:
1. **Unloaded**: Dedicated latency engine measures RTT with no other traffic
2. **Loaded**: Concurrent latency probes (every 200ms) run during download and upload phases

The **bufferbloat ratio** is calculated as:
```
ratio = loaded_latency / unloaded_latency
```

### Grading Scale

| Grade | Ratio | Interpretation |
|-------|-------|----------------|
| A | < 1.5x | Excellent — minimal buffering, likely using SQM/fq_codel |
| B | 1.5x - 3x | Good — some buffering, acceptable for most uses |
| C | 3x - 5x | Fair — noticeable under load, VoIP may degrade |
| D | 5x - 10x | Poor — significant bufferbloat, real-time apps suffer |
| F | >= 10x | Critical — severe bufferbloat, needs queue management |

### Data Sources

- **Cloudflare**: Native `measureDownloadLoadedLatency` and `measureUploadLoadedLatency` options send parallel latency probes while bandwidth tests run, collecting up to 50 loaded latency points
- **Loaded latency points**: Retrieved via `getDownLoadedLatencyPoints()` and `getUpLoadedLatencyPoints()`, processed through the full `computeLatencyStats()` pipeline

---

## Connection Stability Analysis

Beyond average speed, technicians need to know if the connection is consistent or variable.

### Coefficient of Variation (CV)

```
CV = standard_deviation / mean
```

The CV is computed separately for download and upload bandwidth samples (combined from both providers):

| CV Range | Rating | Interpretation |
|----------|--------|----------------|
| < 0.10 | Excellent | Highly consistent throughput |
| 0.10 - 0.15 | Good | Minor fluctuations, stable connection |
| 0.15 - 0.20 | Fair | Noticeable variation (shared medium, congestion) |
| 0.20 - 0.40 | Variable | Significant fluctuation (wireless interference, congestion) |
| > 0.40 | Poor | Highly unstable (packet loss, severe congestion, throttling) |

A connection reporting 500 Mbps with CV of 0.05 is more reliable than one reporting 600 Mbps with CV of 0.35.

---

## DNS Diagnostics

The DNS diagnostic module probes **12 major domains** in parallel to assess connectivity and DNS resolver performance:

### Probe Domains
`google.com`, `cloudflare.com`, `apple.com`, `microsoft.com`, `amazon.com`, `netflix.com`, `github.com`, `wikipedia.org`, `facebook.com`, `twitter.com`, `youtube.com`, `reddit.com`

### Timing Breakdown

Using the [Performance Resource Timing API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming), each probe extracts:

| Metric | Calculation | What It Measures |
|--------|-------------|------------------|
| DNS | `domainLookupEnd - domainLookupStart` | DNS resolver performance |
| TCP | `connectEnd - connectStart` | TCP handshake time |
| TLS | `connectEnd - secureConnectionStart` | TLS negotiation overhead |
| TTFB | `responseStart - requestStart` | Server response time |
| Total | `performance.now()` delta | End-to-end request time |

**Note:** Due to [Timing-Allow-Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Timing-Allow-Origin) restrictions, cross-origin requests to third-party domains often return zeroed timing fields. When this occurs, only the `totalMs` value (from `performance.now()`) is reported, and granular fields are set to `null`.

### Dual-Pass Probing

An optional dual-pass mode runs probes twice:
1. **First pass**: Cold DNS cache — measures actual resolver latency
2. **Second pass**: Warm DNS cache — measures cached resolution
3. **Caching effect**: The difference between passes quantifies DNS cache warming benefit

### Aggregation

Average values are computed for each timing component across successful probes:
- `avgTotalMs` — overall connectivity health
- `avgDnsMs` — DNS resolver speed
- `avgTcpMs` — network path quality
- `avgTlsMs` — TLS negotiation efficiency
- `avgTtfbMs` — server responsiveness

---

## Provider Aggregation

### Confidence-Weighted Merge

Instead of simple averaging, each metric is merged using provider-appropriate weights:

| Metric | Cloudflare Weight | NDT7 Weight | Rationale |
|--------|-------------------|-------------|-----------|
| Download Speed | 60% | 40% | CF uses multi-request with progressive sizes |
| Upload Speed | 60% | 40% | Same rationale as download |
| Latency (Ping) | 40% | 60% | NDT7's TCPInfo.MinRTT is kernel-level |
| Jitter | 40% | 60% | NDT7's RTT samples are from TCP stack |

### Bandwidth Processing Pipeline

When raw bandwidth samples are available from both providers, each set independently goes through:
1. Slow-start discard (30%)
2. IQR outlier filtering (1.5x fence)
3. Modified trimean computation

The resulting accurate bandwidth values are then merged with the weights above.

### Divergence Detection

If the two providers' bandwidth results differ by more than **30%**, a divergence warning is flagged:

```
divergence = |CF - NDT| / max(CF, NDT)
```

**Common causes of divergence:**
- **ISP throttling**: Some ISPs throttle specific traffic patterns (single-stream vs multi-stream)
- **QoS policies**: Network equipment may prioritize different traffic classes
- **CDN routing**: Cloudflare edge vs M-Lab server may use different network paths
- **TCP optimization**: Middleboxes may optimize for specific connection patterns

Divergence itself is diagnostically valuable — technicians can use per-provider results to identify the root cause.

---

## AIM Quality Scores

Cloudflare's engine computes [AIM (Aggregated Internet Measurement)](https://developers.cloudflare.com/fundamentals/speed/aim/) scores that rate the connection for specific use cases:

| Score | What It Measures |
|-------|------------------|
| Streaming | Video streaming quality (Netflix, YouTube) |
| Gaming | Online gaming responsiveness |
| RTC | Real-time communication (Zoom, Teams) |

Each score includes:
- **Points**: Numeric score
- **Classification**: bad, poor, average, good, great (indexed 0-4)

These scores are extracted from `results.getScores()` after the Cloudflare engine completes all measurements. They combine bandwidth, latency, jitter, and packet loss into use-case-specific quality ratings.

---

## Standards & References

| Standard / Source | Usage |
|-------------------|-------|
| [RFC 3550 — RTP](https://www.rfc-editor.org/rfc/rfc3550) | Jitter calculation algorithm (Section 6.4.1) |
| [RFC 6349 — TCP Throughput Testing](https://www.rfc-editor.org/rfc/rfc6349) | Framework for throughput measurement methodology |
| [RFC 5681 — TCP Congestion Control](https://www.rfc-editor.org/rfc/rfc5681) | Understanding slow-start behavior for discard strategy |
| [Ookla Speed Score Methodology](https://www.ookla.com/resources/guides/speedtest-methodology) | Modified trimean (1:8:1 weighting of P10:P50:P90) |
| [Cloudflare AIM Scores](https://developers.cloudflare.com/fundamentals/speed/aim/) | Connection quality scoring framework |
| [M-Lab NDT Protocol](https://www.measurementlab.net/tests/ndt/) | Single-stream TCP measurement methodology |
| [Performance Resource Timing API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming) | High-precision browser timing extraction |
| [Bufferbloat.net](https://www.bufferbloat.net/) | Bufferbloat detection and grading methodology |
| [UChicago Internet Equity](https://internetequity.uchicago.edu/) | Best practices for browser-based speed test data collection |
| [CAIDA Speed Test Design](https://www.caida.org/catalog/papers/2022_design_implementation_web_based_speedtest/) | Academic analysis of web-based speed test implementation |
| [Broadband Mapping Coalition](https://broadbandmappingcoalition.org/) | Recommendations for browser-based speed test surveys |

---

## File Reference

| File | Purpose |
|------|---------|
| `src/services/statistics.ts` | Percentile, trimean, IQR filter, slow-start discard, RFC 3550 jitter, CV |
| `src/services/latency-engine.ts` | Dedicated 100-sample latency measurement with warm-up |
| `src/services/cloudflare-provider.ts` | Cloudflare speed test with tuned accuracy config |
| `src/services/ndt7-provider.ts` | M-Lab NDT7 with raw sample collection |
| `src/services/aggregated-provider.ts` | Confidence-weighted multi-provider aggregation |
| `src/services/dns-check.ts` | 12-domain DNS diagnostics with Resource Timing breakdown |
| `src/services/provider-factory.ts` | Provider instantiation based on mode setting |
| `src/hooks/useSpeedTest.ts` | Test orchestration — latency engine + providers + DNS + stability |
| `src/types/speedtest.ts` | TypeScript interfaces for all metrics |
| `src/views/TechnicalReportView.tsx` | Consumer-friendly "How It Works" article page |
