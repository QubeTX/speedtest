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
3. **Network Metadata** (`src/services/network-metadata.ts`) — IP/ISP/geolocation from CF headers + ipinfo.io (background, non-blocking)
4. **Cloudflare** (`src/services/cloudflare-provider.ts`) — Progressive payloads 100KB→250MB, loaded latency probes, packet loss via TURN
5. **NDT7** (`src/services/ndt7-provider.ts`) — Single-stream WebSocket throughput with TCP kernel metrics
6. **Aggregation** (`src/services/aggregated-provider.ts`) — Slow-start discard → IQR/Winsorized cross-check → modified trimean → inverse-variance weighted merge → bootstrap CI

### Key Services

| File | Purpose |
|------|---------|
| `src/services/statistics.ts` | Percentile, trimean, IQR filter, winsorize, slow-start discard, RFC 3550 jitter, CV, bootstrap CI, inverse-variance merge |
| `src/services/latency-engine.ts` | 100-sample HTTP RTT with PerformanceResourceTiming precision |
| `src/services/cloudflare-provider.ts` | Cloudflare speed test (bandwidthPercentile=0.5, loaded latency, jitter breakdown) |
| `src/services/ndt7-provider.ts` | M-Lab NDT7 with raw bandwidth sample collection |
| `src/services/aggregated-provider.ts` | Dual-provider merge: inverse-variance weighted bandwidth, fixed latency weights, bootstrap CI |
| `src/services/network-metadata.ts` | IP, ISP/ASN, geolocation, edge server from CF headers + ipinfo.io |
| `src/services/dns-check.ts` | 12-domain DNS probe with Resource Timing API breakdown |
| `src/services/provider-factory.ts` | Creates provider instance based on settings mode |
| `src/data/colo-map.ts` | Cloudflare IATA data center code-to-city name mapping (~57 PoPs) |

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
- `SpeedTestResult` — Main result with `latencyStats`, `bufferbloat`, `stability`, `providerDivergence`, `dnsCheck`, `jitterBreakdown`, `downloadEstimate`, `uploadEstimate`, `networkMetadata`
- `LatencyStats` — P50/P75/P95/P99, min/max/mean/stddev, jitter (RFC 3550), jitterMad
- `BufferbloatResult` — Unloaded/loaded latency stats, grade A-F, download/upload ratios
- `StabilityMetric` — Coefficient of variation per direction, stable boolean
- `JitterBreakdown` — Idle, during-download, during-upload jitter values
- `BandwidthEstimate` — Point estimate with 95% CI (lower, upper, margin), method, sample count
- `NetworkMetadata` — IP, ipVersion, ISP/ASN, city/region/country, lat/lng, colo/coloCity, TLS, TCP metrics
- `DnsProbeResult` — Per-domain with dnsMs/tcpMs/tlsMs/ttfbMs/totalMs
- `DnsCheckResult` — Aggregate with per-component averages

## Accuracy Methodology

- **Bandwidth**: Raw samples → discard first 30% (slow-start) → IQR outlier filter → modified trimean (P10 + 8*P50 + P90)/10 → Winsorized cross-check (if >15% divergence, average both)
- **Confidence Intervals**: 95% CI via bootstrap resampling (1000 iterations of modified trimean on resampled data)
- **Latency**: 100 samples with 3-ping warmup, PerformanceResourceTiming for precision, percentile breakdown
- **Jitter**: RFC 3550 EWMA: J[i] = J[i-1] + (|D| - J[i-1]) / 16. Per-direction breakdown: idle, during-download, during-upload
- **Bufferbloat**: loaded_latency / unloaded_latency ratio → grade A-F
- **Aggregation**: Inverse-variance weighted merge for bandwidth (dynamic, clamped 0.3-0.7); CF 40%/NDT 60% for latency; divergence flagged at >30% difference

See `ACCURACY.md` for full technical documentation.

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataPanel` | `src/components/data/` | Displays ping/jitter (with percentiles), download, upload, accuracy badges |
| `DnsBar` | `src/components/data/` | 12-dot DNS summary bar with timing breakdown overlay |
| `TapeMechanism` | `src/components/mechanism/` | Cassette tape animation linked to throughput |
| `TopBar` | `src/components/layout/` | QubeTX logo, clock, question mark icon |
| `Apparatus` | `src/components/layout/` | Two-panel responsive layout shell |
| `AppStoreBadge` | `src/components/layout/` | iOS-only "Download on the App Store" badge linking to SpeedQX native app (renders `null` on non-iOS) |

## Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useSpeedTest` | `src/hooks/` | Orchestrates latency + provider + DNS; manages phase state |
| `useResponsive` | `src/hooks/` | Viewport breakpoints: `isMobile`, `isTablet`, `isSmallDesktop`, `isDesktop` |
| `useIsIOS` | `src/hooks/` | Detects iPhone + iPad (including iPadOS 13+ Mac-UA masquerade via `maxTouchPoints > 1`). Returns `false` before mount to avoid SSR/hydration flash |
| `useClock` | `src/hooks/` | Current time string for TopBar |
| `useNetworkInfo` | `src/hooks/` | Connection API (downlink, rtt, effective type) |

## Static Assets

- `public/question-mark.svg` — help icon in TopBar
- `public/favicon.svg` — browser tab icon
- `public/app-store-badge.svg` — official Apple "Download on the App Store" black lockup. **Do not modify or optimize this file** — Apple Marketing Guidelines forbid recoloring, resizing below 40px height, or altering the SVG.
- `public/fonts/` — self-hosted typefaces
- `public/ndt7-*-worker.js` — M-Lab NDT7 worker scripts

