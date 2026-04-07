# QubeTX Speed Test — Project Guide

## Overview

Technician-grade internet speed test built with Vite + React 19 + TypeScript. Uses Cloudflare and M-Lab NDT7 as dual providers with confidence-weighted aggregation, Ookla-style trimean, RFC 3550 jitter, bufferbloat detection, and connection stability analysis.

## Dev Commands

```bash
npm install           # Install deps + copy NDT7 workers to public/
npx vite --host       # Dev server (port varies — check for <title>QubeTX Speed Test</title>)
npx vite build        # Production build to dist/
npx tsc --noEmit      # Type check
```

Vercel auto-deploys on push to main.

## Architecture

### Test Flow (sequential)
1. **Latency Engine** (`src/services/latency-engine.ts`) — 100 HTTP pings to Cloudflare edge with 3-ping warmup discard
2. **DNS Check** (`src/services/dns-check.ts`) — 12 domains in parallel (background, non-blocking)
3. **Cloudflare** (`src/services/cloudflare-provider.ts`) — Progressive payloads 100KB→250MB, loaded latency probes, packet loss via TURN
4. **NDT7** (`src/services/ndt7-provider.ts`) — Single-stream WebSocket throughput with TCP kernel metrics
5. **Aggregation** (`src/services/aggregated-provider.ts`) — Slow-start discard → IQR outlier filter → modified trimean → confidence-weighted merge

### Key Services

| File | Purpose |
|------|---------|
| `src/services/statistics.ts` | Percentile, trimean, IQR filter, slow-start discard, RFC 3550 jitter, CV |
| `src/services/latency-engine.ts` | 100-sample HTTP RTT with PerformanceResourceTiming precision |
| `src/services/cloudflare-provider.ts` | Cloudflare speed test (bandwidthPercentile=0.5, loaded latency enabled) |
| `src/services/ndt7-provider.ts` | M-Lab NDT7 with raw bandwidth sample collection |
| `src/services/aggregated-provider.ts` | Dual-provider merge: CF 60% bandwidth / NDT7 60% latency weights |
| `src/services/dns-check.ts` | 12-domain DNS probe with Resource Timing API breakdown |
| `src/services/provider-factory.ts` | Creates provider instance based on settings mode |

### State Management
- `src/store/SpeedTestContext.tsx` — React Context wrapping `useSpeedTest` hook
- `src/hooks/useSpeedTest.ts` — Orchestrates latency engine + provider + DNS, manages phase state
- Settings persisted to localStorage via `useSettings` hook

### Routing (React Router v7)
- `/` — Main speed test (`SpeedTestPage` → `MainTestView`)
- `/settings` — Configuration (`SettingsPage` → `SettingsView`)
- `/how-it-works` — Technical report article (`TechnicalReportPage` → `TechnicalReportView`)

### Responsive Breakpoints
- Mobile: `<600px`
- Tablet: `600–899px`
- Small Desktop: `900–1399px`
- Desktop: `>=1400px`

Viewport height uses `100svh` (small viewport height) for mobile browser chrome compatibility.

### Layout
- `Apparatus` component provides the two-panel layout (left: mechanism + controls, right: data)
- `TapeMechanism` uses CSS `transform: scale()` wrapped in a sizing container
- `PretextProvider` + `PretextBlock` use `@chenglou/pretext` for layout-shift prevention

## Types

Key types in `src/types/speedtest.ts`:
- `SpeedTestResult` — Main result with `latencyStats`, `bufferbloat`, `stability`, `providerDivergence`, `dnsCheck`
- `LatencyStats` — P50/P75/P95/P99, min/max/mean/stddev, jitter (RFC 3550), jitterMad
- `BufferbloatResult` — Unloaded/loaded latency stats, grade A-F, download/upload ratios
- `StabilityMetric` — Coefficient of variation per direction, stable boolean
- `DnsProbeResult` — Per-domain with dnsMs/tcpMs/tlsMs/ttfbMs/totalMs
- `DnsCheckResult` — Aggregate with per-component averages

## Accuracy Methodology

- **Bandwidth**: Raw samples → discard first 30% (slow-start) → IQR outlier filter → modified trimean (P10 + 8*P50 + P90)/10
- **Latency**: 100 samples with 3-ping warmup, PerformanceResourceTiming for precision, percentile breakdown
- **Jitter**: RFC 3550 exponentially weighted moving average: J[i] = J[i-1] + (|D| - J[i-1]) / 16
- **Bufferbloat**: loaded_latency / unloaded_latency ratio → grade A-F
- **Aggregation**: CF 60%/NDT 40% for bandwidth, CF 40%/NDT 60% for latency; divergence flagged at >30% difference

See `ACCURACY.md` for full technical documentation.

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataPanel` | `src/components/data/` | Displays ping/jitter (with percentiles), download, upload, accuracy badges |
| `DnsBar` | `src/components/data/` | 12-dot DNS summary bar with timing breakdown overlay |
| `TapeMechanism` | `src/components/mechanism/` | Cassette tape animation linked to throughput |
| `TopBar` | `src/components/layout/` | QubeTX logo, clock, question mark icon |
| `Apparatus` | `src/components/layout/` | Two-panel responsive layout shell |

## Copyright

Every page wrapper (`src/pages/*.tsx`) must include the QubeTX copyright footer:
```tsx
<div style={{
  fontSize: '0.55rem',
  letterSpacing: '0.1em',
  color: 'rgba(0,0,0,0.2)',
  textAlign: 'center',
  padding: '0.5rem 0',
  flexShrink: 0,
}}>
  &copy; 2026 QUBETX
</div>
```
Any new pages must include this. Article/view-level components should also include "BUILT BY QUBETX" in their footer where appropriate.

## Dependencies

- `@cloudflare/speedtest` v1.7.0 — Cloudflare edge speed test engine
- `@m-lab/ndt7` v0.1.4 — M-Lab NDT7 (dynamic import, UMD module)
- `@chenglou/pretext` — Container-aware text measurement
- `react-router-dom` v7 — Client-side routing