## Native Companion App

SpeedQX is the native iOS version of this speed test, available at
`https://apps.apple.com/us/app/speedqx/id6760538784`. The `AppStoreBadge` component
in every page footer links to it, and only renders when `useIsIOS()` returns `true`.
Desktop, Android, and real-Mac visitors never see the badge — the detection is
precise enough (UA + `maxTouchPoints`) that we don't fall back to a broad
"any mobile" rule.

## Copyright

Every page wrapper (`src/pages/*.tsx`) must include the QubeTX copyright footer AND the `AppStoreBadge`:
```tsx
<div style={{
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 0',
  flexShrink: 0,
}}>
  <AppStoreBadge />
  <span style={{
    fontSize: '0.55rem',
    letterSpacing: '0.1em',
    color: 'rgba(0,0,0,0.2)',
    textAlign: 'center',
  }}>
    &copy; 2026 QUBETX
  </span>
</div>
```
Any new pages must include this. Article/view-level components should also include "BUILT BY QUBETX" in their footer where appropriate. The `AppStoreBadge` self-hides on non-iOS, so this pattern is safe to use everywhere. The `0.5rem` gap satisfies Apple's clear-space rule around the badge.

## Dependencies

- `@cloudflare/speedtest` v1.7.0 — Cloudflare edge speed test engine
- `@m-lab/ndt7` v0.1.4 — M-Lab NDT7 (dynamic import, UMD module)
- `@chenglou/pretext` — Container-aware text measurement
- `react-router-dom` v7 — Client-side routing

---

## Subagent model preference (applies to ALL subagents in this repo)

When working in this repository, whenever you spawn a subagent — the `Agent` tool (**including Explore
and Plan agents**), `Workflow` agents, or any other subagent — use a top-tier model/effort pairing.
**Never** leave a subagent on a lower model or below `xhigh` effort.

**Per model — pick the model that fits the task, then its effort. Prefer the first; never go below either.**
- **Opus 4.8 [1m]:** `xhigh` **preferred** (most situations); `max` allowed when the agent judges it
  needs the deeper reasoning (e.g. the single hardest stage).
- **Sonnet 5:** `max` **preferred** (most situations); `xhigh` allowed when the agent doesn't need the
  extra thinking (e.g. cheaper/faster mechanical fan-out).

Only the **Opus** and **Sonnet** classes are in scope. **Never** a weaker/budget class (no **Haiku** or
older), and do **not** substitute the **Fable ("mythos")** class or any other/new class into the Opus or
Sonnet slot just because it's new or capable — adopting a different class is a deliberate change to this
convention, not an automatic remap. **Never below `xhigh`** effort. Which model + which of its two efforts
is the spawning/orchestrating agent's call per situation — just honor each model's preferred default and
the floor.

In `Workflow` scripts pass model + effort explicitly per agent (`{model:'opus', effort:'xhigh'|'max'}` or
`{model:'sonnet', effort:'max'|'xhigh'}`); for the `Agent` tool set `model` to `opus`/`sonnet` (it inherits
the session's `[1m]` context/effort).

---

## Mapping this forward (when new models are released)

This convention names **two specific model classes** — **Opus** and **Sonnet** — plus each one's **role**
and an **effort floor**. It is not tied to version numbers. When Anthropic ships a new lineup, advance
**each named class along its own lineage** (Opus → next Opus, Sonnet → next Sonnet) and keep it in role:

- **Opus class — flagship / deepest reasoning.** Today **Opus 4.8 [1m]** → the newest **Opus-class**
  model in its **largest-context** variant. Keep **`xhigh` preferred, `max` when needed**. Role: deep
  synthesis, planning, verification, the single hardest stage.
- **Sonnet class — workhorse / high-throughput.** Today **Sonnet 5** → the newest **Sonnet-class**
  model. Keep **`max` preferred, `xhigh` when lighter**. Role: high-parallelism fan-out, mechanical/bulk work.
- **Only the Opus and Sonnet classes are in scope — mind the other classes.** **Haiku** is the excluded
  budget class (never use it for subagents). The **Fable ("mythos") class** — and any other or brand-new
  class — is **not** one of these two slots: do **not** silently map a Fable/mythos model into the Opus
  or Sonnet role just because it's new, large, or capable. Adopting a different class is a *deliberate*
  update to this convention, never an automatic role-remap.
- **The floor holds regardless of names:** never a class below Sonnet (no Haiku/older), and **never
  below `xhigh`** effort.

**At each release, do this:**
1. Find the current **Opus-class** and **Sonnet-class** models (same class lineage as today). Ignore
   Haiku, and ignore any other class (e.g. Fable/mythos) unless this convention is explicitly updated to include it.
2. Swap in the new Opus-class and Sonnet-class names; keep each class's preferred/allowed efforts and the floor.
3. If the effort-level names change, preserve the *shape* on the effort ladder: Opus defaults to
   **one below the top** and may go **top**; Sonnet defaults to the **top** and may drop **one below**.
   The floor stays at "one below the top" (today = `xhigh`) — never lower.
4. Confirm the exact model IDs and the long-context suffix (today `[1m]`), and update the
   `{model:'opus'|'sonnet'}` tool aliases if the class keywords change. (Check current model docs /
   the `claude-api` reference.)
5. Bump the "Set …" date.

**Rule of thumb:** _Opus + Sonnet classes only (never Haiku, never auto-adopt Fable/mythos), top-ish
effort, never below the second-highest effort._
